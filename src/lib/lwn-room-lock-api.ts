"use client";

import { apiFetch, isApiConfigured } from "@/lib/api/client";
import type {
  RoomAccessGrantRecord,
  RoomLockSettingsRecord,
  SmartLockAccessLogEntry,
} from "@/types/smart-lock";

export type SaveLockSettingsInput = {
  providerName?: string;
  lockName?: string;
  deviceId?: string;
  notes?: string | null;
  ttlockCachedLockId?: string | null;
  clearNotes?: boolean;
};

export type CreateAccessGrantInput = {
  tenantId: string;
  permissionType: string;
  validFrom?: string;
  validTo?: string;
  notes?: string;
  autoSync?: boolean;
};

export type AccessLogFilters = {
  dateFrom?: string;
  dateTo?: string;
  eventType?: string;
};

export function isRoomLockApiAvailable() {
  return isApiConfigured;
}

export async function fetchRoomLockSettings(propertyId: string) {
  return apiFetch<RoomLockSettingsRecord | null>(
    `/lwn-rooms/${propertyId}/lock-settings`
  );
}

export async function saveRoomLockSettings(
  propertyId: string,
  input: SaveLockSettingsInput
) {
  return apiFetch<RoomLockSettingsRecord>(
    `/lwn-rooms/${propertyId}/lock-settings`,
    { method: "PUT", body: input }
  );
}

export async function fetchRoomAccessGrants(propertyId: string) {
  return apiFetch<RoomAccessGrantRecord[]>(
    `/lwn-rooms/${propertyId}/access-grants`
  );
}

export async function createRoomAccessGrant(
  propertyId: string,
  input: CreateAccessGrantInput
) {
  return apiFetch<RoomAccessGrantRecord>(
    `/lwn-rooms/${propertyId}/access-grants`,
    { method: "POST", body: input }
  );
}

export async function syncRoomAccessGrant(
  propertyId: string,
  grantId: string
) {
  return apiFetch<RoomAccessGrantRecord>(
    `/lwn-rooms/${propertyId}/access-grants/${grantId}/sync`,
    { method: "POST", body: {} }
  );
}

export async function cancelRoomAccessGrant(
  propertyId: string,
  grantId: string
) {
  return apiFetch<RoomAccessGrantRecord>(
    `/lwn-rooms/${propertyId}/access-grants/${grantId}`,
    { method: "PATCH", body: { status: "cancelled" } }
  );
}

export async function fetchRoomAccessLog(
  propertyId: string,
  filters: AccessLogFilters = {}
) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.eventType) params.set("eventType", filters.eventType);
  const qs = params.toString();
  return apiFetch<SmartLockAccessLogEntry[]>(
    `/lwn-rooms/${propertyId}/access-log${qs ? `?${qs}` : ""}`
  );
}

export function hasSavedLockSettings(
  settings: RoomLockSettingsRecord | null | undefined
) {
  if (!settings) return false;
  return Boolean(
    settings.lockName?.trim() ||
      settings.deviceId?.trim() ||
      settings.providerName?.trim() ||
      settings.ttlockCachedLockId
  );
}

export async function fetchRemoteControlStatus(propertyId: string) {
  return apiFetch<import("@/types/smart-lock").RemoteControlStatusRecord>(
    `/lwn-rooms/${propertyId}/remote-control/status`
  );
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function remoteUnlockRoom(propertyId: string) {
  const idempotencyKey = newIdempotencyKey();
  return apiFetch<{ command: unknown; userMessage: string }>(
    `/lwn-rooms/${propertyId}/remote-control/unlock`,
    {
      method: "POST",
      body: { idempotencyKey },
      headers: { "Idempotency-Key": idempotencyKey },
    }
  );
}

export async function remoteLockRoom(propertyId: string) {
  const idempotencyKey = newIdempotencyKey();
  return apiFetch<{ command: unknown; userMessage: string }>(
    `/lwn-rooms/${propertyId}/remote-control/lock`,
    {
      method: "POST",
      body: { idempotencyKey },
      headers: { "Idempotency-Key": idempotencyKey },
    }
  );
}

export async function syncRoomAccessHistory(propertyId: string) {
  return apiFetch<{
    newRecords: number;
    scannedRecords: number;
    lastSyncedAt: string;
    userMessage: string;
  }>(`/lwn-rooms/${propertyId}/access-history/sync`, {
    method: "POST",
    body: {},
  });
}
