import type { User } from "@prisma/client";

import {
  fetchAccessToken,
  fetchAllLocks,
  refreshAccessToken,
} from "@/lib/api-server/ttlock/client";
import {
  getTtlockPublicConfigStatus,
  isTtlockConfigured,
} from "@/lib/api-server/ttlock/config";
import { decryptSecret, encryptSecret } from "@/lib/api-server/ttlock/crypto";
import {
  clearConnectionTokens,
  countLocks,
  findConnectionById,
  findConnectionByOwner,
  listLocks,
  mapDbStatusToPublic,
  markLocksSyncedAt,
  requireTtlockDb,
  softRemoveMissingLocks,
  upsertCachedLock,
  upsertConnectionForOwner,
  type TtlockCachedLockRow,
  type TtlockConnectionRow,
} from "@/lib/api-server/ttlock/db";
import { isTtlockAccessOwnerRole } from "@/lib/api-server/ttlock/access-effective";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { buildTtlockCallbackPublicStatus } from "@/lib/api-server/ttlock/callback-status";
import { coerceBatteryFromRemote, onlineStatusToPublicBool } from "@/lib/api-server/ttlock/persistence";
import type {
  TtlockPublicLock,
  TtlockPublicStatus,
} from "@/lib/api-server/ttlock/types";
import { inferRemoteUnlock, inferWifiRemoteCapable } from "@/lib/api-server/ttlock/types";

/** Bir connection uchun parallel refresh’ni oldini olish */
const refreshLocks = new Map<string, Promise<string>>();

/** Token muddatidan N ms oldin yangilanadi */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export function assertTtlockOwnerRole(user: Pick<User, "role">) {
  if (!isTtlockAccessOwnerRole(user.role)) {
    throw new TtlockError(
      "TTLock integratsiyasini faqat admin/manager boshqara oladi",
      "TTLOCK_FORBIDDEN",
      403
    );
  }
}

function toPublicLock(row: TtlockCachedLockRow): TtlockPublicLock {
  // Canonical: onlineStatus. Legacy row.online e'tiborga olinmaydi.
  const onlineStatus = row.onlineStatus ?? "UNKNOWN";
  return {
    id: row.id,
    externalLockId: row.externalLockId,
    name: row.name,
    mac: row.mac,
    model: row.model,
    battery: row.battery,
    hasGateway: row.hasGateway,
    remoteUnlock: row.remoteUnlock,
    online: onlineStatusToPublicBool(onlineStatus),
    onlineStatus,
    isActive: row.isActive ?? true,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

function buildStatus(
  connection: TtlockConnectionRow | null,
  lockCount: number,
  configReady: boolean
): TtlockPublicStatus {
  const config = getTtlockPublicConfigStatus();
  if (!connection || connection.status === "DISCONNECTED") {
    return {
      provider: "TTLock/Sciener",
      config,
      connection: {
        status: configReady ? "ready" : "disconnected",
        connected: false,
        ttlockUid: null,
        tokenExpiresAt: null,
        lastConnectedAt: connection?.lastConnectedAt?.toISOString() ?? null,
        lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
        lastErrorCode: connection?.lastErrorCode ?? null,
        lastErrorMessage: connection?.lastErrorMessage ?? null,
        lockCount,
      },
    };
  }

  let status = mapDbStatusToPublic(connection.status);
  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() <= Date.now() &&
    status === "connected"
  ) {
    status = "token_expired";
  }

  return {
    provider: "TTLock/Sciener",
    config,
    connection: {
      status,
      connected: status === "connected" || status === "syncing",
      ttlockUid: connection.ttlockUid,
      tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
      lastConnectedAt: connection.lastConnectedAt?.toISOString() ?? null,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      lastErrorCode: connection.lastErrorCode,
      lastErrorMessage: connection.lastErrorMessage,
      lockCount,
    },
  };
}

export async function getTtlockStatus(user: User): Promise<TtlockPublicStatus> {
  assertTtlockOwnerRole(user);
  await requireTtlockDb();
  const connection = await findConnectionByOwner(user.id);
  const lockCount = connection ? await countLocks(connection.id) : 0;
  const status = buildStatus(connection, lockCount, isTtlockConfigured());
  const callback = await buildTtlockCallbackPublicStatus(user.id);
  return {
    ...status,
    callback: {
      callbackUrl: callback.callbackUrl,
      verificationMode: callback.verificationMode,
      ready: callback.ready,
      lastReceivedAt: callback.lastReceivedAt,
      lastProcessedAt: callback.lastProcessedAt,
      failedCount: callback.failedCount,
      unresolvedCount: callback.unresolvedCount,
      setupHint: callback.setupHint,
    },
  };
}

export async function connectTtlock(user: User): Promise<TtlockPublicStatus> {
  assertTtlockOwnerRole(user);
  await requireTtlockDb();

  if (!isTtlockConfigured()) {
    throw new TtlockError(
      "TTLock API ma'lumotlari hali serverga kiritilmagan. Application tasdiqlangach client_id va client_secretni server environment sozlamalariga kiriting.",
      "TTLOCK_NOT_CONFIGURED",
      503
    );
  }

  try {
    const token = await fetchAccessToken();
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);
    const accessEnc = encryptSecret(token.access_token);
    const refreshEnc = encryptSecret(token.refresh_token);

    await upsertConnectionForOwner(user.id, {
      status: "CONNECTED",
      ttlockUid: token.uid != null ? String(token.uid) : null,
      accessTokenEncrypted: accessEnc,
      refreshTokenEncrypted: refreshEnc,
      tokenExpiresAt: expiresAt,
      lastConnectedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
    });

    return getTtlockStatus(user);
  } catch (err) {
    const message =
      err instanceof TtlockError
        ? err.message
        : "TTLock hisobiga ulanib bo'lmadi";
    const code = err instanceof TtlockError ? err.code : "TTLOCK_API_ERROR";
    await upsertConnectionForOwner(user.id, {
      status: "ERROR",
      lastErrorCode: code,
      lastErrorMessage: message,
    });
    throw err;
  }
}

