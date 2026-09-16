"use client";

/**
 * NestJS/embedded API mijozi.
 * - NEXT_PUBLIC_API_URL o'rnatilganda "API rejim" yoqiladi.
 * - Access/refresh tokenlar localStorage da saqlanadi.
 * - 401 holatida access token avtomatik yangilanadi (refresh).
 */

function resolveApiBaseUrl(
  raw: string | undefined = process.env.NEXT_PUBLIC_API_URL
): string | undefined {
  const trimmed = raw?.trim().replace(/\/$/, "");
  if (!trimmed) return undefined;

  // Absolute origin without /api → append /api (avoids /auth/login HTML 404).
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const path = url.pathname.replace(/\/$/, "");
      if (!path || path === "/") {
        return `${url.origin}/api`;
      }
      return `${url.origin}${path}`;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

const RAW_API_URL = resolveApiBaseUrl();

export const API_URL = RAW_API_URL;
export const isApiConfigured = Boolean(RAW_API_URL);

const ACCESS_KEY = "arendahub:access";
const REFRESH_KEY = "arendahub:refresh";
const PORTAL_TOKEN_KEY = "arendahub:portalToken";

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/** Signed portal (tenant) session JWT from POST /portal/lookup */
export const portalTokenStore = {
  get token() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(PORTAL_TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PORTAL_TOKEN_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(PORTAL_TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  /** Bearer portal JWT (tenant session); skips staff access-token refresh */
  portalAuth?: boolean;
  isForm?: boolean;
}

let refreshing: Promise<boolean> | null = null;

function buildMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const m = (payload as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

function userFacingMessage(status: number, fallback: string): string {
  if (fallback && fallback.trim() && !/unexpected token|<!doctype/i.test(fallback)) {
    return fallback;
  }
  if (status === 401 || status === 403) {
    return "Email yoki parol noto‘g‘ri.";
  }
  if (status >= 500) {
    return "Kirish vaqtida server xatosi yuz berdi.";
  }
  if (status === 0) {
    return "Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.";
  }
  return "So‘rovda xatolik yuz berdi.";
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return null;

  const looksJson =
    contentType.includes("application/json") ||
    contentType.includes("+json") ||
    /^[\s]*[{[]/.test(text);

  if (!looksJson || contentType.includes("text/html")) {
    console.error("[apiFetch] Non-JSON response", {
      url: response.url,
      status: response.status,
      contentType,
      preview: text.slice(0, 160),
    });
    throw new ApiError(
      "Serverdan noto‘g‘ri javob olindi.",
      response.status || 0,
      "INVALID_RESPONSE"
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.error("[apiFetch] JSON parse failed", {
      url: response.url,
      status: response.status,
      contentType,
      preview: text.slice(0, 160),
      err,
    });
    throw new ApiError(
      "Serverdan noto‘g‘ri javob olindi.",
      response.status || 0,
      "INVALID_JSON"
    );
  }
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh || !API_URL) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return false;
        const json = (await parseResponseBody(res)) as {
          data?: { accessToken?: string; refreshToken?: string };
          accessToken?: string;
          refreshToken?: string;
        } | null;
        const data = json && typeof json === "object" ? (json.data ?? json) : null;
        if (data && typeof data === "object" && "accessToken" in data && data.accessToken) {
          tokenStore.set(String(data.accessToken), data.refreshToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError("API sozlanmagan", 0, "API_NOT_CONFIGURED");
  }

  const {
    auth = true,
    portalAuth = false,
    isForm = false,
    body,
    headers,
    ...rest
  } = options;

  const doRequest = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };
    if (!isForm) finalHeaders["Content-Type"] = "application/json";
    if (portalAuth && portalTokenStore.token) {
      finalHeaders["Authorization"] = `Bearer ${portalTokenStore.token}`;
    } else if (auth && tokenStore.access) {
      finalHeaders["Authorization"] = `Bearer ${tokenStore.access}`;
    }
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: isForm
        ? (body as BodyInit)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
  };

  let response: Response;
  try {
    response = await doRequest();
  } catch (err) {
    console.error("[apiFetch] network error", { path, err });
    throw new ApiError(
      "Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.",
      0,
      "NETWORK"
    );
  }

  if (response.status === 401 && auth && !portalAuth && tokenStore.refresh) {
    const ok = await tryRefresh();
    if (ok) {
      response = await doRequest();
    } else {
      tokenStore.clear();
    }
  }

  const json = await parseResponseBody(response);

  if (!response.ok) {
    const code =
      json &&
      typeof json === "object" &&
      "error" in json &&
      (json as { error?: { code?: string } }).error?.code
        ? String((json as { error: { code: string } }).error.code)
        : undefined;
    const rawMessage = buildMessage(json, "So'rovda xatolik yuz berdi");
    throw new ApiError(
      userFacingMessage(response.status, rawMessage),
      response.status,
      code
    );
  }

  // Backend muvaffaqiyatli javoblarni { success, data } ko'rinishida o'raydi
  return ((json && typeof json === "object" && "data" in json
    ? (json as { data: T }).data
    : json) ?? null) as T;
}

/** Authenticated binary download (e.g. private task attachments proxy). */
export async function apiFetchBlob(
  path: string,
  options: Omit<RequestOptions, "body" | "isForm"> = {}
): Promise<Blob> {
  if (!API_URL) {
    throw new ApiError("API sozlanmagan", 0, "API_NOT_CONFIGURED");
  }

  const { auth = true, headers, ...rest } = options;

  const doRequest = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };
    if (auth && tokenStore.access) {
      finalHeaders["Authorization"] = `Bearer ${tokenStore.access}`;
    }
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
    });
  };

  let response: Response;
  try {
    response = await doRequest();
  } catch {
    throw new ApiError(
      "Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.",
      0,
      "NETWORK"
    );
  }

  if (response.status === 401 && auth && tokenStore.refresh) {
    const okRefresh = await tryRefresh();
    if (okRefresh) response = await doRequest();
    else tokenStore.clear();
  }

  if (!response.ok) {
    let message = "Faylni yuklab bo‘lmadi";
    try {
      const json = await parseResponseBody(response);
      message = buildMessage(json, message);
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status);
  }

  return response.blob();
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Test/helper export */
export const __test = { resolveApiBaseUrl };
