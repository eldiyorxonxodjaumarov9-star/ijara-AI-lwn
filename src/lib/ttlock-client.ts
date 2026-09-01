"use client";

import { apiFetch, ApiError, isApiConfigured } from "@/lib/api/client";
import { mapTtlockUiError } from "@/lib/ttlock-settings-view";
import type { TtlockAssignableLock } from "@/types/ttlock-assignable-lock";
import type {
  TtlockPublicLock,
  TtlockPublicStatus,
} from "@/types/ttlock";

export type { TtlockPublicLock, TtlockPublicStatus, TtlockAssignableLock };

export class TtlockClientError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

function toTtlockError(err: unknown): TtlockClientError {
  if (err instanceof TtlockClientError) return err;
  if (err instanceof ApiError) {
    let code = err.code ?? "TTLOCK_API_ERROR";
    if (!err.code) {
      if (err.status === 401) code = "UNAUTHORIZED";
      else if (err.status === 403) code = "FORBIDDEN";
    }
    return new TtlockClientError(mapTtlockUiError(code, err.message), code);
  }
  if (err && typeof err === "object" && "message" in err) {
    return new TtlockClientError(
      mapTtlockUiError("TTLOCK_API_ERROR", String((err as { message: string }).message)),
      "TTLOCK_API_ERROR"
    );
  }
  return new TtlockClientError(
    mapTtlockUiError(null),
    "TTLOCK_API_ERROR"
  );
}

async function ttlockRequest<T>(path: string, method: "GET" | "POST"): Promise<T> {
  if (!isApiConfigured) {
    throw new TtlockClientError(
      mapTtlockUiError("TTLOCK_NOT_CONFIGURED"),
      "TTLOCK_NOT_CONFIGURED"
    );
  }
  try {
    return await apiFetch<T>(path, { method });
  } catch (err) {
    throw toTtlockError(err);
  }
}

export function fetchTtlockStatus() {
  return ttlockRequest<TtlockPublicStatus>(
    "/integrations/ttlock/status",
    "GET"
  );
}

export function connectTtlockAccount() {
  return ttlockRequest<TtlockPublicStatus>(
    "/integrations/ttlock/connect",
    "POST"
  );
}

export function syncTtlockLocks() {
  return ttlockRequest<{
    status: TtlockPublicStatus;
    locks: TtlockPublicLock[];
    upserted: number;
  }>("/integrations/ttlock/sync", "POST");
}

export function fetchTtlockLocks(propertyId?: string) {
  const qs = propertyId
    ? `?propertyId=${encodeURIComponent(propertyId)}`
    : "";
  return ttlockRequest<{
    locks: TtlockPublicLock[] | TtlockAssignableLock[];
    count: number;
    propertyId?: string;
  }>(`/integrations/ttlock/locks${qs}`, "GET");
}

export async function fetchAssignableTtlockLocks(propertyId: string) {
  const data = await fetchTtlockLocks(propertyId);
  return {
    locks: data.locks as TtlockAssignableLock[],
    count: data.count,
  };
}

export function disconnectTtlockAccount() {
  return ttlockRequest<TtlockPublicStatus>(
    "/integrations/ttlock/disconnect",
    "POST"
  );
}
