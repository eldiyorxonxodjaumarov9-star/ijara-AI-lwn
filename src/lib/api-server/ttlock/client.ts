/**
 * TTLock/Sciener V3 HTTP client (server-only).
 * Maxfiy parametrlar logga yozilmaydi.
 */

import { readTtlockEnvConfig, type TtlockEnvConfig } from "./config";
import { mapTtlockBusinessCode, TtlockError } from "./errors";
import {
  TTLOCK_ENDPOINTS,
  type TtlockKeyboardPwdDeleteResponse,
  type TtlockKeyboardPwdGetResponse,
  type TtlockKeyDeleteResponse,
  type TtlockKeySendResponse,
  type TtlockLockCommandResponse,
  type TtlockLockDetailResponse,
  type TtlockGatewayDetailResponse,
  type TtlockLockListResponse,
  type TtlockLockRecordListResponse,
  type TtlockTokenResponse,
} from "./types";

const DEFAULT_TIMEOUT_MS = 20_000;
const REMOTE_COMMAND_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

type FormParams = Record<string, string | number | undefined | null>;

function nowMs(): number {
  return Date.now();
}

function toFormBody(params: FormParams): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    body.set(key, String(value));
  }
  return body.toString();
}

function requireConfig(): TtlockEnvConfig {
  const cfg = readTtlockEnvConfig();
  if (!cfg) {
    throw new TtlockError(
      "TTLock API ma'lumotlari hali serverga kiritilmagan. Application tasdiqlangach client_id va client_secretni server environment sozlamalariga kiriting.",
      "TTLOCK_NOT_CONFIGURED",
      503
    );
  }
  return cfg;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function ttlockFetchJson<T>(
  path: string,
  params: FormParams,
  options?: { timeoutMs?: number; retrySafe?: boolean }
): Promise<T> {
  const cfg = requireConfig();
  const url = `${cfg.apiBaseUrl}${path}`;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const body = toFormBody(params);

  let lastError: unknown;
  const attempts = options?.retrySafe ? MAX_RETRIES + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });

      if (res.status === 429) {
        throw new TtlockError(
          "TTLock so'rov limiti oshdi. Birozdan keyin qayta urinib ko'ring.",
          "TTLOCK_RATE_LIMITED",
          429
        );
      }

      const text = await res.text();
      let json: T & { errcode?: number; errmsg?: string };
      try {
        json = (text ? JSON.parse(text) : {}) as T & {
          errcode?: number;
          errmsg?: string;
        };
      } catch {
        throw new TtlockError(
          "TTLock javobi JSON emas",
          "TTLOCK_HTTP_ERROR",
          502
        );
      }

      if (!res.ok) {
        throw new TtlockError(
          "TTLock serveriga ulanishda xatolik",
          "TTLOCK_HTTP_ERROR",
          502
        );
      }

      if (
        typeof json.errcode === "number" &&
        json.errcode !== 0 &&
        // ba'zi muvaffaqiyatli javoblarda errcode yo‘q
        json.errcode !== undefined
      ) {
        // Token javobida access_token bilan birga errcode=0
        if (!(json as { access_token?: string }).access_token) {
          throw mapTtlockBusinessCode(json.errcode, json.errmsg);
        }
      }

      return json as T;
    } catch (err) {
      lastError = err;
      if (err instanceof TtlockError) {
        if (err.code === "TTLOCK_RATE_LIMITED" && attempt < attempts - 1) {
          await sleep(800 * (attempt + 1));
          continue;
        }
        throw err;
      }
      if (
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("aborted"))
      ) {
        throw new TtlockError(
          "TTLock so'rovi vaqti tugadi",
          "TTLOCK_TIMEOUT",
          504
        );
      }
      if (options?.retrySafe && attempt < attempts - 1) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw new TtlockError(
        "TTLock tarmoq xatosi",
        "TTLOCK_HTTP_ERROR",
        502
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof TtlockError
    ? lastError
    : new TtlockError("TTLock so'rovi muvaffaqiyatsiz", "TTLOCK_UNKNOWN", 502);
}

