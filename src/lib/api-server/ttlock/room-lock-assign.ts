/**
 * Xona ↔ TTLock qulf biriktirish (DB persistence).
 * Tashqi Sciener API chaqirilmaydi.
 */

import type { Role, User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import {
  findConnectionByOwner,
  requireTtlockDb,
} from "@/lib/api-server/ttlock/db";
import type { TtlockDeviceOnlineStatus } from "@/lib/api-server/ttlock/persistence";
import type { TtlockAssignableLock } from "@/types/ttlock-assignable-lock";
import { TTLOCK_PROVIDER_LABEL } from "@/types/ttlock-assignable-lock";

export { TTLOCK_PROVIDER_LABEL };
export type { TtlockAssignableLock };

const OWNER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

/** Ajratishni to‘smaydigan yakuniy sync holatlari */
export const TTLOCK_ACCESS_TERMINAL_STATUSES = ["EXPIRED", "REVOKED"] as const;

function assertOwnerRole(user: Pick<User, "role">) {
  if (!OWNER_ROLES.includes(user.role)) {
    throw new TtlockError(
      "TTLock qulfini biriktirish uchun ruxsat yo'q",
      "TTLOCK_FORBIDDEN",
      403
    );
  }
}

type LockJoinRow = {
  id: string;
  name: string;
  externalLockId: string;
  mac: string | null;
  battery: number | null;
  onlineStatus: string;
  hasGateway: boolean;
  isActive: boolean;
  lastSyncedAt: Date | null;
  gatewayName: string | null;
  gatewayExternalId: string | null;
  gatewayOnlineStatus: string | null;
  assignedPropertyId: string | null;
  assignedPropertyName: string | null;
};

function asOnlineStatus(value: string | null | undefined): TtlockDeviceOnlineStatus {
  if (value === "ONLINE" || value === "OFFLINE" || value === "UNKNOWN") {
    return value;
  }
  return "UNKNOWN";
}

export function isPrismaUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; meta?: { target?: string[] } };
  if (e.code === "P2002") return true;
  const msg = e.message ?? "";
  return /unique|UniqueConstraint|ttlockCachedLockId/i.test(msg);
}

export function mapUniqueToAlreadyAssigned(err: unknown): TtlockError | null {
  if (!isPrismaUniqueViolation(err)) return null;
  return new TtlockError(
    "Bu qulf boshqa xonaga biriktirilgan. Avval o‘sha xonadan ajrating.",
    "TTLOCK_LOCK_ALREADY_ASSIGNED",
    409
  );
}

/** Server snapshot — client lockName/battery/online ishlatilmaydi */
export function serverLockFieldsFromCached(lock: {
  name: string;
  externalLockId: string;
}) {
  return {
    providerName: TTLOCK_PROVIDER_LABEL,
    lockName: lock.name,
    deviceId: String(lock.externalLockId),
  };
}

/** Aynan shu xonaga qayta biriktirish — conflict emas */
export function isIdempotentSameRoomAssign(
  currentTtlockCachedLockId: string | null | undefined,
  nextLockId: string
): boolean {
  return Boolean(currentTtlockCachedLockId) && currentTtlockCachedLockId === nextLockId;
}

/**
 * Service-level parallel race: ikkala so‘rov transaction check’dan o‘tsa,
 * unique constraint ikkinchisini P2002 bilan uradi → 409.
 * Haqiqiy DB concurrency emas — mapping himoyasini simulyatsiya qiladi.
 */
export function simulateUniqueRaceConflict(): TtlockError {
  const mapped = mapUniqueToAlreadyAssigned({
    code: "P2002",
    meta: { target: ["ttlockCachedLockId"] },
  });
  if (!mapped) {
    throw new Error("unique race mapping failed");
  }
  return mapped;
}

/** Faol (terminal bo‘lmagan) access ajratishni to‘sadi */
export function isTerminalAccessSyncStatus(status: string): boolean {
  return (TTLOCK_ACCESS_TERMINAL_STATUSES as readonly string[]).includes(
    status
  );
}

export function toAssignable(
  row: LockJoinRow,
  currentPropertyId: string | null
): TtlockAssignableLock {
  const assignedPropertyId = row.assignedPropertyId;
  const assignedToCurrentRoom = Boolean(
    currentPropertyId && assignedPropertyId === currentPropertyId
  );
  const assignedToOtherRoom = Boolean(
    assignedPropertyId && assignedPropertyId !== currentPropertyId
  );

  let selectable = true;
  let disabledReason: string | null = null;

  if (assignedToOtherRoom) {
    selectable = false;
    disabledReason = `Boshqa xonaga biriktirilgan: ${
      row.assignedPropertyName?.trim() || "boshqa xona"
    }`;
  } else if (!row.isActive && !assignedToCurrentRoom) {
    selectable = false;
    disabledReason = "TTLock hisobida hozir topilmadi";
  }

  return {
    id: row.id,
    name: row.name,
    externalLockId: row.externalLockId,
    mac: row.mac,
    battery: row.battery,
    onlineStatus: asOnlineStatus(row.onlineStatus),
    hasGateway: row.hasGateway,
    gatewayName: row.gatewayName,
    gatewayExternalId: row.gatewayExternalId,
    gatewayOnlineStatus: row.gatewayOnlineStatus
      ? asOnlineStatus(row.gatewayOnlineStatus)
      : row.hasGateway
        ? "UNKNOWN"
        : null,
    isActive: row.isActive,
    assignedPropertyId,
    assignedPropertyName: row.assignedPropertyName,
    assignedToCurrentRoom,
    assignedToOtherRoom,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    selectable,
    disabledReason,
  };
}

