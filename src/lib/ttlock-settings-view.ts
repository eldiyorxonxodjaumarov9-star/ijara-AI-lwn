/**
 * TTLock Settings panel — sof view-model (UI holatlari, mapping).
 * Secret/token hech qachon bu qatlamda saqlanmasin.
 */

import type { Role } from "@/types";
import type {
  TtlockConnectionStatus,
  TtlockPublicLock,
  TtlockPublicStatus,
} from "@/types/ttlock";

export const TTLOCK_EMPTY_LOCKS_MESSAGE =
  "TTLock hisobida hozircha qulf topilmadi. Qulfni TTLock ilovasiga qo‘shgach, sinxronlashtiring.";

export const TTLOCK_NOT_CONFIGURED_MESSAGE =
  "TTLock API ma’lumotlari hali serverga kiritilmagan. Application tasdiqlangach client_id va client_secretni server environment sozlamalariga kiriting.";

export const TTLOCK_MIGRATION_REQUIRED_MESSAGE =
  "TTLock ma’lumotlar bazasi hali tayyorlanmagan. Integratsiyani ishga tushirishdan oldin migration’ni qo‘llash kerak.";

export const TTLOCK_DISCONNECT_CONFIRM =
  "TTLock integratsiyasini uzmoqchimisiz? Xonalardagi saqlangan qulf ma’lumotlari o‘chirilmaydi, ammo yangi sinxronizatsiya va masofaviy amallar ishlamaydi.";

export type TtlockPanelPhase =
  | "loading"
  | "forbidden"
  | "migration_required"
  | "not_configured"
  | "ready"
  | "connecting"
  | "connected"
  | "token_expired"
  | "syncing"
  | "error";

export type TtlockUiBusy = "connect" | "sync" | "disconnect" | null;

const SECRET_KEY_RE =
  /clientSecret|accessToken|refreshToken|password|passwordMd5|encryptionKey|access_token|refresh_token|credentialEncrypted|TOKEN_ENCRYPTION/i;

/** Frontend AppUser.role: SUPER_ADMIN/ADMIN → "admin" (auth-context mapApiRole) */
export function canManageTtlock(role: Role | undefined | null): boolean {
  return role === "admin" || role === "manager";
}

export function mapTtlockUiError(
  code: string | null | undefined,
  fallbackMessage?: string | null
): string {
  switch (code) {
    case "TTLOCK_NOT_CONFIGURED":
      return "TTLock API ma’lumotlari hali sozlanmagan.";
    case "DATABASE_MIGRATION_REQUIRED":
    case "TTLOCK_DB_UNAVAILABLE":
      return "TTLock ma’lumotlar bazasi hali tayyorlanmagan.";
    case "TTLOCK_NOT_CONNECTED":
      return "TTLock hisobi hali ulanmagan.";
    case "TTLOCK_TOKEN_EXPIRED":
      return "TTLock ulanish muddati tugagan. Qayta ulang.";
    case "TTLOCK_RATE_LIMITED":
      return "TTLock so‘rovlar limiti vaqtincha tugagan. Keyinroq urinib ko‘ring.";
    case "UNAUTHORIZED":
    case "TTLOCK_AUTH_REQUIRED":
      return "Tizimga qayta kiring.";
    case "FORBIDDEN":
    case "TTLOCK_FORBIDDEN":
      return "Bu amal uchun sizda ruxsat yo‘q.";
    case "TTLOCK_LOCK_ALREADY_ASSIGNED":
      return (
        (fallbackMessage ?? "").trim() ||
        "Bu qulf boshqa xonaga biriktirilgan. Avval o‘sha xonadan ajrating."
      );
    case "TTLOCK_LOCK_HAS_ACTIVE_ACCESS":
      return "Bu qulfda faol kirish huquqlari mavjud. Avval kirish huquqlarini bekor qiling.";
    case "TTLOCK_LOCK_INACTIVE":
      return "TTLock hisobida hozir topilmadi — yangi biriktirish mumkin emas";
    case "TTLOCK_LOCK_NOT_FOUND":
      return "Qulf topilmadi";
    case "TTLOCK_ROOM_LOCK_MISSING":
      return "Xonaga TTLock qulfi biriktirilmagan.";
    case "TTLOCK_RECEIVER_REQUIRED":
      return "eKey yuborish uchun arendatorning TTLock telefon yoki emaili kerak.";
    case "TTLOCK_RESULT_UNKNOWN":
      return "TTLock javobi tasdiqlanmadi. Dublikat yaratmaslik uchun avtomatik qayta yuborilmadi.";
    case "TTLOCK_GATEWAY_REQUIRED":
      return "Masofadan boshqarish uchun Gateway yoki Wi‑Fi qulf kerak.";
    case "TTLOCK_GATEWAY_OFFLINE":
      return "Gateway oflayn. Internet ulanishini tekshiring.";
    case "TTLOCK_REMOTE_UNLOCK_UNSUPPORTED":
      return "Bu qulf masofadan ochishni qo‘llamaydi.";
    case "TTLOCK_REMOTE_LOCK_UNSUPPORTED":
      return "Bu qulf masofadan yopishni qo‘llamaydi.";
    case "TTLOCK_COMMAND_IN_PROGRESS":
      return "Bu qulf uchun boshqa buyruq bajarilmoqda.";
    case "TTLOCK_COMMAND_RESULT_UNKNOWN":
      return "TTLock javobi tasdiqlanmadi. Qulf holatini tekshiring.";
    case "TTLOCK_NO_REVOCABLE_ACCESS":
      return "Bekor qilish uchun faol kirish huquqi topilmadi.";
    default:
      break;
  }
  const msg = (fallbackMessage ?? "").trim();
  if (msg && !SECRET_KEY_RE.test(msg) && !/stack|trace|sql|password|secret|token/i.test(msg)) {
    // Serverdan kelgan xavfsiz o‘zbekcha xabar
    if (msg.length < 200) return msg;
  }
  return "TTLock xizmatida xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.";
}