export async function fetchAccessToken(): Promise<TtlockTokenResponse> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockTokenResponse>(
    TTLOCK_ENDPOINTS.oauthToken,
    {
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      username: cfg.username,
      password: cfg.passwordMd5,
    }
  );

  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapTtlockBusinessCode(json.errcode, json.errmsg);
  }
  if (!json.access_token || !json.refresh_token || !json.expires_in) {
    throw new TtlockError(
      "TTLock token javobi to'liq emas",
      "TTLOCK_API_ERROR",
      502
    );
  }
  return json;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TtlockTokenResponse> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockTokenResponse>(
    TTLOCK_ENDPOINTS.oauthToken,
    {
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }
  );

  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapTtlockBusinessCode(json.errcode, json.errmsg);
  }
  if (!json.access_token || !json.refresh_token || !json.expires_in) {
    throw new TtlockError(
      "TTLock refresh javobi to'liq emas",
      "TTLOCK_API_ERROR",
      502
    );
  }
  return json;
}

export async function fetchLockListPage(input: {
  accessToken: string;
  pageNo: number;
  pageSize?: number;
}): Promise<TtlockLockListResponse> {
  const cfg = requireConfig();
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 100));
  const json = await ttlockFetchJson<TtlockLockListResponse>(
    TTLOCK_ENDPOINTS.lockList,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      pageNo: input.pageNo,
      pageSize,
      date: nowMs(),
      type: 1,
    },
    { retrySafe: true }
  );

  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapTtlockBusinessCode(json.errcode, json.errmsg);
  }
  return json;
}

export async function fetchAllLocks(accessToken: string) {
  const all: NonNullable<TtlockLockListResponse["list"]> = [];
  let pageNo = 1;
  const pageSize = 100;
  // Xavfsiz yuqori chegara
  for (let i = 0; i < 50; i++) {
    const page = await fetchLockListPage({ accessToken, pageNo, pageSize });
    const list = page.list ?? [];
    all.push(...list);
    if (list.length < pageSize) break;
    pageNo += 1;
  }
  return all;
}

/** Rasmiy: muddatli parol yaratish (cloud) — keyboardPwd + keyboardPwdId */
export async function createKeyboardPwd(input: {
  accessToken: string;
  lockId: string | number;
  startDateMs: number;
  endDateMs: number;
  /** 3 = period (rasmiy) */
  keyboardPwdType?: number;
}): Promise<{ keyboardPwd: string; keyboardPwdId: string }> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockKeyboardPwdGetResponse>(
    TTLOCK_ENDPOINTS.keyboardPwdGet,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      lockId: input.lockId,
      keyboardPwdType: input.keyboardPwdType ?? 3,
      startDate: input.startDateMs,
      endDate: input.endDateMs,
      date: nowMs(),
    }
    // timeout/noma’lum → blind retry YO‘Q
  );

  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapTtlockBusinessCode(json.errcode, json.errmsg);
  }
  const keyboardPwd = String(json.keyboardPwd ?? "").trim();
  const keyboardPwdId = String(json.keyboardPwdId ?? "").trim();
  if (!keyboardPwd || !keyboardPwdId) {
    throw new TtlockError(
      "TTLock parol javobi to'liq emas",
      "TTLOCK_API_ERROR",
      502
    );
  }
  return { keyboardPwd, keyboardPwdId };
}

/** Rasmiy: passcode o‘chirish (gateway/WiFi: deleteType=2) */
export async function deleteKeyboardPwd(input: {
  accessToken: string;
  lockId: string | number;
  keyboardPwdId: string | number;
  deleteType?: number;
}): Promise<void> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockKeyboardPwdDeleteResponse>(
    TTLOCK_ENDPOINTS.keyboardPwdDelete,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      lockId: input.lockId,
      keyboardPwdId: input.keyboardPwdId,
      deleteType: input.deleteType ?? 2,
      date: nowMs(),
    }
  );
  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapTtlockBusinessCode(json.errcode, json.errmsg);
  }
}

