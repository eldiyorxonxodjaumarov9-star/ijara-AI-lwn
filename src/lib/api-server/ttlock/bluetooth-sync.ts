import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { findConnectionByOwner } from "@/lib/api-server/ttlock/db";
import { assertTtlockOwnerRole, getValidAccessToken } from "@/lib/api-server/ttlock/service";
import { fetchAllLocks } from "@/lib/api-server/ttlock/client";
import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { decryptAccessCredential } from "@/lib/api-server/ttlock/persistence";

const SESSION_TTL_MS = 10 * 60 * 1000;

export function generateRandomKeyboardPin() {
  return String(randomInt(100000, 1000000));
}

export function accessWindowsOverlap(
  left: { start: Date; end: Date },
  right: { start: Date; end: Date }
) {
  return left.start.getTime() < right.end.getTime() && right.start.getTime() < left.end.getTime();
}

export type BluetoothSyncSessionPublic = {
  sessionId: string;
  roomId: string;
  lockId: string;
  lockMac: string | null;
  lockModel: string | null;
  keyboardPwdVersion: number | null;
  sessionToken: string;
  expiresAt: string;
  entries: Array<{
    entryId: string;
    credentialReference: string;
    startDate: string;
    endDate: string;
    status: "READY_FOR_BLUETOOTH";
  }>;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function capabilityValue(capabilities: unknown, key: string) {
  if (!capabilities || typeof capabilities !== "object") return null;
  const value = (capabilities as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : null;
}

export function supportsBluetoothTimedPin(input: {
  model: string | null;
  capabilities: unknown;
  rawSafe: unknown;
}) {
  const versions = [
    capabilityValue(input.capabilities, "keyboardPwdVersion"),
    capabilityValue(input.rawSafe, "keyboardPwdVersion"),
  ];
  return versions.some((value) => String(value ?? "") === "4");
}

async function loadBluetoothRoom(propertyId: string, user: User) {
  const found = await findLwnPropertyOrFail(propertyId, user);
  if ("error" in found && found.error) throw new TtlockError("Xonaga ruxsat yo'q", "TTLOCK_FORBIDDEN", 403);
  const connection = await findConnectionByOwner(user.id);
  if (!connection) {
    throw new TtlockError("TTLock hisobi ulanmagan.", "TTLOCK_NOT_CONNECTED", 400);
  }

  const rows = await prisma.$queryRawUnsafe<Array<{
    propertyId: string;
    lockId: string;
    externalLockId: string;
    model: string | null;
    capabilities: unknown;
    rawSafe: unknown;
    connectionId: string;
    mac: string | null;
  }>>(
    `SELECT p."id" AS "propertyId", l."id" AS "lockId",
            l."externalLockId", l."model", l."capabilities", l."rawSafe",
            l."connectionId", l."mac"
       FROM "properties" p
       JOIN "room_lock_settings" r ON r."propertyId" = p."id"
       JOIN "ttlock_cached_locks" l ON l."id" = r."ttlockCachedLockId"
      WHERE p."id" = $1 AND l."connectionId" = $2 AND l."isActive" = true
      LIMIT 1`,
    propertyId,
    connection.id
  );
  const room = rows[0];
  if (!room) {
    throw new TtlockError("Xonaga faol TTLock qulfi biriktirilmagan.", "TTLOCK_ROOM_LOCK_MISSING", 400);
  }
  if (!supportsBluetoothTimedPin(room)) {
    throw new TtlockError(
      "Bluetooth timed PIN unsupported: qulf V4 passcode capability talab qiladi.",
      "BLUETOOTH_TIMED_PIN_UNSUPPORTED",
      400
    );
  }
  return room;
}

export async function createBluetoothSyncSession(input: {
  user: User;
  propertyId: string;
}): Promise<BluetoothSyncSessionPublic> {
  assertTtlockOwnerRole(input.user);
  const room = await loadBluetoothRoom(input.propertyId, input.user);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const sessionId = randomUUID();
  const sessionToken = randomBytes(32).toString("base64url");

  return prisma.$transaction(async (tx) => {
  await tx.$queryRawUnsafe(`SELECT "id" FROM "ttlock_cached_locks" WHERE "id" = $1 FOR UPDATE`, room.lockId);
  const active = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "ttlock_bluetooth_sync_sessions" WHERE "ttlockCachedLockId" = $1
     AND "expiresAt" > $2 AND "status" IN ('CREATED', 'SYNCING')`, room.lockId, now);
  if (active.length) throw new TtlockError("Bluetooth session already in progress", "TTLOCK_COMMAND_IN_PROGRESS", 409);
  const credentials = await tx.$queryRawUnsafe<Array<{
    id: string;
    validFrom: Date;
    validTo: Date;
  }>>(
    `SELECT c."id", g."validFrom", g."validTo"
       FROM "ttlock_access_credentials" c
       JOIN "room_access_grants" g ON g."id" = c."roomAccessGrantId"
      WHERE g."propertyId" = $1
        AND c."ttlockCachedLockId" = $2
        AND c."connectionId" = $3
        AND c."accessType" = 'PASSCODE'::"TtlockAccessCredentialType"
        AND c."transport" = 'LOCAL_BLUETOOTH'::"TtlockTransport"
        AND c."credentialEncrypted" IS NOT NULL
        AND COALESCE(c."lastErrorCode", '') NOT IN ('BLUETOOTH_RESULT_UNKNOWN', 'BLUETOOTH_CANCELLED')
        AND g."status" = 'PLANNED'::"RoomAccessGrantStatus"
        AND g."validFrom" IS NOT NULL
        AND g."validTo" IS NOT NULL
        AND c."syncStatus" IN ('PLANNED'::"TtlockAccessSyncStatus", 'READY_FOR_BLUETOOTH'::"TtlockAccessSyncStatus", 'BLUETOOTH_SYNC_FAILED'::"TtlockAccessSyncStatus")
        AND (g."validTo" IS NULL OR g."validTo" > $4)
      ORDER BY g."validFrom" ASC, c."createdAt" ASC`,
    input.propertyId,
    room.lockId,
    room.connectionId,
    now
  );
  if (credentials.length === 0) {
    throw new TtlockError("Bluetooth uchun tayyor vaqtli PIN topilmadi.", "TTLOCK_BLUETOOTH_QUEUE_EMPTY", 400);
  }

  await tx.$executeRawUnsafe(
    `INSERT INTO "ttlock_bluetooth_sync_sessions"
      ("id", "ownerUserId", "propertyId", "ttlockCachedLockId", "tokenHash", "status", "expiresAt", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,'CREATED'::"TtlockBluetoothSessionStatus",$6,$7,$7)`,
    sessionId,
    input.user.id,
    input.propertyId,
    room.lockId,
    hashSessionToken(sessionToken),
    expiresAt,
    now
  );

  const entries = [];
  for (const credential of credentials) {
    const entryId = randomUUID();
    await tx.$executeRawUnsafe(
      `INSERT INTO "ttlock_bluetooth_sync_entries"
        ("id", "sessionId", "credentialId", "status", "validFrom", "validTo", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'READY_FOR_BLUETOOTH'::"TtlockBluetoothEntryStatus",$4,$5,$6,$6)`,
      entryId,
      sessionId,
      credential.id,
      credential.validFrom,
      credential.validTo,
      now
    );
    await tx.$executeRawUnsafe(
      `UPDATE "ttlock_access_credentials"
          SET "syncStatus" = 'READY_FOR_BLUETOOTH'::"TtlockAccessSyncStatus", "updatedAt" = $2
        WHERE "id" = $1 AND "externalAccessId" IS NULL`,
      credential.id,
      now
    );
    entries.push({
      entryId,
      credentialReference: credential.id,
      startDate: credential.validFrom.toISOString(),
      endDate: credential.validTo.toISOString(),
      status: "READY_FOR_BLUETOOTH" as const,
    });
  }

  return {
    sessionId,
    roomId: input.propertyId,
    lockId: room.externalLockId,
    lockMac: room.mac,
    lockModel: room.model,
    keyboardPwdVersion:
      typeof capabilityValue(room.capabilities, "keyboardPwdVersion") === "number"
        ? Number(capabilityValue(room.capabilities, "keyboardPwdVersion"))
        : null,
    sessionToken,
    expiresAt: expiresAt.toISOString(),
    entries,
  };
  });
}

export function validateBluetoothResult(input: { success: boolean; sdkCallbackReceived: boolean }) {
  if (input.success && !input.sdkCallbackReceived) {
    throw new TtlockError("Real SDK success callback required", "TTLOCK_BLUETOOTH_SDK_FAILED", 400);
  }
}

export async function recordBluetoothSyncResult(input: {
  user: User; sessionToken: string; entryId: string; success: boolean;
  sdkCallbackReceived: boolean; errorCode?: string; errorMessage?: string;
}) {
  assertTtlockOwnerRole(input.user);
  validateBluetoothResult(input);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{
      sessionId: string; credentialId: string; entryStatus: string; deliveredAt: Date | null;
    }>>(
      `SELECT s."id" AS "sessionId", e."credentialId", e."status" AS "entryStatus",
              e."credentialDeliveredAt" AS "deliveredAt"
       FROM "ttlock_bluetooth_sync_sessions" s
       JOIN "ttlock_bluetooth_sync_entries" e ON e."sessionId" = s."id"
       WHERE s."tokenHash" = $1 AND e."id" = $2 AND s."ownerUserId" = $3
       AND s."expiresAt" > NOW() AND s."status" = 'SYNCING'
       FOR UPDATE OF s, e`, hashSessionToken(input.sessionToken), input.entryId, input.user.id);
    const row = rows[0];
    if (!row || !["READY_FOR_BLUETOOTH", "BLUETOOTH_SYNCING"].includes(row.entryStatus) ||
        (input.success && (row.entryStatus !== "BLUETOOTH_SYNCING" || !row.deliveredAt))) {
      throw new TtlockError("Bluetooth result replay or invalid state", "TTLOCK_BLUETOOTH_SESSION_EXPIRED", 409);
    }
    const status = input.success ? "INSTALLED_ON_LOCK" : "BLUETOOTH_SYNC_FAILED";
    // SDK text can contain secrets; persist only symbolic error codes.
    const code = input.success ? null : (/^(?:TTLOCK_|BLUETOOTH_)[A-Z_]{1,80}$/.test(input.errorCode ?? "")
      ? input.errorCode! : "TTLOCK_BLUETOOTH_SDK_FAILED");
    const message = input.success ? null : "Bluetooth bridge operation failed; inspect safe error code.";
    await tx.$executeRawUnsafe(
      `UPDATE "ttlock_bluetooth_sync_entries" SET "status" = $2::"TtlockBluetoothEntryStatus",
       "installedAt" = CASE WHEN $3 THEN NOW() ELSE NULL END, "lastErrorCode" = $4,
       "lastErrorMessage" = $5, "updatedAt" = NOW() WHERE "id" = $1`,
      input.entryId, status, input.success, code, message);
    await tx.$executeRawUnsafe(
      `UPDATE "ttlock_access_credentials" SET "syncStatus" = $2::"TtlockAccessSyncStatus",
       "lastSyncedAt" = CASE WHEN $3 THEN NOW() ELSE "lastSyncedAt" END,
       "lastErrorCode" = $4, "lastErrorMessage" = $5, "updatedAt" = NOW() WHERE "id" = $1`,
      row.credentialId, status, input.success, code, message);
    await tx.$executeRawUnsafe(
      `UPDATE "ttlock_bluetooth_sync_sessions" s SET "status" = 'COMPLETED', "usedAt" = NOW(), "updatedAt" = NOW()
       WHERE s."id" = $1 AND NOT EXISTS (SELECT 1 FROM "ttlock_bluetooth_sync_entries" e
       WHERE e."sessionId" = s."id" AND e."status" IN ('READY_FOR_BLUETOOTH', 'BLUETOOTH_SYNCING'))`, row.sessionId);
    return { status };
  });
}

export async function deliverBluetoothLockContext(input: { user: User; sessionToken: string }) {
  assertTtlockOwnerRole(input.user);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; propertyId: string; lockId: string }>>(
    `SELECT "id", "propertyId", "ttlockCachedLockId" AS "lockId" FROM "ttlock_bluetooth_sync_sessions"
     WHERE "tokenHash" = $1 AND "ownerUserId" = $2 AND "status" = 'CREATED' AND "expiresAt" > NOW()`,
    hashSessionToken(input.sessionToken), input.user.id);
  const session = rows[0];
  if (!session) throw new TtlockError("Lock context already used or expired", "TTLOCK_BLUETOOTH_SESSION_EXPIRED", 409);
  const room = await loadBluetoothRoom(session.propertyId, input.user);
  if (room.lockId !== session.lockId) throw new TtlockError("Lock assignment changed", "TTLOCK_FORBIDDEN", 403);
  const connection = await findConnectionByOwner(input.user.id);
  if (!connection) throw new TtlockError("TTLock disconnected", "TTLOCK_NOT_CONNECTED", 400);
  const locks = await fetchAllLocks(await getValidAccessToken(connection, input.user.id));
  const lock = locks.find((item) => String(item.lockId) === room.externalLockId);
  if (!lock?.lockData || !lock.lockMac || !room.mac || lock.lockMac.toUpperCase() !== room.mac.toUpperCase()) {
    throw new TtlockError("Authenticated lockData / matching lock MAC unavailable", "TTLOCK_LOCK_NOT_FOUND", 409);
  }
  if (lock.keyboardPwdVersion !== 4) throw new TtlockError("Bluetooth timed PIN unsupported", "BLUETOOTH_TIMED_PIN_UNSUPPORTED", 400);
  const claimed = await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_bluetooth_sync_sessions" SET "status" = 'SYNCING', "updatedAt" = NOW()
     WHERE "id" = $1 AND "status" = 'CREATED' AND "expiresAt" > NOW()`, session.id);
  if (claimed !== 1) throw new TtlockError("Lock context already consumed", "TTLOCK_BLUETOOTH_SESSION_EXPIRED", 409);
  return { lockId: room.externalLockId, lockMac: lock.lockMac, lockData: lock.lockData,
    lockName: lock.lockAlias || lock.lockName || room.model || "TTLock", keyboardPwdVersion: lock.keyboardPwdVersion,
    serverTime: new Date().toISOString() };
}

export async function allocateLocalBluetoothPin(input: {
  lockId: string;
  start: Date;
  end: Date;
  requestedPin?: string | null;
}) {
  const rows = await prisma.$queryRawUnsafe<Array<{
    credentialEncrypted: string | null;
    validFrom: Date | null;
    validTo: Date | null;
  }>>(
    `SELECT c."credentialEncrypted", g."validFrom", g."validTo"
       FROM "ttlock_access_credentials" c
       JOIN "room_access_grants" g ON g."id" = c."roomAccessGrantId"
      WHERE c."ttlockCachedLockId" = $1
        AND c."accessType" = 'PASSCODE'::"TtlockAccessCredentialType"
        AND c."credentialEncrypted" IS NOT NULL
        AND c."syncStatus" NOT IN ('REVOKED'::"TtlockAccessSyncStatus", 'EXPIRED'::"TtlockAccessSyncStatus")
        AND g."validFrom" IS NOT NULL AND g."validTo" IS NOT NULL`,
    input.lockId
  );
  const used = rows.flatMap((row) => {
    if (!row.credentialEncrypted || !row.validFrom || !row.validTo) return [];
    if (!accessWindowsOverlap({ start: input.start, end: input.end }, { start: row.validFrom, end: row.validTo })) return [];
    try {
      return [decryptAccessCredential(row.credentialEncrypted)];
    } catch {
      return [];
    }
  });
  const requested = input.requestedPin?.trim();
  if (requested) {
    if (used.includes(requested)) {
      throw new TtlockError("Bu PIN shu qulfda bir-biriga ustma-ust tushadigan muddatda ishlatilgan.", "TTLOCK_PIN_INVALID", 409);
    }
    return requested;
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateRandomKeyboardPin();
    if (!used.includes(candidate)) return candidate;
  }
  throw new TtlockError("Unique Bluetooth PIN yaratib bo‘lmadi.", "TTLOCK_PIN_INVALID", 409);
}

export async function deliverBluetoothCredential(input: {
  user: User;
  sessionToken: string;
  entryId: string;
}) {
  assertTtlockOwnerRole(input.user);
  return prisma.$transaction(async (tx) => {
  const rows = await tx.$queryRawUnsafe<Array<{
    sessionId: string;
    credentialId: string;
    credentialEncrypted: string;
    validFrom: Date;
    validTo: Date;
    expiresAt: Date;
    sessionStatus: string;
    entryStatus: string;
  }>>(
    `SELECT s."id" AS "sessionId", s."expiresAt", s."status" AS "sessionStatus",
            e."status" AS "entryStatus", e."credentialId", e."validFrom", e."validTo",
            c."credentialEncrypted"
       FROM "ttlock_bluetooth_sync_sessions" s
       JOIN "ttlock_bluetooth_sync_entries" e ON e."sessionId" = s."id"
       JOIN "ttlock_access_credentials" c ON c."id" = e."credentialId"
       JOIN "room_access_grants" g ON g."id" = c."roomAccessGrantId"
      WHERE s."tokenHash" = $1 AND e."id" = $2 AND s."ownerUserId" = $3
        AND c."ttlockCachedLockId" = s."ttlockCachedLockId"
        AND g."propertyId" = s."propertyId" AND g."status" = 'PLANNED'
        AND g."validFrom" = e."validFrom" AND g."validTo" = e."validTo" AND g."validTo" > NOW()
        AND e."credentialDeliveredAt" IS NULL
        AND c."credentialEncrypted" IS NOT NULL
      FOR UPDATE OF s, e`,
    hashSessionToken(input.sessionToken),
    input.entryId,
    input.user.id
  );
  const row = rows[0];
  if (
    !row ||
    row.expiresAt <= new Date() ||
    row.sessionStatus !== "SYNCING" ||
    row.entryStatus !== "READY_FOR_BLUETOOTH"
  ) {
    throw new TtlockError(
      "Bluetooth credential session yaroqsiz, ishlatilgan yoki muddati tugagan.",
      "TTLOCK_BLUETOOTH_SESSION_EXPIRED",
      409
    );
  }
  const now = new Date();
  const claimed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "ttlock_bluetooth_sync_entries"
        SET "status" = 'BLUETOOTH_SYNCING'::"TtlockBluetoothEntryStatus",
            "credentialDeliveredAt" = $2, "updatedAt" = $2
      WHERE "id" = $1 AND "credentialDeliveredAt" IS NULL
        AND "status" = 'READY_FOR_BLUETOOTH'::"TtlockBluetoothEntryStatus"
      RETURNING "id"`,
    input.entryId,
    now
  );
  if (!claimed[0]) {
    throw new TtlockError("Bluetooth credential allaqachon berilgan.", "TTLOCK_BLUETOOTH_SESSION_EXPIRED", 409);
  }
  await tx.$executeRawUnsafe(
    `UPDATE "ttlock_access_credentials"
        SET "syncStatus" = 'BLUETOOTH_SYNCING'::"TtlockAccessSyncStatus", "updatedAt" = $2
      WHERE "id" = $1`,
    row.credentialId,
    now
  );
  return {
    entryId: input.entryId,
    credential: decryptAccessCredential(row.credentialEncrypted),
    startDate: row.validFrom.toISOString(),
    endDate: row.validTo.toISOString(),
  };
  });
}
