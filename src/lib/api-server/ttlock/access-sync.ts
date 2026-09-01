/**
 * RoomAccessGrant ↔ TTLock access sync/revoke (provider-detail = TtlockAccessCredential).
 * Tashqi API DB transaction ichida chaqirilmaydi.
 */

import { randomUUID } from "crypto";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import {
  createKeyboardPwd,
  deleteEkey,
  deleteKeyboardPwd,
  sendEkey,
} from "@/lib/api-server/ttlock/client";
import {
  findConnectionByOwner,
  requireTtlockDb,
  type TtlockAccessCredentialRow,
} from "@/lib/api-server/ttlock/db";
import { encryptAccessCredential } from "@/lib/api-server/ttlock/persistence";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import {
  assertTtlockOwnerRole,
  getValidAccessToken,
} from "@/lib/api-server/ttlock/service";
import {
  ACCESS_EFFECTIVE_UI_LABELS,
  assertValidFromBeforeTo,
  classifyCredentialForSyncClaim,
  derivePersistedSyncAfterSend,
  decideRemoteRevoke,
  EKEY_RECEIVER_PLAN_ONLY_MESSAGE,
  EKEY_RECEIVER_REQUIRED_MESSAGE,
  LOCK_MISSING_PLAN_HINT,
  maskReceiver,
  parseBusinessDateTimeToUtc,
  permissionToAccessKind,
  permissionToCredentialType,
  resolveAccessEffectiveStatus,
  resolveEkeyReceiver,
  type AccessEffectiveUiStatus,
} from "@/lib/api-server/ttlock/access-effective";
import { isTtlockConfigured } from "@/lib/api-server/ttlock/config";

export { ACCESS_EFFECTIVE_UI_LABELS, LOCK_MISSING_PLAN_HINT };
export type { AccessEffectiveUiStatus };

export type AccessDeliveryPublic = {
  hasCredential: boolean;
  syncStatus: string | null;
  externalAccessId: string | null;
  sentAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lockId: string | null;
  lockName: string | null;
  lockExternalId: string | null;
  receiverMasked: string | null;
  lockMissingHint: string | null;
};

export type AccessGrantPublic = {
  id: string;
  propertyId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string | null;
  permissionType: string;
  accessKind: "passcode" | "ekey" | "other";
  validFrom: string;
  validTo: string;
  status: "planned" | "cancelled";
  notes: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  effectiveStatus: AccessEffectiveUiStatus;
  effectiveLabel: string;
  delivery: AccessDeliveryPublic;
  oneTimePasscode?: string;
  syncOutcome?: "planned_only" | "synced" | "failed_keep_plan";
  userMessage?: string;
};

async function loadGrantBundle(propertyId: string, grantId: string) {
  return prisma.roomAccessGrant.findFirst({
    where: { id: grantId, propertyId },
    include: {
      tenant: {
        select: { id: true, fullName: true, phone: true, email: true },
      },
      ttlockCredential: true,
      property: { select: { id: true, title: true } },
    },
  });
}

async function loadRoomLock(propertyId: string) {
  const settings = await prisma.roomLockSettings.findUnique({
    where: { propertyId },
  });
  if (!settings?.ttlockCachedLockId) return null;
  const lock = await prisma.ttlockCachedLock.findUnique({
    where: { id: settings.ttlockCachedLockId },
  });
  if (!lock) return null;
  return { settings, lock };
}

