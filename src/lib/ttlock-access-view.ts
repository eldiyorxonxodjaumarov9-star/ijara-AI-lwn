/**
 * Client/UI-safe TTLock access helpers (server path’siz).
 */

export function stripOneTimePasscode<T extends { oneTimePasscode?: string }>(
  grant: T
): Omit<T, "oneTimePasscode"> {
  const { oneTimePasscode: _drop, ...rest } = grant;
  void _drop;
  return rest;
}

export const EKEY_RECEIVER_MISSING_HINT =
  "Arendator telefon/emaili yo‘q. Reja saqlanishi mumkin, lekin eKey API’ga yuborilmaydi.";

/** TTLock syncStatus → Uzbek UI labels (SENT ≠ ACTIVE ≠ PLANNED). */
export const TTLOCK_SYNC_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Reja saqlandi",
  PENDING_SYNC: "Yuborilmoqda",
  SENT: "API'ga yuborilgan",
  ACTIVE: "Qurilmada faol",
  FAILED: "Xatolik",
  REVOKE_PENDING: "Bekor qilish kutilmoqda",
  REVOKED: "Bekor qilingan",
  EXPIRED: "Muddati tugagan",
};

export const TTLOCK_REMOTE_REQUIRES_GATEWAY_MESSAGE =
  "Masofadan boshqarish (PIN yuborish, ochish/yopish) uchun TTLock Gateway yoki Wi‑Fi qulf kerak. Gateway=0 bo‘lsa, PIN-ni TTLock ilovasida qulf yonida (Bluetooth) o‘rnating.";

export function mapTtlockSyncStatusLabel(
  syncStatus: string | null | undefined
): string {
  if (!syncStatus) return TTLOCK_SYNC_STATUS_LABELS.PLANNED;
  return TTLOCK_SYNC_STATUS_LABELS[syncStatus] ?? syncStatus;
}

export function isTtlockSyncStatusActive(
  syncStatus: string | null | undefined
): boolean {
  return syncStatus === "ACTIVE";
}
