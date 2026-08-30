import type { Property } from "@prisma/client";
import type { Role } from "@prisma/client";

import { LWN_BUILDING } from "@/lib/constants";
import { fail } from "@/lib/api-server/http";
import { prisma } from "@/lib/api-server/prisma";
import {
  findOwnedLockId,
  findRoomLinkedToLock,
} from "@/lib/api-server/ttlock/db";
import { assertValidAccessWindow } from "@/lib/api-server/ttlock/persistence";
import { TtlockError } from "@/lib/api-server/ttlock/errors";

const TTLOCK_MANAGER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export function isLwnPropertyRecord(property: Pick<Property, "building" | "district">) {
  return (
    property.building === LWN_BUILDING || property.district === LWN_BUILDING
  );
}

export async function findLwnPropertyOrFail(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property) {
    return { error: fail("Xona topilmadi", 404) };
  }
  if (!isLwnPropertyRecord(property)) {
    return { error: fail("LWN xonasi emas", 403) };
  }
  return { property };
}

export function mapLockSettings(row: {
  id: string;
  propertyId: string;
  providerName: string | null;
  lockName: string | null;
  deviceId: string | null;
  notes: string | null;
  ttlockCachedLockId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    providerName: row.providerName ?? "",
    lockName: row.lockName ?? "",
    deviceId: row.deviceId ?? "",
    notes: row.notes ?? "",
    ttlockCachedLockId: row.ttlockCachedLockId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAccessGrant(row: {
  id: string;
  propertyId: string;
  tenantId: string;
  permissionType: string;
  validFrom: Date | null;
  validTo: Date | null;
  status: string;
  notes: string | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tenant?: { fullName: string; phone: string | null } | null;
}) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    tenantId: row.tenantId,
    tenantName: row.tenant?.fullName ?? "",
    tenantPhone: row.tenant?.phone ?? "",
    permissionType: row.permissionType.toLowerCase(),
    validFrom: row.validFrom?.toISOString().slice(0, 10) ?? "",
    validTo: row.validTo?.toISOString().slice(0, 10) ?? "",
    status: row.status.toLowerCase(),
    notes: row.notes ?? "",
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAccessLogEvent(row: {
  id: string;
  propertyId: string;
  occurredAt: Date;
  personLabel: string | null;
  eventType: string;
  method: string | null;
  direction: string;
  result: string;
  source: string;
}) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    occurredAt: row.occurredAt.toISOString(),
    personLabel: row.personLabel,
    eventType: row.eventType,
    method: row.method,
    direction: row.direction as "entry" | "exit" | "unknown",
    result: row.result,
    source: row.source,
  };
}

export function parsePermissionType(value: unknown) {
  const raw = String(value ?? "PIN").toUpperCase();
  const allowed = ["PIN", "APP", "CARD", "PERMANENT", "TEMPORARY"] as const;
  return allowed.includes(raw as (typeof allowed)[number])
    ? (raw as (typeof allowed)[number])
    : "PIN";
}

export function parseDateOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function assertAccessWindowOrFail(
  validFrom: Date | null,
  validTo: Date | null
) {
  try {
    assertValidAccessWindow(validFrom, validTo);
    return null;
  } catch (err) {
    if (err instanceof TtlockError) {
      return fail(err.message, err.httpStatus);
    }
    return fail("Vaqt oralig'i noto'g'ri", 400);
  }
}

/**
 * TTLock qulfini xonaga biriktirish validatsiyasi (owner scope + unique room).
 * null/"" → bog‘lanishni olib tashlash.
 */
export async function resolveTtlockLockLink(input: {
  ownerUserId: string;
  ownerRole: Role;
  propertyId: string;
  ttlockCachedLockId: string | null;
}): Promise<
  | { ok: true; ttlockCachedLockId: string | null }
  | { ok: false; error: ReturnType<typeof fail> }
> {
  if (input.ttlockCachedLockId === null || input.ttlockCachedLockId === "") {
    return { ok: true, ttlockCachedLockId: null };
  }

  if (!TTLOCK_MANAGER_ROLES.includes(input.ownerRole)) {
    return {
      ok: false,
      error: fail("TTLock qulfini biriktirish uchun ruxsat yo'q", 403),
    };
  }

  const owned = await findOwnedLockId(
    input.ownerUserId,
    input.ttlockCachedLockId
  );
  if (!owned) {
    return {
      ok: false,
      error: fail(
        "Qulf topilmadi yoki boshqa foydalanuvchi hisobiga tegishli",
        403
      ),
    };
  }

  const linked = await findRoomLinkedToLock(
    input.ttlockCachedLockId,
    input.propertyId
  );
  if (linked) {
    return {
      ok: false,
      error: fail("Bu TTLock qulfi allaqachon boshqa xonaga biriktirilgan", 409),
    };
  }

  return { ok: true, ttlockCachedLockId: input.ttlockCachedLockId };
}
