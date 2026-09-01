/**
 * TTLock 8-bosqich — masofadan unlock/lock + audit.
 * Tashqi API DB transaction ichida chaqirilmaydi; blind retry yo‘q.
 */

import { randomUUID } from "crypto";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import {
  remoteLockLock,
  remoteUnlockLock,
} from "@/lib/api-server/ttlock/client";
import {
  findConnectionByOwner,
  requireTtlockDb,
} from "@/lib/api-server/ttlock/db";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import {
  remoteReadyLabel,
  resolveRemoteControlCapability,
  type RemoteControlCapability,
  type RemoteControlStatusPublic,
} from "@/lib/api-server/ttlock/remote-capability";
import {
  assertTtlockOwnerRole,
  getValidAccessToken,
} from "@/lib/api-server/ttlock/service";
import { isTtlockConfigured } from "@/lib/api-server/ttlock/config";
import { inferWifiRemoteCapable } from "@/lib/api-server/ttlock/types";
import { TTLOCK_PROVIDER_LABEL } from "@/types/ttlock-assignable-lock";

export type RemoteCommandPublic = {
  id: string;
  commandType: "UNLOCK" | "LOCK";
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  startedAt: string;
  finishedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

function mapCommandPublic(row: {
  id: string;
  commandType: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}): RemoteCommandPublic {
  return {
    id: row.id,
    commandType: row.commandType as "UNLOCK" | "LOCK",
    status: row.status as RemoteCommandPublic["status"],
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
  };
}

async function loadRoomLockBundle(propertyId: string, userId: string) {
  const settings = await prisma.roomLockSettings.findUnique({
    where: { propertyId },
    include: {
      property: { select: { title: true } },
      ttlockCachedLock: {
        include: { gateway: true },
      },
    },
  });
  if (!settings?.ttlockCachedLockId || !settings.ttlockCachedLock) {
    return { settings, lock: null, connection: null };
  }
  const lock = settings.ttlockCachedLock;
  if (lock.connectionId) {
    const connection = await findConnectionByOwner(userId);
    if (!connection || connection.id !== lock.connectionId) {
      return { settings, lock, connection: null };
    }
    return { settings, lock, connection };
  }
  return { settings, lock, connection: await findConnectionByOwner(userId) };
}

async function countRevocableGrants(propertyId: string): Promise<boolean> {
  const rows = await prisma.roomAccessGrant.findMany({
    where: { propertyId, status: "PLANNED" },
    include: { ttlockCredential: true },
  });
  return rows.some((g) => {
    if (g.status === "CANCELLED") return false;
    const cred = g.ttlockCredential;
    if (!cred) return true;
    const sync = cred.syncStatus;
    if (["SENT", "ACTIVE", "REVOKE_PENDING"].includes(sync)) return true;
    if (sync === "PLANNED" || sync === "FAILED") return true;
    return false;
  });
}

async function hasPendingCommand(ttlockCachedLockId: string): Promise<boolean> {
  const pending = await prisma.ttlockRemoteCommand.findFirst({
    where: { ttlockCachedLockId, status: "PENDING" },
  });
  return Boolean(pending);
}

function parseCapabilities(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function connectionConnected(connection: {
  status: string;
  accessTokenEncrypted: string | null;
} | null): boolean {
  if (!connection?.accessTokenEncrypted) return false;
  return connection.status === "CONNECTED" || connection.status === "SYNCING";
}

function tokenExpired(connection: {
  tokenExpiresAt: Date | null;
  status: string;
} | null): boolean {
  if (!connection) return true;
  if (connection.status === "TOKEN_EXPIRED") return true;
  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() <= Date.now()
  ) {
    return true;
  }
  return false;
}

export async function buildRemoteControlStatus(input: {
  user: User;
  propertyId: string;
}): Promise<RemoteControlStatusPublic> {
  assertTtlockOwnerRole(input.user);

  let dbReady = true;
  try {
    await requireTtlockDb();
  } catch {
    dbReady = false;
  }

  const { settings, lock, connection } = await loadRoomLockBundle(
    input.propertyId,
    input.user.id
  );

  const roleAllowed = true;
  const configReady = isTtlockConfigured();
  const connOk = connectionConnected(connection);
  const tokExpired = tokenExpired(connection);
  const roomLinked = Boolean(settings?.ttlockCachedLockId && lock);
  const lockActive = lock?.isActive !== false;
  const commandInProgress = lock
    ? await hasPendingCommand(lock.id)
    : false;
  const hasRevocable = await countRevocableGrants(input.propertyId);

  const caps = parseCapabilities(lock?.capabilities);
  const wifiRemote =
    inferWifiRemoteCapable({ capabilities: caps }) ??
    (typeof caps?.wifiRemoteCapable === "boolean"
      ? caps.wifiRemoteCapable
      : null);

  const capability = resolveRemoteControlCapability({
    roleAllowed,
    configReady,
    dbReady,
    connectionConnected: connOk,
    tokenExpired: tokExpired,
    roomLockLinked: roomLinked,
    lockActive,
    remoteUnlock: lock?.remoteUnlock ?? null,
    commandInProgress,
    hasRevocableAccess: hasRevocable,
    transport: {
      hasGateway: lock?.hasGateway ?? false,
      gatewayOnlineStatus: lock?.gateway?.onlineStatus ?? null,
      wifiRemoteCapable: wifiRemote,
      capabilities: caps,
    },
  });

  return {
    ...capability,
    provider: TTLOCK_PROVIDER_LABEL,
    roomName: settings?.property?.title ?? "",
    lockName: lock?.name ?? settings?.lockName ?? null,
    lockExternalId: lock?.externalLockId ?? settings?.deviceId ?? null,
    lockOnlineStatus: lock?.onlineStatus ?? "UNKNOWN",
    gatewayName: lock?.gateway?.name ?? null,
    gatewayOnlineStatus: lock?.gateway?.onlineStatus ?? null,
    wifiRemoteCapable: wifiRemote,
    battery: lock?.battery ?? null,
    lastSyncedAt: lock?.lastSyncedAt?.toISOString() ?? null,
    remoteReady: capability.canUnlock || capability.canLock,
    remoteReadyLabel: remoteReadyLabel(capability),
  };
}

export async function assertRemoteUnlockAllowed(input: {
  user: User;
  propertyId: string;
}): Promise<RemoteControlCapability> {
  const status = await buildRemoteControlStatus(input);
  if (!status.canUnlock) {
    throw new TtlockError(
      status.unlockReason ?? "Masofadan ochish mumkin emas.",
      (status.unlockReasonCode as import("./errors").TtlockErrorCode) ??
        "TTLOCK_FORBIDDEN",
      400
    );
  }
  return status;
}

export async function assertRemoteLockAllowed(input: {
  user: User;
  propertyId: string;
}): Promise<RemoteControlCapability> {
  const status = await buildRemoteControlStatus(input);
  if (!status.canLock) {
    throw new TtlockError(
      status.lockReason ?? "Masofadan yopish mumkin emas.",
      (status.lockReasonCode as import("./errors").TtlockErrorCode) ??
        "TTLOCK_FORBIDDEN",
      400
    );
  }
  return status;
}

async function claimRemoteCommand(input: {
  propertyId: string;
  ttlockCachedLockId: string;
  connectionId: string;
  userId: string;
  commandType: "UNLOCK" | "LOCK";
  idempotencyKey: string;
}): Promise<
  | { kind: "replay"; command: RemoteCommandPublic }
  | { kind: "claimed"; commandId: string }
> {
  const existing = await prisma.ttlockRemoteCommand.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { kind: "replay", command: mapCommandPublic(existing) };
  }

  const pending = await prisma.ttlockRemoteCommand.findFirst({
    where: { ttlockCachedLockId: input.ttlockCachedLockId, status: "PENDING" },
  });
  if (pending) {
    throw new TtlockError(
      "Bu qulf uchun boshqa masofaviy buyruq bajarilmoqda.",
      "TTLOCK_COMMAND_IN_PROGRESS",
      409
    );
  }

  const id = randomUUID();
  const now = new Date();
  await prisma.ttlockRemoteCommand.create({
    data: {
      id,
      propertyId: input.propertyId,
      ttlockCachedLockId: input.ttlockCachedLockId,
      connectionId: input.connectionId,
      initiatedByUserId: input.userId,
      commandType: input.commandType,
      status: "PENDING",
      idempotencyKey: input.idempotencyKey,
      startedAt: now,
    },
  });
  return { kind: "claimed", commandId: id };
}

