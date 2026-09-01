/**
 * TTLock callback konfiguratsiyasi (server-only).
 */

export const TTLOCK_CALLBACK_DEFAULT_URL =
  "https://www.arendaai.uz/api/integrations/ttlock/callback";

export const TTLOCK_CALLBACK_MAX_BODY_BYTES = 256 * 1024;

export const TTLOCK_CALLBACK_SUCCESS_BODY = "success";

export const TTLOCK_CALLBACK_VERIFY_MODE = "verify-by-fetch" as const;

/** Form-urlencoded maydonlari limiti (abuse himoya) */
export const TTLOCK_CALLBACK_MAX_FORM_FIELDS = 32;

/** Bir callbackdagi maksimal record soni */
export const TTLOCK_CALLBACK_MAX_RECORDS = 50;

/** Inbox processing lease (ms) — stale PROCESSING recovery */
export const TTLOCK_CALLBACK_PROCESSING_LEASE_MS = 5 * 60 * 1000;

/** Cron sweep batch */
export const TTLOCK_CALLBACK_CRON_BATCH_LIMIT = 20;

/** Cron sweep execution budget (ms) */
export const TTLOCK_CALLBACK_CRON_MAX_RUNTIME_MS = 50_000;

/** Lock/Gateway tashqi ID: faqat raqam, 1–20 belgi */
export const TTLOCK_CALLBACK_EXTERNAL_ID_RE = /^\d{1,20}$/;

export function getTtlockCallbackUrl(): string {
  const raw = process.env.TTLOCK_CALLBACK_URL?.trim();
  if (!raw) return TTLOCK_CALLBACK_DEFAULT_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return TTLOCK_CALLBACK_DEFAULT_URL;
    return url.toString().replace(/\/$/, "");
  } catch {
    return TTLOCK_CALLBACK_DEFAULT_URL;
  }
}

/** Rasmiy platforma secret bersa ishlatiladi; hozircha TTLock EU callback signature bermaydi */
export function hasCallbackSigningSecret(): boolean {
  return Boolean(process.env.TTLOCK_CALLBACK_SIGNING_SECRET?.trim());
}