export function mapGrantToPublic(
  grant: {
    id: string;
    propertyId: string;
    tenantId: string;
    permissionType: string;
    validFrom: Date | null;
    validTo: Date | null;
    status: string;
    notes: string | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    tenant?: {
      fullName: string;
      phone: string | null;
      email?: string | null;
    } | null;
    ttlockCredential?: TtlockAccessCredentialRow | null;
  },
  extras?: {
    lockName?: string | null;
    lockExternalId?: string | null;
    receiverMasked?: string | null;
    now?: Date;
    oneTimePasscode?: string;
    syncOutcome?: AccessGrantPublic["syncOutcome"];
    userMessage?: string;
  }
): AccessGrantPublic {
  const cred = grant.ttlockCredential ?? null;
  const hasCredential = Boolean(cred);
  const effectiveStatus = resolveAccessEffectiveStatus({
    grantStatus: grant.status,
    grantRevokedAt: grant.revokedAt,
    validFrom: grant.validFrom,
    validTo: grant.validTo,
    syncStatus: cred?.syncStatus ?? null,
    hasCredential,
    now: extras?.now,
  });

  const lockMissing =
    !hasCredential &&
    grant.status === "PLANNED" &&
    effectiveStatus === "REJALASHTIRILGAN";

  return {
    id: grant.id,
    propertyId: grant.propertyId,
    tenantId: grant.tenantId,
    tenantName: grant.tenant?.fullName ?? "",
    tenantPhone: grant.tenant?.phone ?? "",
    tenantEmail: grant.tenant?.email ?? null,
    permissionType: grant.permissionType.toLowerCase(),
    accessKind: permissionToAccessKind(grant.permissionType),
    validFrom: grant.validFrom?.toISOString() ?? "",
    validTo: grant.validTo?.toISOString() ?? "",
    status: grant.status === "CANCELLED" ? "cancelled" : "planned",
    notes: grant.notes ?? "",
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
    updatedAt: grant.updatedAt.toISOString(),
    effectiveStatus,
    effectiveLabel: ACCESS_EFFECTIVE_UI_LABELS[effectiveStatus],
    delivery: {
      hasCredential,
      syncStatus: cred?.syncStatus ?? null,
      externalAccessId: cred?.externalAccessId ?? null,
      sentAt: cred?.sentAt?.toISOString() ?? null,
      lastErrorCode: cred?.lastErrorCode ?? null,
      lastErrorMessage: cred?.lastErrorMessage ?? null,
      lockId: cred?.ttlockCachedLockId ?? null,
      lockName: extras?.lockName ?? null,
      lockExternalId: extras?.lockExternalId ?? null,
      receiverMasked: extras?.receiverMasked ?? null,
      lockMissingHint: lockMissing ? LOCK_MISSING_PLAN_HINT : null,
    },
    ...(extras?.oneTimePasscode
      ? { oneTimePasscode: extras.oneTimePasscode }
      : {}),
    ...(extras?.syncOutcome ? { syncOutcome: extras.syncOutcome } : {}),
    ...(extras?.userMessage ? { userMessage: extras.userMessage } : {}),
  };
}

async function assertTenantOnRoom(propertyId: string, tenantId: string) {
  const contract = await prisma.contract.findFirst({
    where: {
      propertyId,
      tenantId,
      status: { in: ["ACTIVE", "PENDING", "EXPIRED"] },
    },
  });
  if (!contract) {
    throw new TtlockError(
      "Arendator ushbu xonaga tegishli shartnomada topilmadi",
      "TTLOCK_FORBIDDEN",
      400
    );
  }
  return contract;
}