/** Rasmiy: eKey yuborish */
export async function sendEkey(input: {
  accessToken: string;
  lockId: string | number;
  receiverUsername: string;
  keyName: string;
  startDateMs: number;
  endDateMs: number;
  remarks?: string;
}): Promise<{ keyId: string }> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockKeySendResponse>(
    TTLOCK_ENDPOINTS.keySend,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      lockId: input.lockId,
      receiverUsername: input.receiverUsername,
      keyName: input.keyName,
      startDate: input.startDateMs,
      endDate: input.endDateMs,
      remarks: input.remarks,
      date: nowMs(),
    }
  );
  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapTtlockBusinessCode(json.errcode, json.errmsg);
  }
  const keyId = String(json.keyId ?? "").trim();
  if (!keyId) {
    throw new TtlockError(
      "TTLock eKey javobi to'liq emas",
      "TTLOCK_API_ERROR",
      502
    );
  }
  return { keyId };
}

/** Rasmiy: eKey o‘chirish */
export async function deleteEkey(input: {
  accessToken: string;
  keyId: string | number;
}): Promise<void> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockKeyDeleteResponse>(
    TTLOCK_ENDPOINTS.keyDelete,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      keyId: input.keyId,
      date: nowMs(),
    }
  );
  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapTtlockBusinessCode(json.errcode, json.errmsg);
  }
}

async function ttlockFetchGetJson<T>(
  path: string,
  params: FormParams,
  options?: { timeoutMs?: number }
): Promise<T> {
  const cfg = requireConfig();
  const qs = toFormBody(params);
  const url = `${cfg.apiBaseUrl}${path}?${qs}`;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 429) {
      throw new TtlockError(
        "TTLock so'rov limiti oshdi. Birozdan keyin qayta urinib ko'ring.",
        "TTLOCK_RATE_LIMITED",
        429
      );
    }
    const text = await res.text();
    let json: T & { errcode?: number; errmsg?: string };
    try {
      json = (text ? JSON.parse(text) : {}) as T & {
        errcode?: number;
        errmsg?: string;
      };
    } catch {
      throw new TtlockError(
        "TTLock javobi JSON emas",
        "TTLOCK_HTTP_ERROR",
        502
      );
    }
    if (!res.ok) {
      throw new TtlockError(
        "TTLock serveriga ulanishda xatolik",
        "TTLOCK_HTTP_ERROR",
        502
      );
    }
    if (typeof json.errcode === "number" && json.errcode !== 0) {
      throw mapTtlockBusinessCode(json.errcode, json.errmsg);
    }
    return json as T;
  } catch (err) {
    if (err instanceof TtlockError) throw err;
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"))
    ) {
      throw new TtlockError(
        "TTLock so'rovi vaqti tugadi",
        "TTLOCK_TIMEOUT",
        504
      );
    }
    throw new TtlockError(
      "TTLock tarmoq xatosi",
      "TTLOCK_HTTP_ERROR",
      502
    );
  } finally {
    clearTimeout(timer);
  }
}

function mapRemoteCommandBusinessCode(
  errcode: number,
  errmsg: string | undefined,
  kind: "unlock" | "lock"
): TtlockError {
  if (errcode === -4043) {
    return new TtlockError(
      kind === "unlock"
        ? "Bu qulf masofadan ochishni qo'llamaydi."
        : "Bu qulf masofadan yopishni qo'llamaydi.",
      kind === "unlock"
        ? "TTLOCK_REMOTE_UNLOCK_UNSUPPORTED"
        : "TTLOCK_REMOTE_LOCK_UNSUPPORTED",
      400,
      errcode
    );
  }
  return mapTtlockBusinessCode(errcode, errmsg);
}

