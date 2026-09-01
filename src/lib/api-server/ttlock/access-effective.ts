/**
 * Access grant effective status + Asia/Tashkent ↔ UTC (sof funksiyalar).
 * Fake clock: `now` parametri orqali.
 */

import type { TtlockAccessSyncStatus } from "@prisma/client";

/** Toshkent UTC+5, DST yo‘q */
export const TASHKENT_UTC_OFFSET_HOURS = 5;

export type AccessEffectiveUiStatus =
  | "REJALASHTIRILGAN"
  | "YUBORILMOQDA"
  | "API_YUBORILGAN"
  | "FAOL"
  | "TUGAGAN"
  | "BEKOR_KUTILMOQDA"
  | "BEKOR_QILINGAN"
  | "XATOLIK";

export const ACCESS_EFFECTIVE_UI_LABELS: Record<AccessEffectiveUiStatus, string> = {
  REJALASHTIRILGAN: "Rejalashtirilgan",
  YUBORILMOQDA: "TTLock’ga yuborilmoqda",
  API_YUBORILGAN: "API’ga yuborilgan",
  FAOL: "Faol",
  TUGAGAN: "Tugagan",
  BEKOR_KUTILMOQDA: "Bekor qilish kutilmoqda",
  BEKOR_QILINGAN: "Bekor qilingan",
  XATOLIK: "Xatolik",
};

export const LOCK_MISSING_PLAN_HINT =
  "Qulf hali biriktirilmagan. Reja saqlandi, qurilmaga yuborilmadi.";

/**
 * Business datetime (Toshkent) → UTC Date.
 * Offsetli ISO bo‘lsa Date sifatida; `YYYY-MM-DD[THH:mm]` Toshkent deb olinadi.
 */
export function parseBusinessDateTimeToUtc(
  value: string | null | undefined
): Date | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4] ?? 0);
  const minute = Number(m[5] ?? 0);
  const second = Number(m[6] ?? 0);
  if (
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - TASHKENT_UTC_OFFSET_HOURS,
      minute,
      second
    )
  );
}

export function assertValidFromBeforeTo(
  validFrom: Date | null,
  validTo: Date | null
): string | null {
  if (validFrom && validTo && !(validFrom.getTime() < validTo.getTime())) {
    return "Boshlanish sanasi tugash sanasidan oldin bo‘lishi kerak";
  }
  return null;
}

export function isWithinAccessWindow(
  validFrom: Date | null,
  validTo: Date | null,
  now: Date
): boolean {
  const t = now.getTime();
  if (validFrom && t < validFrom.getTime()) return false;
  if (validTo && t >= validTo.getTime()) return false;
  return true;
}

export function isAccessExpired(
  validTo: Date | null,
  now: Date
): boolean {
  return Boolean(validTo && now.getTime() >= validTo.getTime());
}

/**
 * Provider sync + sanalar + grant status → UI effective status.
 */
export function resolveAccessEffectiveStatus(input: {
  grantStatus: "PLANNED" | "CANCELLED" | string;
  grantRevokedAt?: Date | null;
  validFrom: Date | null;
  validTo: Date | null;
  syncStatus: TtlockAccessSyncStatus | string | null;
  hasCredential: boolean;
  now?: Date;
}): AccessEffectiveUiStatus {
  const now = input.now ?? new Date();

  if (
    input.grantStatus === "CANCELLED" ||
    input.grantRevokedAt ||
    input.syncStatus === "REVOKED"
  ) {
    return "BEKOR_QILINGAN";
  }
  if (input.syncStatus === "REVOKE_PENDING") {
    return "BEKOR_KUTILMOQDA";
  }
  if (input.syncStatus === "FAILED") {
    return "XATOLIK";
  }
  if (input.syncStatus === "PENDING_SYNC") {
    return "YUBORILMOQDA";
  }
  if (isAccessExpired(input.validTo, now)) {
    return "TUGAGAN";
  }
  if (
    input.syncStatus === "ACTIVE" ||
    (input.syncStatus === "SENT" &&
      isWithinAccessWindow(input.validFrom, input.validTo, now))
  ) {
    if (
      input.syncStatus === "SENT" &&
      isWithinAccessWindow(input.validFrom, input.validTo, now)
    ) {
      return "FAOL";
    }
    if (input.syncStatus === "ACTIVE") return "FAOL";
  }
  if (input.syncStatus === "SENT" || input.syncStatus === "EXPIRED") {
    if (input.syncStatus === "EXPIRED" || isAccessExpired(input.validTo, now)) {
      return "TUGAGAN";
    }
    return "API_YUBORILGAN";
  }
  if (!input.hasCredential || input.syncStatus === "PLANNED" || !input.syncStatus) {
    return "REJALASHTIRILGAN";
  }
  return "REJALASHTIRILGAN";
}

