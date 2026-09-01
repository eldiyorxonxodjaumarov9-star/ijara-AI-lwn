/**
 * LWN xona ↔ TTLock qulf UI mapping (sof funksiyalar).
 */

import type { TtlockAssignableLock } from "@/types/ttlock-assignable-lock";
import { TTLOCK_PROVIDER_LABEL } from "@/types/ttlock-assignable-lock";
import {
  formatTtlockBattery,
  formatTtlockDateTime,
  mapOnlineStatusLabel,
} from "@/lib/ttlock-settings-view";

export { TTLOCK_PROVIDER_LABEL };
export type { TtlockAssignableLock };

export const LOCK_NOTES_MAX_LENGTH = 2000;

export const TTLOCK_NO_LOCKS_MESSAGE =
  "TTLock hisobida hozircha qulf topilmadi. Qulfni TTLock ilovasiga qo‘shgach, sinxronlashtiring.";

export const TTLOCK_NOT_CONNECTED_ROOM_MESSAGE =
  "TTLock hisobi hali ulanmagan. Avval Sozlamalar → Integratsiyalar bo‘limidan TTLock hisobini ulang.";

export const TTLOCK_MIGRATION_REQUIRED_MESSAGE =
  "TTLock ma’lumotlar bazasi hali tayyorlanmagan.";

export const TTLOCK_UNLINK_CONFIRM =
  "TTLock qulfini bu xonadan ajratmoqchimisiz? Qulf TTLock hisobidan o‘chirilmaydi, faqat ushbu xona bilan bog‘lanishi bekor qilinadi.";

export function isTtlockProviderName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return (
    n === "ttlock/sciener" ||
    n === "ttlock" ||
    n === "sciener" ||
    n.includes("ttlock")
  );
}

export function mapGatewayStatusLabel(lock: {
  hasGateway: boolean;
  gatewayOnlineStatus: "UNKNOWN" | "ONLINE" | "OFFLINE" | null;
}): string {
  if (!lock.hasGateway && lock.gatewayOnlineStatus == null) {
    return "Gateway ulanmagan";
  }
  switch (lock.gatewayOnlineStatus) {
    case "ONLINE":
      return "Gateway onlayn";
    case "OFFLINE":
      return "Gateway oflayn";
    case "UNKNOWN":
      return "Gateway holati noma’lum";
    default:
      return lock.hasGateway
        ? "Gateway holati noma’lum"
        : "Gateway ulanmagan";
  }
}

export function lockSelectPrimaryLabel(lock: TtlockAssignableLock): string {
  return lock.name.trim() || `Qulf ${lock.externalLockId}`;
}

export function lockSelectSecondaryLabel(lock: TtlockAssignableLock): string {
  if (lock.assignedToOtherRoom) {
    return (
      lock.disabledReason ??
      `Boshqa xonaga biriktirilgan: ${
        lock.assignedPropertyName?.trim() || "boshqa xona"
      }`
    );
  }
  if (!lock.isActive && lock.assignedToCurrentRoom) {
    return "TTLock hisobida hozir topilmadi";
  }
  return `lockId: ${lock.externalLockId}`;
}

export function filterAssignableLocks(
  locks: TtlockAssignableLock[],
  query: string
): TtlockAssignableLock[] {
  const q = query.trim().toLowerCase();
  if (!q) return locks;
  return locks.filter((lock) => {
    return (
      lock.name.toLowerCase().includes(q) ||
      lock.externalLockId.toLowerCase().includes(q) ||
      (lock.mac ?? "").toLowerCase().includes(q)
    );
  });
}

export function lockDetailRows(lock: TtlockAssignableLock) {
  return {
    provider: TTLOCK_PROVIDER_LABEL,
    name: lock.name,
    lockId: lock.externalLockId,
    onlineLabel: mapOnlineStatusLabel(lock.onlineStatus),
    batteryLabel: formatTtlockBattery(lock.battery),
    batteryLow:
      lock.battery != null && lock.battery >= 0 && lock.battery <= 20,
    gatewayLabel: mapGatewayStatusLabel(lock),
    lastSyncedLabel: formatTtlockDateTime(lock.lastSyncedAt),
    inactiveOnAccount: !lock.isActive,
  };
}

export function sanitizeAssignableLocks(raw: unknown): TtlockAssignableLock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const onlineStatusRaw = String(o.onlineStatus ?? "UNKNOWN").toUpperCase();
    const onlineStatus =
      onlineStatusRaw === "ONLINE" || onlineStatusRaw === "OFFLINE"
        ? onlineStatusRaw
        : "UNKNOWN";
    const gwRaw = o.gatewayOnlineStatus;
    const gatewayOnlineStatus =
      gwRaw === "ONLINE" || gwRaw === "OFFLINE" || gwRaw === "UNKNOWN"
        ? gwRaw
        : null;
    return {
      id: String(o.id ?? `lock-${idx}`),
      name: String(o.name ?? "Qulf"),
      externalLockId: String(o.externalLockId ?? ""),
      mac: o.mac == null ? null : String(o.mac),
      battery:
        typeof o.battery === "number" && o.battery >= 0 && o.battery <= 100
          ? o.battery
          : null,
      onlineStatus,
      hasGateway: Boolean(o.hasGateway),
      gatewayName: o.gatewayName == null ? null : String(o.gatewayName),
      gatewayExternalId:
        o.gatewayExternalId == null ? null : String(o.gatewayExternalId),
      gatewayOnlineStatus,
      isActive: o.isActive !== false,
      assignedPropertyId:
        o.assignedPropertyId == null ? null : String(o.assignedPropertyId),
      assignedPropertyName:
        o.assignedPropertyName == null
          ? null
          : String(o.assignedPropertyName),
      assignedToCurrentRoom: Boolean(o.assignedToCurrentRoom),
      assignedToOtherRoom: Boolean(o.assignedToOtherRoom),
      lastSyncedAt:
        o.lastSyncedAt == null ? null : String(o.lastSyncedAt),
      selectable: o.selectable !== false,
      disabledReason:
        o.disabledReason == null ? null : String(o.disabledReason),
    };
  });
}