export async function claimCredentialForSync(
  roomAccessGrantId: string
): Promise<TtlockAccessCredentialRow | "already_sent" | null> {
  const existing = await prisma.$queryRawUnsafe<TtlockAccessCredentialRow[]>(
    `SELECT * FROM "ttlock_access_credentials" WHERE "roomAccessGrantId" = $1 LIMIT 1`,
    roomAccessGrantId
  );
  const row = existing[0];
  if (!row) return null;

  const decision = classifyCredentialForSyncClaim({
    externalAccessId: row.externalAccessId,
    syncStatus: row.syncStatus,
    lastErrorCode: row.lastErrorCode,
  });
  if (decision === "already_sent") return "already_sent";
  if (decision === "unknown_result") {
    throw new TtlockError(
      "TTLock javobi tasdiqlanmadi. Dublikat yaratmaslik uchun avtomatik qayta yuborilmadi.",
      "TTLOCK_RESULT_UNKNOWN",
      409
    );
  }
  if (decision === "in_flight") {
    throw new TtlockError(
      "TTLock’ga yuborish allaqachon jarayonda",
      "TTLOCK_API_ERROR",
      409
    );
  }

  const updated = await prisma.$queryRawUnsafe<TtlockAccessCredentialRow[]>(
    `UPDATE "ttlock_access_credentials"
     SET "syncStatus" = 'PENDING_SYNC'::"TtlockAccessSyncStatus",
         "lastErrorCode" = NULL,
         "lastErrorMessage" = NULL,
         "updatedAt" = $2
     WHERE "id" = $1
       AND "externalAccessId" IS NULL
       AND "syncStatus"::text IN ('PLANNED', 'FAILED')
     RETURNING *`,
    row.id,
    new Date()
  );
  if (!updated[0]) {
    const again = await prisma.$queryRawUnsafe<TtlockAccessCredentialRow[]>(
      `SELECT * FROM "ttlock_access_credentials" WHERE "id" = $1 LIMIT 1`,
      row.id
    );
    const againDecision = again[0]
      ? classifyCredentialForSyncClaim({
          externalAccessId: again[0].externalAccessId,
          syncStatus: again[0].syncStatus,
          lastErrorCode: again[0].lastErrorCode,
        })
      : null;
    if (againDecision === "already_sent") return "already_sent";
    if (againDecision === "in_flight") {
      throw new TtlockError(
        "TTLock’ga yuborish allaqachon jarayonda",
        "TTLOCK_API_ERROR",
        409
      );
    }
    return null;
  }
  return updated[0];
}

async function ensureCredentialShell(input: {
  grantId: string;
  connectionId: string;
  lockId: string;
  accessType: "PASSCODE" | "EKEY";
}) {
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "ttlock_access_credentials" WHERE "roomAccessGrantId" = $1 LIMIT 1`,
    input.grantId
  );
  if (existing[0]) return existing[0].id;

  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ttlock_access_credentials" (
      "id", "roomAccessGrantId", "connectionId", "ttlockCachedLockId",
      "accessType", "syncStatus", "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5::"TtlockAccessCredentialType",'PLANNED'::"TtlockAccessSyncStatus",$6,$7)`,
    id,
    input.grantId,
    input.connectionId,
    input.lockId,
    input.accessType,
    now,
    now
  );
  return id;
}

async function markCredentialFailed(
  credentialId: string,
  code: string,
  message: string
) {
  await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_access_credentials"
     SET "syncStatus" = 'FAILED'::"TtlockAccessSyncStatus",
         "lastErrorCode" = $2,
         "lastErrorMessage" = $3,
         "updatedAt" = $4
     WHERE "id" = $1`,
    credentialId,
    code,
    message.slice(0, 280),
    new Date()
  );
}

async function markCredentialSent(input: {
  credentialId: string;
  externalAccessId: string;
  credentialEncrypted: string | null;
  syncStatus: "SENT" | "ACTIVE" | "EXPIRED";
}) {
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_access_credentials"
     SET "syncStatus" = $2::"TtlockAccessSyncStatus",
         "externalAccessId" = $3,
         "credentialEncrypted" = COALESCE($4, "credentialEncrypted"),
         "sentAt" = COALESCE("sentAt", $5),
         "lastSyncedAt" = $5,
         "lastErrorCode" = NULL,
         "lastErrorMessage" = NULL,
         "updatedAt" = $5
     WHERE "id" = $1`,
    input.credentialId,
    input.syncStatus,
    input.externalAccessId,
    input.credentialEncrypted,
    now
  );
}