/** Persist qilinadigan syncStatus (read-time effective dan mustaqil yangilash) */
export function derivePersistedSyncAfterSend(input: {
  validFrom: Date | null;
  validTo: Date | null;
  now?: Date;
}): "SENT" | "ACTIVE" | "EXPIRED" {
  const now = input.now ?? new Date();
  if (isAccessExpired(input.validTo, now)) return "EXPIRED";
  if (isWithinAccessWindow(input.validFrom, input.validTo, now)) return "ACTIVE";
  return "SENT";
}

export function maskReceiver(value: string): string {
  const v = value.trim();
  if (v.includes("@")) {
    const [user, domain] = v.split("@");
    if (!domain) return "***";
    const u = user.length <= 2 ? "*".repeat(user.length) : `${user.slice(0, 1)}***${user.slice(-1)}`;
    return `${u}@${domain}`;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

export function resolveEkeyReceiver(tenant: {
  phone?: string | null;
  email?: string | null;
}): { ok: true; receiver: string } | { ok: false } {
  const email = (tenant.email ?? "").trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: true, receiver: email };
  }
  const phone = (tenant.phone ?? "").trim().replace(/[\s()-]/g, "");
  if (phone.length >= 9 && /^\+?\d+$/.test(phone)) {
    return { ok: true, receiver: phone.startsWith("+") ? phone : phone };
  }
  return { ok: false };
}

export const TTLOCK_ACCESS_OWNER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
] as const;

export function isTtlockAccessOwnerRole(role: string): boolean {
  return (TTLOCK_ACCESS_OWNER_ROLES as readonly string[]).includes(role);
}

export function permissionToAccessKind(
  permissionType: string
): "passcode" | "ekey" | "other" {
  const p = permissionType.toUpperCase();
  if (p === "PIN") return "passcode";
  if (p === "APP") return "ekey";
  return "other";
}

export function permissionToCredentialType(
  permissionType: string
): "PASSCODE" | "EKEY" | null {
  const kind = permissionToAccessKind(permissionType);
  if (kind === "passcode") return "PASSCODE";
  if (kind === "ekey") return "EKEY";
  return null;
}

export type SyncClaimDecision =
  | "already_sent"
  | "unknown_result"
  | "claimable"
  | "in_flight";

/** Atomic claim oldidan sof qaror (DB UPDATE alohida). */
export function classifyCredentialForSyncClaim(row: {
  externalAccessId: string | null;
  syncStatus: string;
  lastErrorCode: string | null;
}): SyncClaimDecision {
  if (
    row.externalAccessId &&
    ["SENT", "ACTIVE", "REVOKE_PENDING", "REVOKED"].includes(row.syncStatus)
  ) {
    return "already_sent";
  }
  if (row.lastErrorCode === "TTLOCK_RESULT_UNKNOWN") {
    return "unknown_result";
  }
  if (!row.externalAccessId && ["PLANNED", "FAILED"].includes(row.syncStatus)) {
    return "claimable";
  }
  if (row.externalAccessId) return "already_sent";
  return "in_flight";
}

export type RemoteRevokeDecision =
  | "local_only"
  | "remote_passcode"
  | "remote_ekey";

export function decideRemoteRevoke(input: {
  externalAccessId: string | null | undefined;
  accessType: string | null | undefined;
}): RemoteRevokeDecision {
  if (!input.externalAccessId) return "local_only";
  if (String(input.accessType).toUpperCase() === "EKEY") return "remote_ekey";
  return "remote_passcode";
}

/** Passcode V3 `/v3/keyboardPwd/get` maydonlari (clientId/token/date client qo‘shadi). */
export function buildPasscodeV3RequestFields(input: {
  lockId: string | number;
  startDateMs: number;
  endDateMs: number;
  keyboardPwdType?: number;
}) {
  return {
    lockId: input.lockId,
    keyboardPwdType: input.keyboardPwdType ?? 3,
    startDate: input.startDateMs,
    endDate: input.endDateMs,
  };
}

/** eKey V3 `/v3/key/send` maydonlari. */
export function buildEkeyV3RequestFields(input: {
  lockId: string | number;
  receiverUsername: string;
  keyName: string;
  startDateMs: number;
  endDateMs: number;
  remarks?: string;
}) {
  return {
    lockId: input.lockId,
    receiverUsername: input.receiverUsername,
    keyName: input.keyName,
    startDate: input.startDateMs,
    endDate: input.endDateMs,
    ...(input.remarks != null ? { remarks: input.remarks } : {}),
  };
}

export const EKEY_RECEIVER_REQUIRED_MESSAGE =
  "eKey yuborish uchun arendatorning TTLock telefon yoki emaili kerak.";

export const EKEY_RECEIVER_PLAN_ONLY_MESSAGE =
  "eKey yuborish uchun arendatorning TTLock telefon yoki emaili kerak. Reja saqlandi, API’ga yuborilmadi.";