export async function getValidAccessToken(
  connection: TtlockConnectionRow,
  ownerUserId: string
): Promise<string> {
  const fresh = (await findConnectionById(connection.id)) ?? connection;
  connection = fresh;

  if (
    !connection.accessTokenEncrypted ||
    !connection.refreshTokenEncrypted
  ) {
    throw new TtlockError(
      "TTLock ulanmagan. Avval 'Ulash' tugmasini bosing.",
      "TTLOCK_NOT_CONNECTED",
      400
    );
  }

  const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt - Date.now() < REFRESH_SKEW_MS;

  if (!needsRefresh) {
    return decryptSecret(connection.accessTokenEncrypted);
  }

  const existing = refreshLocks.get(connection.id);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const refreshPlain = decryptSecret(connection.refreshTokenEncrypted!);
      const token = await refreshAccessToken(refreshPlain);
      const expires = new Date(Date.now() + token.expires_in * 1000);
      await upsertConnectionForOwner(ownerUserId, {
        status: "CONNECTED",
        accessTokenEncrypted: encryptSecret(token.access_token),
        refreshTokenEncrypted: encryptSecret(token.refresh_token),
        tokenExpiresAt: expires,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      return token.access_token;
    } catch (err) {
      await upsertConnectionForOwner(ownerUserId, {
        status: "TOKEN_EXPIRED",
        lastErrorCode:
          err instanceof TtlockError ? err.code : "TTLOCK_TOKEN_EXPIRED",
        lastErrorMessage:
          err instanceof TtlockError
            ? err.message
            : "Token yangilanmadi",
      });
      throw err instanceof TtlockError
        ? err
        : new TtlockError(
            "TTLock tokenini yangilab bo'lmadi",
            "TTLOCK_TOKEN_EXPIRED",
            401
          );
    } finally {
      refreshLocks.delete(connection.id);
    }
  })();

  refreshLocks.set(connection.id, promise);
  return promise;
}

