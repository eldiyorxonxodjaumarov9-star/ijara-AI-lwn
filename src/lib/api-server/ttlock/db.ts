/**
 * TTLock DB qatlami — raw SQL (prisma generate shart emas).
 * Organization yo‘q: connection User (admin/owner) scope’ida.
 * Schema o‘zgarishi faqat Prisma migration orqali — runtime DDL yo‘q.
 */

import { randomUUID } from "crypto";

import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import {
  mapOnlineStatus,
  normalizeBattery,
  softRemovePatch,
  toExternalIdString,
  ttlockGatewayUniqueKey,
  ttlockLockUniqueKey,
  type TtlockAccessCredentialType,
  type TtlockAccessSyncStatus,
  type TtlockDeviceOnlineStatus,
} from "@/lib/api-server/ttlock/persistence";
import type { TtlockConnectionStatus as PublicStatus } from "@/lib/api-server/ttlock/types";

/** Prisma schema enum: TtlockConnectionStatus */
const TTLOCK_CONNECTION_STATUSES = new Set<string>([
  "DISCONNECTED",
  "CONNECTED",
  "TOKEN_EXPIRED",
  "ERROR",
  "SYNCING",
]);

function assertTtlockConnectionStatus(status: string): void {
  if (!TTLOCK_CONNECTION_STATUSES.has(status)) {
    throw new TtlockError(
      "TTLock connection status noto'g'ri",
      "TTLOCK_DB_UNAVAILABLE",
      400
    );
  }
}

export { ttlockGatewayUniqueKey, ttlockLockUniqueKey };

