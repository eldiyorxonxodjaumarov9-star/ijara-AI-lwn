"use client";

/**
 * NestJS backend bilan ishlash uchun API mijozi.
 * - NEXT_PUBLIC_API_URL o'rnatilganda "API rejim" yoqiladi.
 * - Access/refresh tokenlar localStorage da saqlanadi.
 * - 401 holatida access token avtomatik yangilanadi (refresh).
 */

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export const API_URL = RAW_API_URL;
export const isApiConfigured = Boolean(RAW_API_URL);

const ACCESS_KEY = "arendahub:access";
const REFRESH_KEY = "arendahub:refresh";

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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return false;
        const json = await res.json();
        const data = json?.data ?? json;
        if (data?.accessToken) {
          tokenStore.set(data.accessToken, data.refreshToken);
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

function buildMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const m = (payload as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string") return m;
  }
  return fallback;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, isForm = false, body, headers, ...rest } = options;

  const doRequest = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };
    if (!isForm) finalHeaders["Content-Type"] = "application/json";
    if (auth && tokenStore.access) {
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

  let response = await doRequest();

  if (response.status === 401 && auth && tokenStore.refresh) {
    const ok = await tryRefresh();
    if (ok) {
      response = await doRequest();
    } else {
      tokenStore.clear();
    }
  }

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      buildMessage(json, "So'rovda xatolik yuz berdi"),
      response.status,
    );
  }

  // Backend muvaffaqiyatli javoblarni { success, data } ko'rinishida o'raydi
  return (json?.data ?? json) as T;
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