export async function createRoomAccessGrantPlan(input: {
  user: User;
  propertyId: string;
  tenantId: string;
  permissionType: string;
  validFromRaw: unknown;
  validToRaw: unknown;
  notes?: string | null;
  autoSync?: boolean;
}): Promise<AccessGrantPublic> {
  assertTtlockOwnerRole(input.user);
  await assertTenantOnRoom(input.propertyId, input.tenantId);

  const validFrom = parseBusinessDateTimeToUtc(
    input.validFromRaw == null ? null : String(input.validFromRaw)
  );
  const validTo = parseBusinessDateTimeToUtc(
    input.validToRaw == null ? null : String(input.validToRaw)
  );
  const windowMsg = assertValidFromBeforeTo(validFrom, validTo);
  if (windowMsg) {
    throw new TtlockError(windowMsg, "TTLOCK_API_ERROR", 400);
  }

  const credType = permissionToCredentialType(input.permissionType);
  let ekeyReceiverMissing = false;
  if (credType === "EKEY") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    const receiver = resolveEkeyReceiver(tenant ?? {});
    ekeyReceiverMissing = !receiver.ok;
  }

  const permissionUpper = String(input.permissionType ?? "PIN").toUpperCase();
  const allowed = ["PIN", "APP", "CARD", "PERMANENT", "TEMPORARY"] as const;
  const permissionType = allowed.includes(
    permissionUpper as (typeof allowed)[number]
  )
    ? (permissionUpper as (typeof allowed)[number])
    : "PIN";

  const row = await prisma.roomAccessGrant.create({
    data: {
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      permissionType,
      validFrom,
      validTo,
      status: "PLANNED",
      notes: input.notes?.trim() || null,
    },
    include: {
      tenant: { select: { fullName: true, phone: true, email: true } },
      ttlockCredential: true,
    },
  });

  const roomLock = await loadRoomLock(input.propertyId);
  if (!roomLock || !credType) {
    return mapGrantToPublic(row, {
      syncOutcome: "planned_only",
      userMessage: roomLock
        ? "Kirish huquqi rejalashtirildi."
        : "Reja saqlandi. Qulf biriktirilmagani sababli qurilmaga yuborilmadi.",
    });
  }

  // Receiver yo‘q: grant DB’da qoladi, TTLock API chaqirilmaydi
  if (ekeyReceiverMissing) {
    return mapGrantToPublic(row, {
      lockName: roomLock.lock.name,
      lockExternalId: roomLock.lock.externalLockId,
      syncOutcome: "planned_only",
      userMessage: EKEY_RECEIVER_PLAN_ONLY_MESSAGE,
    });
  }

  if (input.autoSync === false) {
    return mapGrantToPublic(row, {
      lockName: roomLock.lock.name,
      lockExternalId: roomLock.lock.externalLockId,
      syncOutcome: "planned_only",
      userMessage: "Kirish huquqi rejalashtirildi.",
    });
  }

  try {
    return await syncGrantToTtlock({
      user: input.user,
      propertyId: input.propertyId,
      grantId: row.id,
    });
  } catch (err) {
    const refreshed = await loadGrantBundle(input.propertyId, row.id);
    return mapGrantToPublic(refreshed ?? row, {
      lockName: roomLock.lock.name,
      lockExternalId: roomLock.lock.externalLockId,
      syncOutcome: "failed_keep_plan",
      userMessage:
        err instanceof TtlockError
          ? err.message
          : "TTLock xizmatida xatolik yuz berdi. Reja bazada saqlandi.",
    });
  }
}