/** Asia/Tashkent: 02.09.2026, 14:35 */
export function formatTtlockDateTime(
  value: string | number | Date | null | undefined
): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    const parts = new Intl.DateTimeFormat("uz-UZ", {
      timeZone: "Asia/Tashkent",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const day = get("day");
    const month = get("month");
    const year = get("year");
    const hour = get("hour");
    const minute = get("minute");
    if (!day || !month || !year) return "—";
    return `${day}.${month}.${year}, ${hour}:${minute}`;
  } catch {
    return "—";
  }
}

export function formatTtlockBattery(
  battery: number | null | undefined
): string {
  if (battery == null || Number.isNaN(battery)) return "—";
  const n = Math.round(battery);
  if (n < 0 || n > 100) return "—";
  return `${n}%`;
}

export function mapOnlineStatusLabel(
  status: "UNKNOWN" | "ONLINE" | "OFFLINE" | null | undefined
): string {
  switch (status) {
    case "ONLINE":
      return "Onlayn";
    case "OFFLINE":
      return "Oflayn";
    default:
      return "Noma’lum";
  }
}

export function badgeLabelForPhase(phase: TtlockPanelPhase): string {
  switch (phase) {
    case "not_configured":
      return "Sozlanmagan";
    case "migration_required":
      return "Migration kerak";
    case "ready":
      return "Ulanmagan";
    case "connecting":
      return "Ulanmoqda";
    case "connected":
      return "Ulangan";
    case "token_expired":
      return "Token muddati tugagan";
    case "syncing":
      return "Sinxronlanmoqda";
    case "error":
      return "Xatolik";
    case "forbidden":
      return "Ruxsat yo‘q";
    case "loading":
      return "Yuklanmoqda";
    default:
      return "Sozlanmagan";
  }
}

export function badgeVariantForPhase(
  phase: TtlockPanelPhase
): "secondary" | "success" | "warning" | "destructive" | "outline" {
  switch (phase) {
    case "connected":
      return "success";
    case "token_expired":
    case "syncing":
    case "connecting":
    case "migration_required":
      return "warning";
    case "error":
    case "forbidden":
      return "destructive";
    case "ready":
      return "outline";
    default:
      return "secondary";
  }
}

export function deriveTtlockPanelPhase(input: {
  loading: boolean;
  busy: TtlockUiBusy;
  forbidden?: boolean;
  migrationRequired?: boolean;
  status: TtlockPublicStatus | null;
}): TtlockPanelPhase {
  if (input.loading && !input.status && !input.migrationRequired) {
    return "loading";
  }
  if (input.forbidden) return "forbidden";
  if (input.migrationRequired) return "migration_required";
  if (input.busy === "connect") return "connecting";
  if (input.busy === "sync") return "syncing";

  const status = input.status;
  if (!status) return "error";

  if (!status.config.configured) return "not_configured";

  const cs = status.connection.status;
  if (cs === "token_expired") return "token_expired";
  if (cs === "error") return "error";
  if (cs === "syncing") return "syncing";
  if (cs === "connected") return "connected";
  if (cs === "ready") return "ready";
  // disconnected + configured → ready
  if (status.config.configured) return "ready";
  return "not_configured";
}

export function canConnect(phase: TtlockPanelPhase, busy: TtlockUiBusy): boolean {
  if (busy !== null) return false;
  return phase === "ready" || phase === "token_expired" || phase === "error";
}

export function canSync(phase: TtlockPanelPhase, busy: TtlockUiBusy): boolean {
  if (busy !== null) return false;
  return phase === "connected";
}

export function canDisconnect(
  phase: TtlockPanelPhase,
  busy: TtlockUiBusy,
  hasConnectionHint: boolean
): boolean {
  if (busy !== null) return false;
  return (
    hasConnectionHint &&
    (phase === "connected" ||
      phase === "token_expired" ||
      phase === "error" ||
      phase === "syncing")
  );
}