async function finalizeCommand(
  commandId: string,
  patch: {
    status: "SUCCEEDED" | "FAILED" | "UNKNOWN";
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    providerRequestId?: string | null;
  }
) {
  const now = new Date();
  await prisma.ttlockRemoteCommand.update({
    where: { id: commandId },
    data: {
      status: patch.status,
      finishedAt: now,
      lastErrorCode: patch.lastErrorCode ?? null,
      lastErrorMessage: patch.lastErrorMessage?.slice(0, 280) ?? null,
      providerRequestId: patch.providerRequestId ?? null,
    },
  });
}

export async function executeRemoteUnlock(input: {
  user: User;
  propertyId: string;
  idempotencyKey: string;
}): Promise<{ command: RemoteCommandPublic; userMessage: string }> {
  assertTtlockOwnerRole(input.user);
  await assertRemoteUnlockAllowed(input);

  const { settings, lock, connection } = await loadRoomLockBundle(
    input.propertyId,
    input.user.id
  );
  if (!settings?.ttlockCachedLockId || !lock || !connection) {
    throw new TtlockError(
      "Xonaga TTLock qulfi biriktirilmagan.",
      "TTLOCK_ROOM_LOCK_MISSING",
      400
    );
  }

  const claim = await claimRemoteCommand({
    propertyId: input.propertyId,
    ttlockCachedLockId: lock.id,
    connectionId: connection.id,
    userId: input.user.id,
    commandType: "UNLOCK",
    idempotencyKey: input.idempotencyKey,
  });
  if (claim.kind === "replay") {
    return {
      command: claim.command,
      userMessage:
        claim.command.status === "SUCCEEDED"
          ? "Qulfni ochish buyrug‘i muvaffaqiyatli yuborildi."
          : claim.command.lastErrorMessage ??
            "Buyruq holati qayta qaytarildi.",
    };
  }

  try {
    await requireTtlockDb();
    const accessToken = await getValidAccessToken(connection, input.user.id);
    await remoteUnlockLock({
      accessToken,
      lockId: lock.externalLockId,
    });
    await finalizeCommand(claim.commandId, { status: "SUCCEEDED" });
  } catch (err) {
    const code =
      err instanceof TtlockError ? err.code : "TTLOCK_API_ERROR";
    const msg =
      err instanceof TtlockError
        ? err.message
        : "TTLock xizmatida xatolik yuz berdi.";
    const status =
      err instanceof TtlockError && err.code === "TTLOCK_TIMEOUT"
        ? "UNKNOWN"
        : "FAILED";
    const storedCode =
      status === "UNKNOWN" ? "TTLOCK_COMMAND_RESULT_UNKNOWN" : code;
    const storedMsg =
      status === "UNKNOWN"
        ? "TTLock javobi tasdiqlanmadi. Qulf holatini tekshirmasdan buyruqni qayta yubormang."
        : msg;
    await finalizeCommand(claim.commandId, {
      status,
      lastErrorCode: storedCode,
      lastErrorMessage: storedMsg,
    });
    if (status === "UNKNOWN") {
      throw new TtlockError(storedMsg, "TTLOCK_COMMAND_RESULT_UNKNOWN", 504);
    }
    throw err instanceof TtlockError
      ? err
      : new TtlockError(msg, "TTLOCK_API_ERROR", 502);
  }

  const row = await prisma.ttlockRemoteCommand.findUniqueOrThrow({
    where: { id: claim.commandId },
  });
  return {
    command: mapCommandPublic(row),
    userMessage: "Qulfni ochish buyrug‘i muvaffaqiyatli yuborildi.",
  };
}