export async function listAssignableTtlockLocks(
  user: User,
  currentPropertyId: string | null
): Promise<TtlockAssignableLock[]> {
  assertOwnerRole(user);
  await requireTtlockDb();

  const connection = await findConnectionByOwner(user.id);
  if (!connection) return [];

  const rows = await prisma.$queryRawUnsafe<LockJoinRow[]>(
    `SELECT
       l."id",
       l."name",
       l."externalLockId",
       l."mac",
       l."battery",
       l."onlineStatus"::text AS "onlineStatus",
       l."hasGateway",
       l."isActive",
       l."lastSyncedAt",
       g."name" AS "gatewayName",
       g."externalGatewayId" AS "gatewayExternalId",
       g."onlineStatus"::text AS "gatewayOnlineStatus",
       rls."propertyId" AS "assignedPropertyId",
       p."name" AS "assignedPropertyName"
     FROM "ttlock_cached_locks" l
     INNER JOIN "ttlock_connections" c ON c."id" = l."connectionId"
     LEFT JOIN "ttlock_gateways" g ON g."id" = l."gatewayId"
     LEFT JOIN "room_lock_settings" rls ON rls."ttlockCachedLockId" = l."id"
     LEFT JOIN "properties" p ON p."id" = rls."propertyId"
     WHERE c."ownerUserId" = $1 AND c."provider" = 'TTLOCK'
     ORDER BY l."isActive" DESC, l."name" ASC`,
    user.id
  );

  return rows
    .map((row) => toAssignable(row, currentPropertyId))
    .filter((lock) => {
      // Inactive + hech qayerga birikmagan → ro‘yxatdan yashirish mumkin,
      // lekin joriy xonaga birikkan inactive ko‘rinsin
      if (!lock.isActive && !lock.assignedToCurrentRoom) return false;
      return true;
    });
}

async function loadOwnedLockOrThrow(
  ownerUserId: string,
  lockId: string
): Promise<{
  id: string;
  name: string;
  externalLockId: string;
  isActive: boolean;
  connectionId: string;
}> {
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      name: string;
      externalLockId: string;
      isActive: boolean;
      connectionId: string;
    }[]
  >(
    `SELECT l."id", l."name", l."externalLockId", l."isActive", l."connectionId"
     FROM "ttlock_cached_locks" l
     INNER JOIN "ttlock_connections" c ON c."id" = l."connectionId"
     WHERE l."id" = $1 AND c."ownerUserId" = $2 AND c."provider" = 'TTLOCK'
     LIMIT 1`,
    lockId,
    ownerUserId
  );
  if (!rows[0]) {
    throw new TtlockError(
      "Qulf topilmadi",
      "TTLOCK_LOCK_NOT_FOUND",
      404
    );
  }
  return rows[0];
}