export type TtlockConnectionRow = {
  id: string;
  ownerUserId: string;
  provider: string;
  status: string;
  ttlockUid: string | null;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  lastConnectedAt: Date | null;
  lastSyncedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TtlockGatewayRow = {
  id: string;
  connectionId: string;
  externalGatewayId: string;
  name: string | null;
  mac: string | null;
  onlineStatus: TtlockDeviceOnlineStatus;
  lastHeartbeatAt: Date | null;
  lastSyncedAt: Date | null;
  isActive: boolean;
  removedAt: Date | null;
  capabilities: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type TtlockCachedLockRow = {
  id: string;
  connectionId: string;
  externalLockId: string;
  name: string;
  mac: string | null;
  model: string | null;
  firmwareVersion: string | null;
  battery: number | null;
  hasGateway: boolean;
  remoteUnlock: boolean | null;
  passcodeCapable: boolean | null;
  eKeyCapable: boolean | null;
  online: boolean | null;
  onlineStatus: TtlockDeviceOnlineStatus;
  lastOnlineAt: Date | null;
  gatewayId: string | null;
  capabilities: unknown;
  rawSafe: unknown;
  lastSyncedAt: Date | null;
  isActive: boolean;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TtlockAccessCredentialRow = {
  id: string;
  roomAccessGrantId: string;
  connectionId: string;
  ttlockCachedLockId: string;
  accessType: TtlockAccessCredentialType;
  syncStatus: TtlockAccessSyncStatus;
  externalAccessId: string | null;
  credentialEncrypted: string | null;
  sentAt: Date | null;
  lastSyncedAt: Date | null;
  revokedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

let ready: boolean | null = null;
let probePromise: Promise<boolean> | null = null;

export function isMissingTtlockTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const msg = e.message ?? "";
  return (
    e.code === "P2021" ||
    e.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("ttlock_connections") ||
    msg.includes("ttlock_cached_locks") ||
    msg.includes("ttlock_gateways") ||
    msg.includes("ttlock_access_credentials") ||
    msg.includes("ttlock_callback_inbox") ||
    msg.includes("onlineStatus")
  );
}

/** Faqat mavjudlikni tekshiradi — CREATE/ALTER qilmaydi */
export async function isTtlockDbReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (ready === true) return true;
  if (ready === false) return false;

  if (!probePromise) {
    probePromise = (async () => {
      try {
        await prisma.$queryRawUnsafe(
          `SELECT "id" FROM "ttlock_connections" LIMIT 1`
        );
        // 4-bosqich jadvallari ham kerak
        await prisma.$queryRawUnsafe(
          `SELECT "id" FROM "ttlock_gateways" LIMIT 1`
        );
        await prisma.$queryRawUnsafe(
          `SELECT "id" FROM "ttlock_access_credentials" LIMIT 1`
        );
        await prisma.$queryRawUnsafe(
          `SELECT "id" FROM "ttlock_remote_commands" LIMIT 1`
        );
        await prisma.$queryRawUnsafe(
          `SELECT "id" FROM "ttlock_callback_inbox" LIMIT 1`
        );
        await prisma.$queryRawUnsafe(
          `SELECT "lastCallbackReceivedAt" FROM "ttlock_connections" LIMIT 0`
        );
        ready = true;
        return true;
      } catch (err) {
        if (isMissingTtlockTableError(err)) {
          ready = false;
          return false;
        }
        ready = false;
        return false;
      }
    })().finally(() => {
      probePromise = null;
    });
  }
  return probePromise;
}

export function resetTtlockDbReadyCache() {
  ready = null;
}

export async function requireTtlockDb() {
  if (!isDatabaseConfigured()) {
    throw new TtlockError(
      "DATABASE_URL sozlanmagan",
      "TTLOCK_DB_UNAVAILABLE",
      501
    );
  }
  if (!(await isTtlockDbReady())) {
    throw new TtlockError(
      "TTLock jadvallari hali migratsiya qilinmagan. Prisma migration qo'llang, keyin qayta urinib ko'ring.",
      "DATABASE_MIGRATION_REQUIRED",
      503
    );
  }
}

export function mapDbStatusToPublic(status: string): PublicStatus {
  switch (status) {
    case "CONNECTED":
      return "connected";
    case "TOKEN_EXPIRED":
      return "token_expired";
    case "ERROR":
      return "error";
    case "SYNCING":
      return "syncing";
    default:
      return "disconnected";
  }
}

export async function findConnectionByOwner(
  ownerUserId: string
): Promise<TtlockConnectionRow | null> {
  const rows = await prisma.$queryRawUnsafe<TtlockConnectionRow[]>(
    `SELECT * FROM "ttlock_connections"
     WHERE "ownerUserId" = $1 AND "provider" = 'TTLOCK' LIMIT 1`,
    ownerUserId
  );
  return rows[0] ?? null;
}

export async function findConnectionById(
  connectionId: string
): Promise<TtlockConnectionRow | null> {
  const rows = await prisma.$queryRawUnsafe<TtlockConnectionRow[]>(
    `SELECT * FROM "ttlock_connections" WHERE "id" = $1 LIMIT 1`,
    connectionId
  );
  return rows[0] ?? null;
}

export async function upsertConnectionForOwner(
  ownerUserId: string,
  data: {
    status: string;
    ttlockUid?: string | null;
    accessTokenEncrypted?: string | null;
    refreshTokenEncrypted?: string | null;
    tokenExpiresAt?: Date | null;
    lastConnectedAt?: Date | null;
    lastSyncedAt?: Date | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }
): Promise<TtlockConnectionRow> {
  assertTtlockConnectionStatus(data.status);
  const existing = await findConnectionByOwner(ownerUserId);
  const now = new Date();
  if (existing) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_connections" SET
        "status" = CAST($2 AS "TtlockConnectionStatus"),
        "ttlockUid" = COALESCE($3, "ttlockUid"),
        "accessTokenEncrypted" = COALESCE($4, "accessTokenEncrypted"),
        "refreshTokenEncrypted" = COALESCE($5, "refreshTokenEncrypted"),
        "tokenExpiresAt" = COALESCE($6, "tokenExpiresAt"),
        "lastConnectedAt" = COALESCE($7, "lastConnectedAt"),
        "lastSyncedAt" = COALESCE($8, "lastSyncedAt"),
        "lastErrorCode" = $9,
        "lastErrorMessage" = $10,
        "updatedAt" = $11
       WHERE "id" = $1`,
      existing.id,
      data.status,
      data.ttlockUid ?? null,
      data.accessTokenEncrypted ?? null,
      data.refreshTokenEncrypted ?? null,
      data.tokenExpiresAt ?? null,
      data.lastConnectedAt ?? null,
      data.lastSyncedAt ?? null,
      data.lastErrorCode ?? null,
      data.lastErrorMessage ?? null,
      now
    );
    const updated = await findConnectionByOwner(ownerUserId);
    if (!updated) {
      throw new TtlockError(
        "Connection yangilanmadi",
        "TTLOCK_DB_UNAVAILABLE",
        500
      );
    }
    return updated;
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ttlock_connections" (
      "id", "ownerUserId", "provider", "status", "ttlockUid",
      "accessTokenEncrypted", "refreshTokenEncrypted", "tokenExpiresAt",
      "lastConnectedAt", "lastSyncedAt", "lastErrorCode", "lastErrorMessage",
      "createdAt", "updatedAt"
    ) VALUES ($1,$2,'TTLOCK',CAST($3 AS "TtlockConnectionStatus"),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    id,
    ownerUserId,
    data.status,
    data.ttlockUid ?? null,
    data.accessTokenEncrypted ?? null,
    data.refreshTokenEncrypted ?? null,
    data.tokenExpiresAt ?? null,
    data.lastConnectedAt ?? null,
    data.lastSyncedAt ?? null,
    data.lastErrorCode ?? null,
    data.lastErrorMessage ?? null,
    now,
    now
  );
  const created = await findConnectionByOwner(ownerUserId);
  if (!created) {
    throw new TtlockError(
      "Connection yaratilmadi",
      "TTLOCK_DB_UNAVAILABLE",
      500
    );
  }
  return created;
}

export async function clearConnectionTokens(
  connectionId: string,
  ownerUserId: string
): Promise<boolean> {
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_connections" SET
      "status" = 'DISCONNECTED'::"TtlockConnectionStatus",
      "accessTokenEncrypted" = NULL,
      "refreshTokenEncrypted" = NULL,
      "tokenExpiresAt" = NULL,
      "lastErrorCode" = NULL,
      "lastErrorMessage" = NULL,
      "updatedAt" = $3
     WHERE "id" = $1 AND "ownerUserId" = $2`,
    connectionId,
    ownerUserId,
    new Date()
  );
  return Number(result) > 0;
}

export async function countLocks(connectionId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "ttlock_cached_locks"
     WHERE "connectionId" = $1 AND "isActive" = true`,
    connectionId
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listLocks(
  connectionId: string
): Promise<TtlockCachedLockRow[]> {
  return prisma.$queryRawUnsafe<TtlockCachedLockRow[]>(
    `SELECT * FROM "ttlock_cached_locks"
     WHERE "connectionId" = $1
     ORDER BY "isActive" DESC, "name" ASC`,
    connectionId
  );
}

export type LockConnectionMatch = {
  lock: TtlockCachedLockRow;
  connection: TtlockConnectionRow;
};

/** Callback uchun — faqat active lock + connected connection */
export async function findActiveLockMatchesByExternalId(
  externalLockId: string
): Promise<LockConnectionMatch[]> {
  const locks = await prisma.$queryRawUnsafe<TtlockCachedLockRow[]>(
    `SELECT l.* FROM "ttlock_cached_locks" l
     JOIN "ttlock_connections" c ON c."id" = l."connectionId"
     WHERE l."externalLockId" = $1 AND l."isActive" = true
       AND c."status" IN (
         CAST('CONNECTED' AS "TtlockConnectionStatus"),
         CAST('SYNCING' AS "TtlockConnectionStatus")
       )`,
    externalLockId
  );
  const out: LockConnectionMatch[] = [];
  for (const lock of locks) {
    const connections = await prisma.$queryRawUnsafe<TtlockConnectionRow[]>(
      `SELECT * FROM "ttlock_connections" WHERE "id" = $1 LIMIT 1`,
      lock.connectionId
    );
    const connection = connections[0];
    if (connection) out.push({ lock, connection });
  }
  return out;
}

export async function findGatewayByExternalId(input: {
  connectionId: string;
  externalGatewayId: string;
}): Promise<TtlockGatewayRow | null> {
  const rows = await prisma.$queryRawUnsafe<TtlockGatewayRow[]>(
    `SELECT * FROM "ttlock_gateways"
     WHERE "connectionId" = $1 AND "externalGatewayId" = $2 AND "isActive" = true
     LIMIT 1`,
    input.connectionId,
    input.externalGatewayId
  );
  return rows[0] ?? null;
}

export async function findPropertyForCachedLock(
  ttlockCachedLockId: string
): Promise<{ propertyId: string } | null> {
  const rows = await prisma.$queryRawUnsafe<{ propertyId: string }[]>(
    `SELECT "propertyId" FROM "room_lock_settings"
     WHERE "ttlockCachedLockId" = $1 LIMIT 1`,
    ttlockCachedLockId
  );
  return rows[0] ?? null;
}

export async function updateLockBatteryIfNewer(input: {
  lockId: string;
  battery: number;
  eventAt: Date;
}): Promise<void> {
  if (input.battery < 0 || input.battery > 100) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_cached_locks" SET
      "battery" = $2,
      "lastEventAt" = $3,
      "updatedAt" = $4
     WHERE "id" = $1
       AND ("lastEventAt" IS NULL OR "lastEventAt" <= $3)`,
    input.lockId,
    input.battery,
    input.eventAt,
    new Date()
  );
}