export async function syncTtlockLocks(user: User): Promise<{
  status: TtlockPublicStatus;
  locks: TtlockPublicLock[];
  upserted: number;
}> {
  assertTtlockOwnerRole(user);
  await requireTtlockDb();

  if (!isTtlockConfigured()) {
    throw new TtlockError(
      "TTLock API ma'lumotlari hali serverga kiritilmagan.",
      "TTLOCK_NOT_CONFIGURED",
      503
    );
  }

  const connection = await findConnectionByOwner(user.id);
  if (!connection || !connection.accessTokenEncrypted) {
    throw new TtlockError(
      "TTLock ulanmagan. Avval hisobni ulang.",
      "TTLOCK_NOT_CONNECTED",
      400
    );
  }

  await upsertConnectionForOwner(user.id, {
    status: "SYNCING",
    lastErrorCode: null,
    lastErrorMessage: null,
  });

  try {
    const accessToken = await getValidAccessToken(connection, user.id);
    const remote = await fetchAllLocks(accessToken);
    const syncedAt = new Date();
    let upserted = 0;
    const seenLockIds = new Set<string>();

    for (const item of remote) {
      const externalLockId = String(item.lockId);
      seenLockIds.add(externalLockId);
      const name =
        item.lockAlias?.trim() ||
        item.lockName?.trim() ||
        `Qulf ${externalLockId}`;
      const battery =
        typeof item.electricQuantity === "number"
          ? coerceBatteryFromRemote(item.electricQuantity)
          : null;
      // lockData maxfiy — saqlanmaydi
      await upsertCachedLock({
        connectionId: connection.id,
        externalLockId,
        name,
        mac: item.lockMac?.trim() || null,
        model: item.lockName?.trim() || null,
        battery,
        hasGateway: item.hasGateway === 1,
        remoteUnlock: inferRemoteUnlock(item.specialValue),
        passcodeCapable:
          item.keyboardPwdVersion != null ? item.keyboardPwdVersion > 0 : null,
        onlineStatus: item.hasGateway === 1 ? "ONLINE" : "UNKNOWN",
        capabilities: {
          specialValue: item.specialValue ?? null,
          keyboardPwdVersion: item.keyboardPwdVersion ?? null,
          hasGateway: item.hasGateway === 1,
          wifiRemoteCapable:
            inferWifiRemoteCapable({
              wifiLock: item.wifiLock,
              capabilities: null,
            }) ?? null,
        },
        rawSafe: {
          lockId: externalLockId,
          lockName: item.lockName ?? null,
          lockAlias: item.lockAlias ?? null,
          lockMac: item.lockMac ?? null,
          electricQuantity: item.electricQuantity ?? null,
          hasGateway: item.hasGateway ?? null,
          groupId: item.groupId != null ? String(item.groupId) : null,
          groupName: item.groupName ?? null,
        },
        lastSyncedAt: syncedAt,
      });
      upserted += 1;
    }

    // API’da yo‘qolgan qulflar soft-remove — hard delete yo‘q
    await softRemoveMissingLocks(connection.id, seenLockIds, syncedAt);

    await markLocksSyncedAt(connection.id, syncedAt);
    await upsertConnectionForOwner(user.id, {
      status: "CONNECTED",
      lastSyncedAt: syncedAt,
      lastErrorCode: null,
      lastErrorMessage: null,
    });

    const locks = (await listLocks(connection.id)).map(toPublicLock);
    return {
      status: await getTtlockStatus(user),
      locks,
      upserted,
    };
  } catch (err) {
    await upsertConnectionForOwner(user.id, {
      status: "ERROR",
      lastErrorCode: err instanceof TtlockError ? err.code : "TTLOCK_API_ERROR",
      lastErrorMessage:
        err instanceof TtlockError ? err.message : "Sinxronlash xatosi",
    });
    throw err;
  }
}

export async function listTtlockLocks(user: User): Promise<TtlockPublicLock[]> {
  assertTtlockOwnerRole(user);
  await requireTtlockDb();
  const connection = await findConnectionByOwner(user.id);
  if (!connection) return [];
  return (await listLocks(connection.id)).map(toPublicLock);
}

export async function disconnectTtlock(user: User): Promise<TtlockPublicStatus> {
  assertTtlockOwnerRole(user);
  await requireTtlockDb();
  const connection = await findConnectionByOwner(user.id);
  if (connection) {
    // Faqat shu foydalanuvchi connection tokenlari tozalanadi
    await clearConnectionTokens(connection.id, user.id);
  }
  return getTtlockStatus(user);
}