export async function countBlockingAccessCredentials(
  lockId: string,
  propertyId: string
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count
     FROM "ttlock_access_credentials" tac
     INNER JOIN "room_access_grants" rag ON rag."id" = tac."roomAccessGrantId"
     WHERE tac."ttlockCachedLockId" = $1
       AND rag."propertyId" = $2
       AND tac."syncStatus"::text NOT IN ('EXPIRED', 'REVOKED')
       AND tac."revokedAt" IS NULL`,
    lockId,
    propertyId
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * TTLock qulfini xonaga biriktirish / almashtirish (transaction).
 * Client yuborgan lockName/battery/online e’tiborga olinmaydi.
 */
export async function assignTtlockLockToRoom(input: {
  user: User;
  propertyId: string;
  ttlockCachedLockId: string;
  notes: string | null;
}): Promise<{
  propertyId: string;
  ttlockCachedLockId: string;
  providerName: string;
  lockName: string;
  deviceId: string;
  notes: string | null;
}> {
  assertOwnerRole(input.user);
  await requireTtlockDb();

  const lockId = input.ttlockCachedLockId.trim();
  if (!lockId) {
    throw new TtlockError("Qulf tanlanmagan", "TTLOCK_LOCK_NOT_FOUND", 400);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const lockRows = await tx.$queryRawUnsafe<
        {
          id: string;
          name: string;
          externalLockId: string;
          isActive: boolean;
        }[]
      >(
        `SELECT l."id", l."name", l."externalLockId", l."isActive"
         FROM "ttlock_cached_locks" l
         INNER JOIN "ttlock_connections" c ON c."id" = l."connectionId"
         WHERE l."id" = $1 AND c."ownerUserId" = $2 AND c."provider" = 'TTLOCK'
         LIMIT 1`,
        lockId,
        input.user.id
      );
      const lock = lockRows[0];
      if (!lock) {
        throw new TtlockError(
          "Qulf topilmadi",
          "TTLOCK_LOCK_NOT_FOUND",
          404
        );
      }

      const other = await tx.$queryRawUnsafe<{ propertyId: string; name: string | null }[]>(
        `SELECT rls."propertyId", p."name"
         FROM "room_lock_settings" rls
         LEFT JOIN "properties" p ON p."id" = rls."propertyId"
         WHERE rls."ttlockCachedLockId" = $1 AND rls."propertyId" <> $2
         LIMIT 1`,
        lockId,
        input.propertyId
      );
      if (other[0]) {
        const roomName = other[0].name?.trim();
        throw new TtlockError(
          roomName
            ? `Bu qulf boshqa xonaga biriktirilgan: ${roomName}. Avval o‘sha xonadan ajrating.`
            : "Bu qulf boshqa xonaga biriktirilgan. Avval o‘sha xonadan ajrating.",
          "TTLOCK_LOCK_ALREADY_ASSIGNED",
          409
        );
      }

      const current = await tx.roomLockSettings.findUnique({
        where: { propertyId: input.propertyId },
      });
      const alreadyThisRoom = isIdempotentSameRoomAssign(
        current?.ttlockCachedLockId,
        lockId
      );

      if (!lock.isActive && !alreadyThisRoom) {
        throw new TtlockError(
          "TTLock hisobida hozir topilmadi — yangi biriktirish mumkin emas",
          "TTLOCK_LOCK_INACTIVE",
          400
        );
      }

      const derived = serverLockFieldsFromCached(lock);
      const providerName = derived.providerName;
      const lockName = derived.lockName;
      const deviceId = derived.deviceId;
      const notes = input.notes;

      if (current) {
        await tx.roomLockSettings.update({
          where: { propertyId: input.propertyId },
          data: {
            providerName,
            lockName,
            deviceId,
            notes,
            ttlockCachedLockId: lockId,
          },
        });
      } else {
        await tx.roomLockSettings.create({
          data: {
            propertyId: input.propertyId,
            providerName,
            lockName,
            deviceId,
            notes,
            ttlockCachedLockId: lockId,
          },
        });
      }

      return {
        propertyId: input.propertyId,
        ttlockCachedLockId: lockId,
        providerName,
        lockName,
        deviceId,
        notes,
      };
    });
  } catch (err) {
    if (err instanceof TtlockError) throw err;
    const mapped = mapUniqueToAlreadyAssigned(err);
    if (mapped) throw mapped;
    throw err;
  }
}

/**
 * Xonadan TTLock bog‘lanishini ajratish — cached lock o‘chirilmaydi.
 */
export async function unassignTtlockLockFromRoom(input: {
  user: User;
  propertyId: string;
  clearNotes?: boolean;
}): Promise<{ propertyId: string; notes: string | null }> {
  assertOwnerRole(input.user);
  await requireTtlockDb();

  const current = await prisma.roomLockSettings.findUnique({
    where: { propertyId: input.propertyId },
  });
  if (!current?.ttlockCachedLockId) {
    return {
      propertyId: input.propertyId,
      notes: current?.notes ?? null,
    };
  }

  // Owner scope: lock shu user connectioniga tegishli bo‘lishi kerak (yoki allaqachon orphan)
  try {
    await loadOwnedLockOrThrow(input.user.id, current.ttlockCachedLockId);
  } catch (err) {
    if (err instanceof TtlockError && err.code === "TTLOCK_LOCK_NOT_FOUND") {
      // Orphan relation — baribir ajratishga ruxsat
    } else {
      throw err;
    }
  }

  const blocking = await countBlockingAccessCredentials(
    current.ttlockCachedLockId,
    input.propertyId
  );
  if (blocking > 0) {
    throw new TtlockError(
      "Bu qulfda faol kirish huquqlari mavjud. Avval kirish huquqlarini bekor qiling.",
      "TTLOCK_LOCK_HAS_ACTIVE_ACCESS",
      409
    );
  }

  const notes = input.clearNotes ? null : current.notes;
  await prisma.roomLockSettings.update({
    where: { propertyId: input.propertyId },
    data: {
      ttlockCachedLockId: null,
      lockName: null,
      deviceId: null,
      // providerName saqlanadi yoki TTLock qolishi mumkin — ajratishda tozalaymiz
      providerName: null,
      notes,
    },
  });

  return { propertyId: input.propertyId, notes };
}

export function assertCanManageTtlockRole(role: Role) {
  assertOwnerRole({ role });
}