export async function updateGatewayOnlineIfNewer(input: {
  gatewayId: string;
  onlineStatus: TtlockDeviceOnlineStatus;
  eventAt: Date;
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_gateways" SET
      "onlineStatus" = CAST($2 AS "TtlockDeviceOnlineStatus"),
      "lastHeartbeatAt" = $3,
      "lastEventAt" = $3,
      "updatedAt" = $4
     WHERE "id" = $1
       AND ("lastEventAt" IS NULL OR "lastEventAt" <= $3)`,
    input.gatewayId,
    input.onlineStatus,
    input.eventAt,
    new Date()
  );
}

export async function touchConnectionCallbackTimestamps(input: {
  connectionId: string;
  received?: boolean;
  processed?: boolean;
}): Promise<void> {
  const now = new Date();
  if (input.received) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_connections" SET "lastCallbackReceivedAt" = $2, "updatedAt" = $2
       WHERE "id" = $1`,
      input.connectionId,
      now
    );
  }
  if (input.processed) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_connections" SET "lastCallbackProcessedAt" = $2, "updatedAt" = $2
       WHERE "id" = $1`,
      input.connectionId,
      now
    );
  }
}

export async function upsertGateway(input: {
  connectionId: string;
  externalGatewayId: string | number;
  name?: string | null;
  mac?: string | null;
  onlineStatus?: boolean | null | TtlockDeviceOnlineStatus;
  lastHeartbeatAt?: Date | null;
  capabilities?: Record<string, unknown> | null;
  lastSyncedAt: Date;
}): Promise<TtlockGatewayRow> {
  const externalGatewayId = toExternalIdString(input.externalGatewayId);
  const onlineStatus = mapOnlineStatus(input.onlineStatus);
  const caps = input.capabilities ? JSON.stringify(input.capabilities) : null;
  const now = new Date();

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "ttlock_gateways"
     WHERE "connectionId" = $1 AND "externalGatewayId" = $2 LIMIT 1`,
    input.connectionId,
    externalGatewayId
  );

  if (existing[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_gateways" SET
        "name" = COALESCE($2, "name"),
        "mac" = COALESCE($3, "mac"),
        "onlineStatus" = CAST($4 AS "TtlockDeviceOnlineStatus"),
        "lastHeartbeatAt" = COALESCE($5, "lastHeartbeatAt"),
        "lastSyncedAt" = $6,
        "isActive" = true,
        "removedAt" = NULL,
        "capabilities" = COALESCE($7::jsonb, "capabilities"),
        "updatedAt" = $8
       WHERE "id" = $1`,
      existing[0].id,
      input.name ?? null,
      input.mac ?? null,
      onlineStatus,
      input.lastHeartbeatAt ?? null,
      input.lastSyncedAt,
      caps,
      now
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ttlock_gateways" (
        "id", "connectionId", "externalGatewayId", "name", "mac",
        "onlineStatus", "lastHeartbeatAt", "lastSyncedAt",
        "isActive", "removedAt", "capabilities", "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,CAST($6 AS "TtlockDeviceOnlineStatus"),$7,$8,true,NULL,$9::jsonb,$10,$11)`,
      randomUUID(),
      input.connectionId,
      externalGatewayId,
      input.name ?? null,
      input.mac ?? null,
      onlineStatus,
      input.lastHeartbeatAt ?? null,
      input.lastSyncedAt,
      caps,
      now,
      now
    );
  }

  const rows = await prisma.$queryRawUnsafe<TtlockGatewayRow[]>(
    `SELECT * FROM "ttlock_gateways"
     WHERE "connectionId" = $1 AND "externalGatewayId" = $2 LIMIT 1`,
    input.connectionId,
    externalGatewayId
  );
  if (!rows[0]) {
    throw new TtlockError("Gateway saqlanmadi", "TTLOCK_DB_UNAVAILABLE", 500);
  }
  return rows[0];
}