/** API status’dan maxfiy maydonlarni chiqarib tashlash (mudofaa) */
export function sanitizeTtlockStatus(
  raw: unknown
): TtlockPublicStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const config = (o.config ?? {}) as Record<string, unknown>;
  const connection = (o.connection ?? {}) as Record<string, unknown>;
  const callbackRaw = (o.callback ?? null) as Record<string, unknown> | null;

  const status: TtlockPublicStatus = {
    provider: "TTLock/Sciener",
    config: {
      configured: Boolean(config.configured),
      missingFields: Array.isArray(config.missingFields)
        ? config.missingFields.map(String)
        : [],
      environment: "eu",
    },
    connection: {
      status: normalizeConnectionStatus(connection.status),
      connected: Boolean(connection.connected),
      ttlockUid:
        connection.ttlockUid == null ? null : String(connection.ttlockUid),
      tokenExpiresAt:
        connection.tokenExpiresAt == null
          ? null
          : String(connection.tokenExpiresAt),
      lastConnectedAt:
        connection.lastConnectedAt == null
          ? null
          : String(connection.lastConnectedAt),
      lastSyncedAt:
        connection.lastSyncedAt == null
          ? null
          : String(connection.lastSyncedAt),
      lastErrorCode:
        connection.lastErrorCode == null
          ? null
          : String(connection.lastErrorCode),
      lastErrorMessage:
        connection.lastErrorMessage == null
          ? null
          : String(connection.lastErrorMessage),
      lockCount: Number(connection.lockCount ?? 0) || 0,
    },
    ...(callbackRaw
      ? {
          callback: {
            callbackUrl: String(callbackRaw.callbackUrl ?? ""),
            verificationMode: "verify-by-fetch" as const,
            ready: Boolean(callbackRaw.ready),
            lastReceivedAt:
              callbackRaw.lastReceivedAt == null
                ? null
                : String(callbackRaw.lastReceivedAt),
            lastProcessedAt:
              callbackRaw.lastProcessedAt == null
                ? null
                : String(callbackRaw.lastProcessedAt),
            failedCount: Number(callbackRaw.failedCount ?? 0) || 0,
            unresolvedCount: Number(callbackRaw.unresolvedCount ?? 0) || 0,
            setupHint: String(
              callbackRaw.setupHint ??
                "Callback URL’ni Sciener Developer kabinetida Application tasdiqlangach kiriting."
            ),
          },
        }
      : {}),
  };

  // Mudofaa: to‘liq JSON’da secret kalit bo‘lmasin
  const json = JSON.stringify(status);
  if (SECRET_KEY_RE.test(json) && /clientSecret|access_token|passwordMd5/i.test(json)) {
    return {
      ...status,
      connection: {
        ...status.connection,
        lastErrorMessage: mapTtlockUiError(status.connection.lastErrorCode),
      },
    };
  }
  return status;
}

function normalizeConnectionStatus(value: unknown): TtlockConnectionStatus {
  const s = String(value ?? "disconnected");
  const allowed: TtlockConnectionStatus[] = [
    "disconnected",
    "ready",
    "connected",
    "token_expired",
    "error",
    "syncing",
  ];
  return (allowed.includes(s as TtlockConnectionStatus)
    ? s
    : "disconnected") as TtlockConnectionStatus;
}

export function sanitizeTtlockLocks(raw: unknown): TtlockPublicLock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const onlineStatusRaw = String(o.onlineStatus ?? "UNKNOWN").toUpperCase();
    const onlineStatus =
      onlineStatusRaw === "ONLINE" || onlineStatusRaw === "OFFLINE"
        ? onlineStatusRaw
        : "UNKNOWN";
    return {
      id: String(o.id ?? `lock-${idx}`),
      externalLockId: String(o.externalLockId ?? ""),
      name: String(o.name ?? "Qulf"),
      mac: o.mac == null ? null : String(o.mac),
      model: o.model == null ? null : String(o.model),
      battery:
        typeof o.battery === "number" && o.battery >= 0 && o.battery <= 100
          ? o.battery
          : null,
      hasGateway: Boolean(o.hasGateway),
      remoteUnlock:
        typeof o.remoteUnlock === "boolean" ? o.remoteUnlock : null,
      online:
        onlineStatus === "ONLINE"
          ? true
          : onlineStatus === "OFFLINE"
            ? false
            : null,
      onlineStatus,
      isActive: o.isActive !== false,
      lastSyncedAt:
        o.lastSyncedAt == null ? null : String(o.lastSyncedAt),
    };
  });
}

export function statusLooksSafe(payload: unknown): boolean {
  if (payload == null) return true;
  try {
    const json = JSON.stringify(payload);
    return !/(clientSecret|access_token|refresh_token|"password"|passwordMd5|encryptionKey|credentialEncrypted)/i.test(
      json
    );
  } catch {
    return false;
  }
}