export async function syncGrantToTtlock(input: {
  user: User;
  propertyId: string;
  grantId: string;
}): Promise<AccessGrantPublic> {
  assertTtlockOwnerRole(input.user);
  await requireTtlockDb();

  const grant = await loadGrantBundle(input.propertyId, input.grantId);
  if (!grant) {
    throw new TtlockError(
      "Kirish huquqi topilmadi",
      "TTLOCK_LOCK_NOT_FOUND",
      404
    );
  }
  if (grant.status === "CANCELLED") {
    throw new TtlockError(
      "Bekor qilingan reja yuborilmaydi",
      "TTLOCK_API_ERROR",
      400
    );
  }

  const credType = permissionToCredentialType(grant.permissionType);
  if (!credType) {
    throw new TtlockError(
      "Bu ruxsat turi TTLock’ga yuborilmaydi",
      "TTLOCK_API_ERROR",
      400
    );
  }

  if (!isTtlockConfigured()) {
    throw new TtlockError(
      "TTLock API hali sozlanmagan. Reja saqlandi, qurilmaga yuborilmadi.",
      "TTLOCK_NOT_CONFIGURED",
      503
    );
  }

  const connection = await findConnectionByOwner(input.user.id);
  if (!connection?.accessTokenEncrypted) {
    throw new TtlockError(
      "TTLock hisobi ulanmagan. Reja qurilmaga yuborilmadi.",
      "TTLOCK_NOT_CONNECTED",
      400
    );
  }

  const roomLock = await loadRoomLock(input.propertyId);
  if (!roomLock) {
    throw new TtlockError(
      "Xonaga TTLock qulfi biriktirilmagan.",
      "TTLOCK_ROOM_LOCK_MISSING",
      400
    );
  }
  if (!roomLock.lock.isActive) {
    throw new TtlockError(
      "Biriktirilgan qulf TTLock hisobida faol emas.",
      "TTLOCK_LOCK_INACTIVE",
      400
    );
  }
  if (roomLock.lock.connectionId !== connection.id) {
    throw new TtlockError("Qulf topilmadi", "TTLOCK_LOCK_NOT_FOUND", 404);
  }

  if (
    grant.ttlockCredential &&
    grant.ttlockCredential.ttlockCachedLockId !== roomLock.lock.id &&
    grant.ttlockCredential.externalAccessId
  ) {
    throw new TtlockError(
      "Mavjud kirish huquqi boshqa qulfga yuborilgan. Avval bekor qiling.",
      "TTLOCK_API_ERROR",
      409
    );
  }

  await ensureCredentialShell({
    grantId: grant.id,
    connectionId: connection.id,
    lockId: roomLock.lock.id,
    accessType: credType,
  });

  const claimed = await claimCredentialForSync(grant.id);
  if (claimed === "already_sent") {
    const refreshed = await loadGrantBundle(input.propertyId, grant.id);
    return mapGrantToPublic(refreshed!, {
      lockName: roomLock.lock.name,
      lockExternalId: roomLock.lock.externalLockId,
      syncOutcome: "synced",
      userMessage: "Kirish huquqi TTLock’ga muvaffaqiyatli yuborildi.",
    });
  }
  if (!claimed) {
    throw new TtlockError(
      "TTLock’ga yuborishni boshlab bo‘lmadi",
      "TTLOCK_API_ERROR",
      500
    );
  }

  const validFrom = grant.validFrom ?? new Date();
  const validTo =
    grant.validTo ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  let oneTimePasscode: string | undefined;
  let receiverMasked: string | null = null;

  try {
    const accessToken = await getValidAccessToken(connection, input.user.id);

    if (credType === "PASSCODE") {
      const created = await createKeyboardPwd({
        accessToken,
        lockId: roomLock.lock.externalLockId,
        startDateMs: validFrom.getTime(),
        endDateMs: validTo.getTime(),
        keyboardPwdType: 3,
      });
      oneTimePasscode = created.keyboardPwd;
      const { credentialEncrypted } = encryptAccessCredential(
        created.keyboardPwd
      );
      const syncStatus = derivePersistedSyncAfterSend({
        validFrom: grant.validFrom,
        validTo: grant.validTo,
      });
      await markCredentialSent({
        credentialId: claimed.id,
        externalAccessId: created.keyboardPwdId,
        credentialEncrypted,
        syncStatus,
      });
    } else {
      const receiver = resolveEkeyReceiver(grant.tenant ?? {});
      if (!receiver.ok) {
        throw new TtlockError(
          EKEY_RECEIVER_REQUIRED_MESSAGE,
          "TTLOCK_RECEIVER_REQUIRED",
          400
        );
      }
      receiverMasked = maskReceiver(receiver.receiver);
      const sent = await sendEkey({
        accessToken,
        lockId: roomLock.lock.externalLockId,
        receiverUsername: receiver.receiver,
        keyName: `${grant.tenant?.fullName ?? "Arendator"}`.slice(0, 40),
        startDateMs: validFrom.getTime(),
        endDateMs: validTo.getTime(),
      });
      const syncStatus = derivePersistedSyncAfterSend({
        validFrom: grant.validFrom,
        validTo: grant.validTo,
      });
      await markCredentialSent({
        credentialId: claimed.id,
        externalAccessId: sent.keyId,
        credentialEncrypted: null,
        syncStatus,
      });
    }
  } catch (err) {
    if (
      err instanceof TtlockError &&
      (err.code === "TTLOCK_TIMEOUT" || err.code === "TTLOCK_HTTP_ERROR")
    ) {
      await markCredentialFailed(
        claimed.id,
        "TTLOCK_RESULT_UNKNOWN",
        "TTLock javobi tasdiqlanmadi. Dublikat yaratmaslik uchun avtomatik qayta yuborilmadi."
      );
      throw new TtlockError(
        "TTLock javobi tasdiqlanmadi. Dublikat yaratmaslik uchun avtomatik qayta yuborilmadi.",
        "TTLOCK_RESULT_UNKNOWN",
        502
      );
    }
    const code = err instanceof TtlockError ? err.code : "TTLOCK_UNKNOWN";
    const msg =
      err instanceof TtlockError
        ? err.message
        : "TTLock xizmatida xatolik yuz berdi. Reja bazada saqlandi.";
    await markCredentialFailed(claimed.id, code, msg);
    throw err instanceof TtlockError
      ? err
      : new TtlockError(msg, "TTLOCK_UNKNOWN", 502);
  }

  const refreshed = await loadGrantBundle(input.propertyId, grant.id);
  return mapGrantToPublic(refreshed!, {
    lockName: roomLock.lock.name,
    lockExternalId: roomLock.lock.externalLockId,
    receiverMasked,
    oneTimePasscode,
    syncOutcome: "synced",
    userMessage: "Kirish huquqi TTLock’ga muvaffaqiyatli yuborildi.",
  });
}