/** API’da topilmagan gateway’larni soft-remove (DELETE emas) */
export async function softRemoveMissingGateways(
  connectionId: string,
  seenExternalIds: Set<string>,
  at: Date = new Date()
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ id: string; externalGatewayId: string }[]>(
    `SELECT "id", "externalGatewayId" FROM "ttlock_gateways"
     WHERE "connectionId" = $1 AND "isActive" = true`,
    connectionId
  );
  const patch = softRemovePatch(at);
  let n = 0;
  for (const row of rows) {
    if (seenExternalIds.has(row.externalGatewayId)) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_gateways" SET
        "isActive" = $2, "removedAt" = $3, "updatedAt" = $3
       WHERE "id" = $1`,
      row.id,
      patch.isActive,
      patch.removedAt
    );
    n += 1;
  }
  return n;
}

export async function upsertCachedLock(input: {
  connectionId: string;
  externalLockId: string | number;
  name: string;
  mac: string | null;
  model: string | null;
  firmwareVersion?: string | null;
  battery: number | null;
  hasGateway: boolean;
  remoteUnlock: boolean | null;
  passcodeCapable?: boolean | null;
  eKeyCapable?: boolean | null;
  /** Faqat onlineStatus — legacy online Boolean yozilmaydi */
  onlineStatus?: boolean | null | TtlockDeviceOnlineStatus;
  lastOnlineAt?: Date | null;
  gatewayId?: string | null;
  capabilities: Record<string, unknown> | null;
  rawSafe: Record<string, unknown> | null;
  lastSyncedAt: Date;
}): Promise<TtlockCachedLockRow> {
  const externalLockId = toExternalIdString(input.externalLockId);
  const battery = normalizeBattery(input.battery);
  // Canonical: onlineStatus (legacy `online` ustuni yangilanmaydi)
  const onlineStatus = mapOnlineStatus(input.onlineStatus ?? null);

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "ttlock_cached_locks"
     WHERE "connectionId" = $1 AND "externalLockId" = $2 LIMIT 1`,
    input.connectionId,
    externalLockId
  );
  const now = new Date();
  const caps = input.capabilities ? JSON.stringify(input.capabilities) : null;
  const raw = input.rawSafe ? JSON.stringify(input.rawSafe) : null;

  if (existing[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_cached_locks" SET
        "name" = $2,
        "mac" = $3,
        "model" = $4,
        "firmwareVersion" = COALESCE($5, "firmwareVersion"),
        "battery" = $6,
        "hasGateway" = $7,
        "remoteUnlock" = $8,
        "passcodeCapable" = COALESCE($9, "passcodeCapable"),
        "eKeyCapable" = COALESCE($10, "eKeyCapable"),
        "onlineStatus" = CAST($11 AS "TtlockDeviceOnlineStatus"),
        "lastOnlineAt" = COALESCE($12, "lastOnlineAt"),
        "gatewayId" = COALESCE($13, "gatewayId"),
        "capabilities" = $14::jsonb,
        "rawSafe" = $15::jsonb,
        "lastSyncedAt" = $16,
        "isActive" = true,
        "removedAt" = NULL,
        "updatedAt" = $17
       WHERE "id" = $1`,
      existing[0].id,
      input.name,
      input.mac,
      input.model,
      input.firmwareVersion ?? null,
      battery,
      input.hasGateway,
      input.remoteUnlock,
      input.passcodeCapable ?? null,
      input.eKeyCapable ?? null,
      onlineStatus,
      input.lastOnlineAt ?? null,
      input.gatewayId ?? null,
      caps,
      raw,
      input.lastSyncedAt,
      now
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ttlock_cached_locks" (
        "id", "connectionId", "externalLockId", "name", "mac", "model",
        "firmwareVersion", "battery", "hasGateway", "remoteUnlock",
        "passcodeCapable", "eKeyCapable", "onlineStatus",
        "lastOnlineAt", "gatewayId", "capabilities", "rawSafe",
        "lastSyncedAt", "isActive", "removedAt", "createdAt", "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        CAST($13 AS "TtlockDeviceOnlineStatus"),$14,$15,$16::jsonb,$17::jsonb,
        $18,true,NULL,$19,$20
      )`,
      randomUUID(),
      input.connectionId,
      externalLockId,
      input.name,
      input.mac,
      input.model,
      input.firmwareVersion ?? null,
      battery,
      input.hasGateway,
      input.remoteUnlock,
      input.passcodeCapable ?? null,
      input.eKeyCapable ?? null,
      onlineStatus,
      input.lastOnlineAt ?? null,
      input.gatewayId ?? null,
      caps,
      raw,
      input.lastSyncedAt,
      now,
      now
    );
  }

  const rows = await prisma.$queryRawUnsafe<TtlockCachedLockRow[]>(
    `SELECT * FROM "ttlock_cached_locks"
     WHERE "connectionId" = $1 AND "externalLockId" = $2 LIMIT 1`,
    input.connectionId,
    externalLockId
  );
  if (!rows[0]) {
    throw new TtlockError("Qulf saqlanmadi", "TTLOCK_DB_UNAVAILABLE", 500);
  }
  return rows[0];
}