export async function executeRemoteLock(input: {
  user: User;
  propertyId: string;
  idempotencyKey: string;
}): Promise<{ command: RemoteCommandPublic; userMessage: string }> {
  assertTtlockOwnerRole(input.user);
  await assertRemoteLockAllowed(input);

  const { settings, lock, connection } = await loadRoomLockBundle(
    input.propertyId,
    input.user.id
  );
  if (!settings?.ttlockCachedLockId || !lock || !connection) {
    throw new TtlockError(
      "Xonaga TTLock qulfi biriktirilmagan.",
      "TTLOCK_ROOM_LOCK_MISSING",
      400
    );
  }

  const claim = await claimRemoteCommand({
    propertyId: input.propertyId,
    ttlockCachedLockId: lock.id,
    connectionId: connection.id,
    userId: input.user.id,
    commandType: "LOCK",
    idempotencyKey: input.idempotencyKey,
  });
  if (claim.kind === "replay") {
    return {
      command: claim.command,
      userMessage:
        claim.command.status === "SUCCEEDED"
          ? "Qulfni yopish buyrug‘i muvaffaqiyatli yuborildi."
          : claim.command.lastErrorMessage ??
            "Buyruq holati qayta qaytarildi.",
    };
  }

  try {
    await requireTtlockDb();
    const accessToken = await getValidAccessToken(connection, input.user.id);
    await remoteLockLock({
      accessToken,
      lockId: lock.externalLockId,
    });
    await finalizeCommand(claim.commandId, { status: "SUCCEEDED" });
  } catch (err) {
    const code =
      err instanceof TtlockError ? err.code : "TTLOCK_API_ERROR";
    const msg =
      err instanceof TtlockError
        ? err.message
        : "TTLock xizmatida xatolik yuz berdi.";
    const status =
      err instanceof TtlockError && err.code === "TTLOCK_TIMEOUT"
        ? "UNKNOWN"
        : "FAILED";
    const storedCode =
      status === "UNKNOWN" ? "TTLOCK_COMMAND_RESULT_UNKNOWN" : code;
    const storedMsg =
      status === "UNKNOWN"
        ? "TTLock javobi tasdiqlanmadi. Qulf holatini tekshirmasdan buyruqni qayta yubormang."
        : msg;
    await finalizeCommand(claim.commandId, {
      status,
      lastErrorCode: storedCode,
      lastErrorMessage: storedMsg,
    });
    if (status === "UNKNOWN") {
      throw new TtlockError(storedMsg, "TTLOCK_COMMAND_RESULT_UNKNOWN", 504);
    }
    throw err instanceof TtlockError
      ? err
      : new TtlockError(msg, "TTLOCK_API_ERROR", 502);
  }

  const row = await prisma.ttlockRemoteCommand.findUniqueOrThrow({
    where: { id: claim.commandId },
  });
  return {
    command: mapCommandPublic(row),
    userMessage: "Qulfni yopish buyrug‘i muvaffaqiyatli yuborildi.",
  };
}