export async function revokeAccessGrant(input: {
  user: User;
  propertyId: string;
  grantId: string;
}): Promise<AccessGrantPublic> {
  assertTtlockOwnerRole(input.user);

  const grant = await loadGrantBundle(input.propertyId, input.grantId);
  if (!grant) {
    throw new TtlockError(
      "Kirish huquqi topilmadi",
      "TTLOCK_LOCK_NOT_FOUND",
      404
    );
  }

  // Idempotent: allaqachon bekor
  if (grant.status === "CANCELLED" && grant.ttlockCredential?.syncStatus === "REVOKED") {
    return mapGrantToPublic(grant, {
      userMessage: "Kirish huquqi bekor qilindi.",
    });
  }
  if (grant.status === "CANCELLED" && !grant.ttlockCredential?.externalAccessId) {
    return mapGrantToPublic(grant, {
      userMessage: "Kirish huquqi bekor qilindi.",
    });
  }

  const cred = grant.ttlockCredential;
  const now = new Date();

  const revokeKind = decideRemoteRevoke({
    externalAccessId: cred?.externalAccessId,
    accessType: cred?.accessType,
  });

  // Yuborilmagan — faqat local (TTLock API chaqirilmaydi)
  if (revokeKind === "local_only") {
    if (cred) {
      await prisma.$executeRawUnsafe(
        `UPDATE "ttlock_access_credentials"
         SET "syncStatus" = 'REVOKED'::"TtlockAccessSyncStatus",
             "revokedAt" = $2, "updatedAt" = $2
         WHERE "id" = $1`,
        cred.id,
        now
      );
    }
    const row = await prisma.roomAccessGrant.update({
      where: { id: grant.id },
      data: { status: "CANCELLED", revokedAt: grant.revokedAt ?? now },
      include: {
        tenant: { select: { fullName: true, phone: true, email: true } },
        ttlockCredential: true,
      },
    });
    return mapGrantToPublic(row, {
      userMessage: "Kirish huquqi bekor qilindi.",
    });
  }

  // Remote revoke
  await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_access_credentials"
     SET "syncStatus" = 'REVOKE_PENDING'::"TtlockAccessSyncStatus",
         "updatedAt" = $2
     WHERE "id" = $1`,
    cred!.id,
    now
  );

  try {
    await requireTtlockDb();
    const connection = await findConnectionByOwner(input.user.id);
    if (!connection?.accessTokenEncrypted) {
      throw new TtlockError(
        "TTLock hisobi ulanmagan.",
        "TTLOCK_NOT_CONNECTED",
        400
      );
    }
    const accessToken = await getValidAccessToken(connection, input.user.id);
    const lock = await prisma.ttlockCachedLock.findUnique({
      where: { id: cred!.ttlockCachedLockId },
    });
    if (!lock) {
      throw new TtlockError("Qulf topilmadi", "TTLOCK_LOCK_NOT_FOUND", 404);
    }

    if (revokeKind === "remote_passcode") {
      await deleteKeyboardPwd({
        accessToken,
        lockId: lock.externalLockId,
        keyboardPwdId: cred!.externalAccessId!,
        deleteType: 2,
      });
    } else {
      await deleteEkey({
        accessToken,
        keyId: cred!.externalAccessId!,
      });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_access_credentials"
       SET "syncStatus" = 'REVOKED'::"TtlockAccessSyncStatus",
           "revokedAt" = $2,
           "lastErrorCode" = NULL,
           "lastErrorMessage" = NULL,
           "updatedAt" = $2
       WHERE "id" = $1`,
      cred!.id,
      now
    );
    const row = await prisma.roomAccessGrant.update({
      where: { id: grant.id },
      data: { status: "CANCELLED", revokedAt: grant.revokedAt ?? now },
      include: {
        tenant: { select: { fullName: true, phone: true, email: true } },
        ttlockCredential: true,
      },
    });
    return mapGrantToPublic(row, {
      userMessage: "Kirish huquqi bekor qilindi.",
    });
  } catch (err) {
    const code = err instanceof TtlockError ? err.code : "TTLOCK_UNKNOWN";
    const msg =
      err instanceof TtlockError
        ? err.message
        : "Kirish huquqini TTLock’da bekor qilib bo‘lmadi. Qayta urinib ko‘ring.";
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_access_credentials"
       SET "syncStatus" = 'FAILED'::"TtlockAccessSyncStatus",
           "lastErrorCode" = $2,
           "lastErrorMessage" = $3,
           "updatedAt" = $4
       WHERE "id" = $1`,
      cred!.id,
      code,
      msg.slice(0, 280),
      new Date()
    );
    throw new TtlockError(
      "Kirish huquqini TTLock’da bekor qilib bo‘lmadi. Qayta urinib ko‘ring.",
      code === "TTLOCK_RATE_LIMITED" ? "TTLOCK_RATE_LIMITED" : "TTLOCK_API_ERROR",
      502
    );
  }
}

export async function listRoomAccessGrantsPublic(
  propertyId: string
): Promise<AccessGrantPublic[]> {
  const rows = await prisma.roomAccessGrant.findMany({
    where: { propertyId },
    include: {
      tenant: { select: { fullName: true, phone: true, email: true } },
      ttlockCredential: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const roomLock = await loadRoomLock(propertyId);
  return rows.map((row) => {
    const cred = row.ttlockCredential;
    const lockMatchesCurrent =
      cred &&
      roomLock &&
      cred.ttlockCachedLockId === roomLock.lock.id;
    return mapGrantToPublic(row, {
      lockName: lockMatchesCurrent
        ? roomLock.lock.name
        : cred
          ? "(eski qulf)"
          : roomLock?.lock.name ?? null,
      lockExternalId: lockMatchesCurrent
        ? roomLock.lock.externalLockId
        : null,
    });
  });
}
