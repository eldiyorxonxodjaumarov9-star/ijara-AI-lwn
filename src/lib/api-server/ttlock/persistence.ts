/**
 * TTLock DB persistence helperlari — sof validatsiya / mapping (tarmoq yo‘q).
 * Token/parol/eKey ochiq matn sifatida saqlanmasin.
 */

import { encryptSecret } from "@/lib/api-server/ttlock/crypto";
import { TtlockError } from "@/lib/api-server/ttlock/errors";

export type TtlockDeviceOnlineStatus = "UNKNOWN" | "ONLINE" | "OFFLINE";
export type TtlockAccessCredentialType = "PASSCODE" | "EKEY";
export type TtlockAccessSyncStatus =
  | "PLANNED"
  | "PENDING_SYNC"
  | "SENT"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKE_PENDING"
  | "REVOKED"
  | "FAILED";

/** Tashqi Sciener ID — har doim String */
export function toExternalIdString(value: string | number | null | undefined): string {
  if (value == null) {
    throw new TtlockError("Tashqi ID bo'sh", "TTLOCK_API_ERROR", 400);
  }
  const s = String(value).trim();
  if (!s) {
    throw new TtlockError("Tashqi ID bo'sh", "TTLOCK_API_ERROR", 400);
  }
  return s;
}

export function normalizeBattery(
  value: number | null | undefined
): number | null {
  if (value == null || Number.isNaN(value)) return null;
  if (!Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0 || n > 100) {
    throw new TtlockError(
      "Batareya 0–100 oralig'ida bo'lishi kerak",
      "TTLOCK_API_ERROR",
      400
    );
  }
  return n;
}

/** Tashqi API qiymati — diapazondan tashqari bo‘lsa null (throw emas) */
export function coerceBatteryFromRemote(
  value: number | null | undefined
): number | null {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  const n = Math.round(value);
  if (n < 0 || n > 100) return null;
  return n;
}

export function mapOnlineStatus(
  value: boolean | null | undefined | TtlockDeviceOnlineStatus
): TtlockDeviceOnlineStatus {
  if (value === "ONLINE" || value === "OFFLINE" || value === "UNKNOWN") {
    return value;
  }
  if (value === true) return "ONLINE";
  if (value === false) return "OFFLINE";
  return "UNKNOWN";
}

export function onlineStatusToPublicBool(
  status: TtlockDeviceOnlineStatus
): boolean | null {
  if (status === "ONLINE") return true;
  if (status === "OFFLINE") return false;
  return null;
}

/**
 * Canonical online holatni tanlash.
 * Legacy Boolean va enum farq qilsa — onlineStatus (enum) ustun.
 */
export function resolveCanonicalOnlineStatus(input: {
  onlineStatus?: TtlockDeviceOnlineStatus | null;
  /** Legacy — faqat onlineStatus UNKNOWN/yo‘q bo‘lganda backfill */
  onlineLegacy?: boolean | null;
}): TtlockDeviceOnlineStatus {
  if (input.onlineStatus === "ONLINE" || input.onlineStatus === "OFFLINE") {
    return input.onlineStatus;
  }
  if (input.onlineLegacy === true) return "ONLINE";
  if (input.onlineLegacy === false) return "OFFLINE";
  return "UNKNOWN";
}

/** validFrom < validUntil (ikkala ham berilganda) */
export function assertValidAccessWindow(
  validFrom: Date | null | undefined,
  validUntil: Date | null | undefined
): void {
  if (!validFrom || !validUntil) return;
  if (validFrom.getTime() >= validUntil.getTime()) {
    throw new TtlockError(
      "Kirish boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak",
      "TTLOCK_API_ERROR",
      400
    );
  }
}

export function ttlockLockUniqueKey(
  connectionId: string,
  externalLockId: string | number
) {
  return `${connectionId}:${toExternalIdString(externalLockId)}`;
}

export function ttlockGatewayUniqueKey(
  connectionId: string,
  externalGatewayId: string | number
) {
  return `${connectionId}:${toExternalIdString(externalGatewayId)}`;
}

/**
 * Parol/eKey ni DB uchun shifrlaydi.
 * Faqat credentialEncrypted — hech qanday plaintext fragment (last4 va h.k.) yo‘q.
 */
export function encryptAccessCredential(
  plaintext: string,
  keyMaterial?: string
): { credentialEncrypted: string } {
  return { credentialEncrypted: encryptSecret(plaintext, keyMaterial) };
}

/** API/list javobidan maxfiy maydonlarni olib tashlash */
const SECRET_KEYS = [
  "accessTokenEncrypted",
  "refreshTokenEncrypted",
  "credentialEncrypted",
  "credentialLast4",
  "access_token",
  "refresh_token",
  "password",
  "client_secret",
] as const;

export function stripSecretFields<T extends Record<string, unknown>>(
  row: T
): Record<string, unknown> {
  const safe: Record<string, unknown> = { ...row };
  for (const key of SECRET_KEYS) {
    delete safe[key];
  }
  return safe;
}

/**
 * Soft-remove: qurilma API’da topilmasa DB’dan o‘chirilmaydi.
 * Faqat isActive=false / removedAt belgilanadi.
 */
export function softRemovePatch(at: Date = new Date()) {
  return {
    isActive: false,
    removedAt: at,
  } as const;
}

/** Token plaintext emasligini tekshirish (shifrlangan v1: prefiks) */
export function looksEncryptedSecret(value: string | null | undefined): boolean {
  if (!value) return true; // bo‘sh — plaintext emas
  return value.startsWith("v1:") && value.split(":").length === 4;
}