/** Rasmiy: masofadan ochish — POST /v3/lock/unlock (blind retry yo‘q) */
export async function remoteUnlockLock(input: {
  accessToken: string;
  lockId: string | number;
}): Promise<void> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockLockCommandResponse>(
    TTLOCK_ENDPOINTS.lockUnlock,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      lockId: input.lockId,
      date: nowMs(),
    },
    { timeoutMs: REMOTE_COMMAND_TIMEOUT_MS }
  );
  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapRemoteCommandBusinessCode(json.errcode, json.errmsg, "unlock");
  }
}

/** Rasmiy: masofadan yopish — POST /v3/lock/lock (blind retry yo‘q) */
export async function remoteLockLock(input: {
  accessToken: string;
  lockId: string | number;
}): Promise<void> {
  const cfg = requireConfig();
  const json = await ttlockFetchJson<TtlockLockCommandResponse>(
    TTLOCK_ENDPOINTS.lockLock,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      lockId: input.lockId,
      date: nowMs(),
    },
    { timeoutMs: REMOTE_COMMAND_TIMEOUT_MS }
  );
  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw mapRemoteCommandBusinessCode(json.errcode, json.errmsg, "lock");
  }
}

/** Rasmiy: kirish tarixi — GET /v3/lockRecord/list */
export async function fetchLockRecordPage(input: {
  accessToken: string;
  lockId: string | number;
  pageNo: number;
  pageSize?: number;
  startDateMs?: number;
  endDateMs?: number;
}): Promise<TtlockLockRecordListResponse> {
  const cfg = requireConfig();
  const pageSize = Math.min(200, Math.max(1, input.pageSize ?? 100));
  return ttlockFetchGetJson<TtlockLockRecordListResponse>(
    TTLOCK_ENDPOINTS.lockRecordList,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      lockId: input.lockId,
      pageNo: input.pageNo,
      pageSize,
      ...(input.startDateMs != null ? { startDate: input.startDateMs } : {}),
      ...(input.endDateMs != null ? { endDate: input.endDateMs } : {}),
      date: nowMs(),
    },
    { timeoutMs: REMOTE_COMMAND_TIMEOUT_MS }
  );
}

export function buildRemoteUnlockRequestFields(input: {
  lockId: string | number;
}) {
  return { lockId: input.lockId };
}

export function buildRemoteLockRequestFields(input: {
  lockId: string | number;
}) {
  return { lockId: input.lockId };
}

export function buildLockRecordListQueryFields(input: {
  lockId: string | number;
  pageNo: number;
  pageSize: number;
  startDateMs?: number;
  endDateMs?: number;
}) {
  return {
    lockId: input.lockId,
    pageNo: input.pageNo,
    pageSize: input.pageSize,
    ...(input.startDateMs != null ? { startDate: input.startDateMs } : {}),
    ...(input.endDateMs != null ? { endDate: input.endDateMs } : {}),
  };
}

/** Rasmiy: qulf tafsilotlari — GET /v3/lock/detail */
export async function fetchLockDetail(input: {
  accessToken: string;
  lockId: string | number;
}): Promise<TtlockLockDetailResponse> {
  const cfg = requireConfig();
  return ttlockFetchGetJson<TtlockLockDetailResponse>(
    TTLOCK_ENDPOINTS.lockDetail,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      lockId: input.lockId,
      date: nowMs(),
    }
  );
}

/** Rasmiy: gateway tafsilotlari — GET /v3/gateway/detail */
export async function fetchGatewayDetail(input: {
  accessToken: string;
  gatewayId: string | number;
}): Promise<TtlockGatewayDetailResponse> {
  const cfg = requireConfig();
  return ttlockFetchGetJson<TtlockGatewayDetailResponse>(
    TTLOCK_ENDPOINTS.gatewayDetail,
    {
      clientId: cfg.clientId,
      accessToken: input.accessToken,
      gatewayId: input.gatewayId,
      date: nowMs(),
    }
  );
}
