"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cancelRoomAccessGrant,
  createRoomAccessGrant,
  fetchRemoteControlStatus,
  fetchRoomAccessGrants,
  fetchRoomAccessLog,
  fetchRoomLockSettings,
  isRoomLockApiAvailable,
  remoteLockRoom,
  remoteUnlockRoom,
  saveRoomLockSettings,
  syncRoomAccessGrant,
  syncRoomAccessHistory,
  type AccessLogFilters,
  type CreateAccessGrantInput,
  type SaveLockSettingsInput,
} from "@/lib/lwn-room-lock-api";
import { ApiError } from "@/lib/api/client";
import { stripOneTimePasscode } from "@/lib/ttlock-access-view";
import type {
  RemoteControlStatusRecord,
  RoomAccessGrantRecord,
  RoomLockSettingsRecord,
  SmartLockAccessLogEntry,
} from "@/types/smart-lock";

export function useLwnRoomLockData(propertyId: string | null) {
  const [lockSettings, setLockSettings] = useState<RoomLockSettingsRecord | null>(
    null
  );
  const [accessGrants, setAccessGrants] = useState<RoomAccessGrantRecord[]>([]);
  const [accessLog, setAccessLog] = useState<SmartLockAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logFilters, setLogFilters] = useState<AccessLogFilters>({});
  const [remoteStatus, setRemoteStatus] =
    useState<RemoteControlStatusRecord | null>(null);
  const [remoteStatusLoading, setRemoteStatusLoading] = useState(false);
  const [remoteBusy, setRemoteBusy] = useState(false);

  const apiAvailable = isRoomLockApiAvailable();

  const reloadRemoteStatus = useCallback(async () => {
    if (!propertyId || !apiAvailable) {
      setRemoteStatus(null);
      return;
    }
    setRemoteStatusLoading(true);
    try {
      const status = await fetchRemoteControlStatus(propertyId);
      setRemoteStatus(status);
    } catch {
      setRemoteStatus(null);
    } finally {
      setRemoteStatusLoading(false);
    }
  }, [propertyId, apiAvailable]);

  const reload = useCallback(async () => {
    if (!propertyId || !apiAvailable) {
      setLoading(false);
      setLockSettings(null);
      setAccessGrants([]);
      setAccessLog([]);
      if (!apiAvailable && propertyId) {
        setError("Qulf sozlamalarini saqlash uchun server rejimi kerak");
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [settings, grants, log] = await Promise.all([
        fetchRoomLockSettings(propertyId),
        fetchRoomAccessGrants(propertyId),
        fetchRoomAccessLog(propertyId, logFilters),
      ]);
      setLockSettings(settings);
      setAccessGrants(grants.map(stripOneTimePasscode));
      setAccessLog(log);
      await reloadRemoteStatus();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Ma'lumotlarni yuklab bo'lmadi"
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId, apiAvailable, logFilters, reloadRemoteStatus]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // setState effect synchran emas — avval microtask
      await Promise.resolve();
      if (cancelled) return;
      await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const saveSettings = async (input: SaveLockSettingsInput) => {
    if (!propertyId) return null;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveRoomLockSettings(propertyId, input);
      setLockSettings(saved);
      return saved;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Qulf sozlamalarini saqlab bo'lmadi";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const addGrant = async (input: CreateAccessGrantInput) => {
    if (!propertyId) return null;
    setSaving(true);
    setError(null);
    try {
      const created = await createRoomAccessGrant(propertyId, input);
      setAccessGrants((prev) => [stripOneTimePasscode(created), ...prev]);
      return created;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Kirish huquqini saqlab bo'lmadi";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const cancelGrant = async (grantId: string) => {
    if (!propertyId) return null;
    setSaving(true);
    setError(null);
    try {
      const updated = await cancelRoomAccessGrant(propertyId, grantId);
      setAccessGrants((prev) =>
        prev.map((g) => (g.id === grantId ? stripOneTimePasscode(updated) : g))
      );
      return updated;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Bekor qilib bo'lmadi";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const syncGrant = async (grantId: string) => {
    if (!propertyId) return null;
    setSaving(true);
    setError(null);
    try {
      const updated = await syncRoomAccessGrant(propertyId, grantId);
      setAccessGrants((prev) =>
        prev.map((g) =>
          g.id === grantId ? stripOneTimePasscode(updated) : g
        )
      );
      return updated;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "TTLock’ga yuborib bo‘lmadi";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const refreshLog = async (filters?: AccessLogFilters) => {
    if (!propertyId || !apiAvailable) return;
    const next = filters ?? logFilters;
    if (filters) setLogFilters(next);
    try {
      const log = await fetchRoomAccessLog(propertyId, next);
      setAccessLog(log);
    } catch {
      /* jurnal bo'sh qoladi */
    }
  };

  const runRemoteUnlock = async () => {
    if (!propertyId) return;
    setRemoteBusy(true);
    setError(null);
    try {
      const res = await remoteUnlockRoom(propertyId);
      await reloadRemoteStatus();
      return res;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Qulfni ochib bo'lmadi";
      setError(message);
      throw err;
    } finally {
      setRemoteBusy(false);
    }
  };

  const runRemoteLock = async () => {
    if (!propertyId) return;
    setRemoteBusy(true);
    setError(null);
    try {
      const res = await remoteLockRoom(propertyId);
      await reloadRemoteStatus();
      return res;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Qulfni yopib bo'lmadi";
      setError(message);
      throw err;
    } finally {
      setRemoteBusy(false);
    }
  };

  const runSyncHistory = async () => {
    if (!propertyId) return null;
    setRemoteBusy(true);
    setError(null);
    try {
      const res = await syncRoomAccessHistory(propertyId);
      await refreshLog();
      await reloadRemoteStatus();
      return res;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Kirish tarixini yangilab bo'lmadi";
      setError(message);
      throw err;
    } finally {
      setRemoteBusy(false);
    }
  };

  return {
    apiAvailable,
    lockSettings,
    accessGrants,
    accessLog,
    logFilters,
    remoteStatus,
    remoteStatusLoading,
    remoteBusy,
    loading,
    saving,
    error,
    reload,
    reloadRemoteStatus,
    saveSettings,
    addGrant,
    cancelGrant,
    syncGrant,
    refreshLog,
    runRemoteUnlock,
    runRemoteLock,
    runSyncHistory,
    setLogFilters,
  };
}
