"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, isApiConfigured } from "@/lib/api/client";

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Yuklash xatosi");

/**
 * GET `path` while `enabled`. State is only set from async callbacks (no sync setState in effects);
 * `loading` stays true until the first response after enabling.
 */
export function useApiResource<T>(path: string, enabled: boolean) {
  const active = enabled && isApiConfigured;
  const [data, setData] = useState<T | null>(null);
  const [settled, setSettled] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    apiFetch<T>(path)
      .then((res) => {
        if (cancelled) return;
        setData(res ?? null);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorText(err)))
      .finally(() => !cancelled && setSettled(true));
    return () => {
      cancelled = true;
    };
  }, [active, path]);

  const reload = useCallback(async () => {
    if (!active) return;
    setReloading(true);
    try {
      setData((await apiFetch<T>(path)) ?? null);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSettled(true);
      setReloading(false);
    }
  }, [active, path]);

  return {
    data: active ? data : null,
    loading: active && (!settled || reloading),
    error: active ? error : null,
    reload,
  };
}