/** API’da yo‘qolgan qulflarni soft-remove — hard DELETE yo‘q */
export async function softRemoveMissingLocks(
  connectionId: string,
  seenExternalLockIds: Set<string>,
  at: Date = new Date()
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ id: string; externalLockId: string }[]>(
    `SELECT "id", "externalLockId" FROM "ttlock_cached_locks"
     WHERE "connectionId" = $1 AND "isActive" = true`,
    connectionId
  );
  const patch = softRemovePatch(at);
  let n = 0;
  for (const row of rows) {
    if (seenExternalLockIds.has(row.externalLockId)) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_cached_locks" SET
        "isActive" = $2, "removedAt" = $3, "updatedAt" = $3
       WHERE "id" = $1`,
      row.id,
      patch.isActive,
      patch.removedAt
    );
    n += 1;
  }
  return n;
}

export async function markLocksSyncedAt(
  connectionId: string,
  at: Date
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "ttlock_connections" SET "lastSyncedAt" = $2, "updatedAt" = $2 WHERE "id" = $1`,
    connectionId,
    at
  );
}

/**
 * Owner scope: qulf faqat berilgan user connection’iga tegishli bo‘lsa ID qaytaradi.
 */
export async function findOwnedLockId(
  ownerUserId: string,
  ttlockCachedLockId: string
): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT l."id" FROM "ttlock_cached_locks" l
     INNER JOIN "ttlock_connections" c ON c."id" = l."connectionId"
     WHERE l."id" = $1 AND c."ownerUserId" = $2 AND c."provider" = 'TTLOCK'
     LIMIT 1`,
    ttlockCachedLockId,
    ownerUserId
  );
  return rows[0]?.id ?? null;
}

/** Qulf boshqa xonaga biriktirilganmi? */
export async function findRoomLinkedToLock(
  ttlockCachedLockId: string,
  excludePropertyId?: string
): Promise<{ propertyId: string } | null> {
  const rows = await prisma.$queryRawUnsafe<{ propertyId: string }[]>(
    excludePropertyId
      ? `SELECT "propertyId" FROM "room_lock_settings"
         WHERE "ttlockCachedLockId" = $1 AND "propertyId" <> $2 LIMIT 1`
      : `SELECT "propertyId" FROM "room_lock_settings"
         WHERE "ttlockCachedLockId" = $1 LIMIT 1`,
    ...(excludePropertyId
      ? [ttlockCachedLockId, excludePropertyId]
      : [ttlockCachedLockId])
  );
  return rows[0] ?? null;
}

export async function upsertAccessCredential(input: {
  roomAccessGrantId: string;
  connectionId: string;
  ttlockCachedLockId: string;
  accessType: TtlockAccessCredentialType;
  syncStatus?: TtlockAccessSyncStatus;
  externalAccessId?: string | null;
  credentialEncrypted?: string | null;
  sentAt?: Date | null;
  lastSyncedAt?: Date | null;
  revokedAt?: Date | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}): Promise<TtlockAccessCredentialRow> {
  const externalAccessId =
    input.externalAccessId != null
      ? toExternalIdString(input.externalAccessId)
      : null;
  const now = new Date();
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "ttlock_access_credentials"
     WHERE "roomAccessGrantId" = $1 LIMIT 1`,
    input.roomAccessGrantId
  );

  if (existing[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ttlock_access_credentials" SET
        "connectionId" = $2,
        "ttlockCachedLockId" = $3,
        "accessType" = CAST($4 AS "TtlockAccessCredentialType"),
        "syncStatus" = COALESCE(CAST($5 AS "TtlockAccessSyncStatus"), "syncStatus"),
        "externalAccessId" = COALESCE($6, "externalAccessId"),
        "credentialEncrypted" = COALESCE($7, "credentialEncrypted"),
        "sentAt" = COALESCE($8, "sentAt"),
        "lastSyncedAt" = COALESCE($9, "lastSyncedAt"),
        "revokedAt" = COALESCE($10, "revokedAt"),
        "lastErrorCode" = $11,
        "lastErrorMessage" = $12,
        "updatedAt" = $13
       WHERE "id" = $1`,
      existing[0].id,
      input.connectionId,
      input.ttlockCachedLockId,
      input.accessType,
      input.syncStatus ?? null,
      externalAccessId,
      input.credentialEncrypted ?? null,
      input.sentAt ?? null,
      input.lastSyncedAt ?? null,
      input.revokedAt ?? null,
      input.lastErrorCode ?? null,
      input.lastErrorMessage ?? null,
      now
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ttlock_access_credentials" (
        "id", "roomAccessGrantId", "connectionId", "ttlockCachedLockId",
        "accessType", "syncStatus", "externalAccessId",
        "credentialEncrypted", "sentAt", "lastSyncedAt",
        "revokedAt", "lastErrorCode", "lastErrorMessage", "createdAt", "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,CAST($5 AS "TtlockAccessCredentialType"),
        CAST($6 AS "TtlockAccessSyncStatus"),$7,$8,$9,$10,$11,$12,$13,$14,$15
      )`,
      randomUUID(),
      input.roomAccessGrantId,
      input.connectionId,
      input.ttlockCachedLockId,
      input.accessType,
      input.syncStatus ?? "PLANNED",
      externalAccessId,
      input.credentialEncrypted ?? null,
      input.sentAt ?? null,
      input.lastSyncedAt ?? null,
      input.revokedAt ?? null,
      input.lastErrorCode ?? null,
      input.lastErrorMessage ?? null,
      now,
      now
    );
  }

  const rows = await prisma.$queryRawUnsafe<TtlockAccessCredentialRow[]>(
    `SELECT * FROM "ttlock_access_credentials"
     WHERE "roomAccessGrantId" = $1 LIMIT 1`,
    input.roomAccessGrantId
  );
  if (!rows[0]) {
    throw new TtlockError(
      "Access credential saqlanmadi",
      "TTLOCK_DB_UNAVAILABLE",
      500
    );
  }
  return rows[0];
}

/** Public API mapping — credentialEncrypted hech qachon chiqmaydi */
export function toPublicAccessCredential(row: TtlockAccessCredentialRow) {
  return {
    id: row.id,
    roomAccessGrantId: row.roomAccessGrantId,
    connectionId: row.connectionId,
    ttlockCachedLockId: row.ttlockCachedLockId,
    accessType: row.accessType,
    syncStatus: row.syncStatus,
    externalAccessId: row.externalAccessId,
    sentAt: row.sentAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
