"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import {
  connectTtlockAccount,
  disconnectTtlockAccount,
  fetchTtlockLocks,
  fetchTtlockStatus,
  syncTtlockLocks,
  TtlockClientError,
} from "@/lib/ttlock-client";
import {
  TTLOCK_DISCONNECT_CONFIRM,
  TTLOCK_EMPTY_LOCKS_MESSAGE,
  TTLOCK_MIGRATION_REQUIRED_MESSAGE,
  TTLOCK_NOT_CONFIGURED_MESSAGE,
  badgeLabelForPhase,
  badgeVariantForPhase,
  canConnect,
  canDisconnect,
  canManageTtlock,
  canSync,
  deriveTtlockPanelPhase,
  formatTtlockBattery,
  formatTtlockDateTime,
  mapOnlineStatusLabel,
  mapTtlockUiError,
  sanitizeTtlockLocks,
  sanitizeTtlockStatus,
  type TtlockUiBusy,
} from "@/lib/ttlock-settings-view";
import type { TtlockPublicLock, TtlockPublicStatus } from "@/types/ttlock";

export function TtlockSettingsPanel() {
  const { user } = useAuth();
  const allowed = canManageTtlock(user?.role);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<TtlockPublicStatus | null>(null);
  const [locks, setLocks] = useState<TtlockPublicLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<TtlockUiBusy>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyStatus = useCallback((raw: unknown) => {
    const safe = sanitizeTtlockStatus(raw);
    if (safe) setStatus(safe);
  }, []);

  const load = useCallback(async () => {
    if (!allowed) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const s = await fetchTtlockStatus();
      if (!mountedRef.current) return;
      setMigrationRequired(false);
      setForbidden(false);
      applyStatus(s);
      if (s.connection.connected || s.connection.lockCount > 0) {
        try {
          const list = await fetchTtlockLocks();
          if (!mountedRef.current) return;
          setLocks(sanitizeTtlockLocks(list.locks));
        } catch {
          if (mountedRef.current) setLocks([]);
        }
      } else {
        setLocks([]);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const code = err instanceof TtlockClientError ? err.code : "";
      if (
        code === "DATABASE_MIGRATION_REQUIRED" ||
        code === "TTLOCK_DB_UNAVAILABLE"
      ) {
        setMigrationRequired(true);
        setStatus(null);
        setLocks([]);
      } else if (code === "FORBIDDEN" || code === "TTLOCK_FORBIDDEN") {
        setForbidden(true);
      } else {
        setLoadError(
          err instanceof TtlockClientError
            ? err.message
            : mapTtlockUiError(null)
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [allowed, applyStatus]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const phase = deriveTtlockPanelPhase({
    loading,
    busy,
    forbidden,
    migrationRequired,
    status,
  });

  const onConnect = async () => {
    if (!canConnect(phase, busy)) return;
    setBusy("connect");
    try {
      const s = await connectTtlockAccount();
      if (!mountedRef.current) return;
      applyStatus(s);
      toast.success("TTLock hisobi muvaffaqiyatli ulandi.");
      await load();
    } catch (err) {
      if (!mountedRef.current) return;
      toast.error(
        err instanceof TtlockClientError
          ? err.message
          : mapTtlockUiError(null)
      );
      await load();
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const onSync = async () => {
    if (!canSync(phase, busy)) return;
    setBusy("sync");
    try {
      const result = await syncTtlockLocks();
      if (!mountedRef.current) return;
      applyStatus(result.status);
      setLocks(sanitizeTtlockLocks(result.locks));
      toast.success("TTLock qulflari muvaffaqiyatli sinxronlashtirildi.");
    } catch (err) {
      if (!mountedRef.current) return;
      toast.error(
        err instanceof TtlockClientError
          ? err.message
          : mapTtlockUiError(null)
      );
      await load();
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const onDisconnectConfirm = async () => {
    if (busy !== null) return;
    setBusy("disconnect");
    try {
      const s = await disconnectTtlockAccount();
      if (!mountedRef.current) return;
      applyStatus(s);
      setLocks([]);
      setDisconnectOpen(false);
      toast.success("TTLock ulanishi uzildi");
      await load();
    } catch (err) {
      if (!mountedRef.current) return;
      toast.error(
        err instanceof TtlockClientError
          ? err.message
          : mapTtlockUiError(null)
      );
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  if (!allowed || phase === "forbidden") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" /> TTLock/Sciener
          </CardTitle>
          <CardDescription>
            Aqilli qulflarni xonalar va arendator kirish huquqlari bilan boshqarish
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {mapTtlockUiError("FORBIDDEN")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "loading") {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-44" />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            TTLock holati yuklanmoqda...
          </p>
        </CardContent>
      </Card>
    );
  }

  const conn = status?.connection;
  const showLocksSection =
    phase === "connected" ||
    phase === "syncing" ||
    (conn?.lockCount ?? 0) > 0 ||
    locks.length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5 shrink-0" /> TTLock/Sciener
              </CardTitle>
              <CardDescription className="mt-1">
                Aqilli qulflarni xonalar va arendator kirish huquqlari bilan
                boshqarish
              </CardDescription>
            </div>
            <Badge variant={badgeVariantForPhase(phase)}>
              {badgeLabelForPhase(phase)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {phase === "not_configured" && (
            <div
              role="status"
              className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{TTLOCK_NOT_CONFIGURED_MESSAGE}</p>
            </div>
          )}

          {phase === "migration_required" && (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{TTLOCK_MIGRATION_REQUIRED_MESSAGE}</p>
            </div>
          )}

          {phase === "token_expired" && (
            <div
              role="status"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100"
            >
              TTLock ulanish muddati tugagan. Qayta ulang.
            </div>
          )}

          {(phase === "error" || loadError) && (
            <div
              role="alert"
              className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <p>
                {loadError ||
                  mapTtlockUiError(
                    conn?.lastErrorCode,
                    conn?.lastErrorMessage
                  )}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void load()}
                disabled={busy !== null}
              >
                Qayta urinish
              </Button>
            </div>
          )}

          {phase !== "migration_required" && status && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Provayder</p>
                <p className="font-medium">TTLock/Sciener</p>
              </div>
              {conn?.ttlockUid &&
                (phase === "connected" ||
                  phase === "token_expired" ||
                  phase === "syncing") && (
                  <div>
                    <p className="text-muted-foreground">TTLock hisob ID</p>
                    <p className="font-medium break-all">{conn.ttlockUid}</p>
                  </div>
                )}
              <div>
                <p className="text-muted-foreground">Token amal qilish muddati</p>
                <p className="font-medium">
                  {phase === "connected" ||
                  phase === "token_expired" ||
                  phase === "syncing"
                    ? formatTtlockDateTime(conn?.tokenExpiresAt)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Oxirgi sinxronizatsiya</p>
                <p className="font-medium">
                  {phase === "connected" ||
                  phase === "token_expired" ||
                  phase === "syncing" ||
                  (conn?.lockCount ?? 0) > 0
                    ? formatTtlockDateTime(conn?.lastSyncedAt)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Topilgan qulflar</p>
                <p className="font-medium">{conn?.lockCount ?? locks.length} ta</p>
              </div>
            </div>
          )}

          {status?.callback && (
            <div className="space-y-3 rounded-lg border p-3 text-sm">
              <p className="font-medium">Callback URL</p>
              <p className="break-all font-mono text-xs">{status.callback.callbackUrl}</p>
              <p className="text-muted-foreground">{status.callback.setupHint}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Tasdiqlash usuli</p>
                  <p className="font-medium">verify-by-fetch</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Holat</p>
                  <p className="font-medium">
                    {status.callback.ready ? "Tayyor" : "Sozlanmagan"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Oxirgi callback</p>
                  <p className="font-medium">
                    {formatTtlockDateTime(status.callback.lastReceivedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Oxirgi muvaffaqiyatli qayta ishlash</p>
                  <p className="font-medium">
                    {formatTtlockDateTime(status.callback.lastProcessedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Failed / unresolved</p>
                  <p className="font-medium">
                    {status.callback.failedCount} / {status.callback.unresolvedCount}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void onConnect()}
              disabled={
                !canConnect(phase, busy) ||
                phase === "not_configured" ||
                phase === "migration_required"
              }
              aria-label="TTLock hisobiga ulash"
            >
              {busy === "connect" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Link2 className="size-4" aria-hidden />
              )}
              {busy === "connect" ? "Ulanmoqda..." : "TTLock hisobiga ulash"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void onSync()}
              disabled={
                !canSync(phase, busy) || phase === "migration_required"
              }
              aria-label="Qulflarni sinxronlashtirish"
            >
              {busy === "sync" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              {busy === "sync"
                ? "Sinxronlanmoqda..."
                : "Qulflarni sinxronlashtirish"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDisconnectOpen(true)}
              disabled={
                !canDisconnect(
                  phase,
                  busy,
                  Boolean(conn?.connected || conn?.ttlockUid)
                )
              }
              aria-label="TTLock ulanishini uzish"
            >
              {busy === "disconnect" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Unplug className="size-4" aria-hidden />
              )}
              Ulanishni uzish
            </Button>
          </div>

          {showLocksSection && (
            <div className="overflow-hidden rounded-lg border">
              <div className="border-b px-3 py-2 text-sm font-medium">
                Sinxronlangan qulflar ({locks.length})
              </div>
              {locks.length === 0 ? (
                <div className="space-y-3 px-3 py-4 text-sm text-muted-foreground">
                  <p>{TTLOCK_EMPTY_LOCKS_MESSAGE}</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>TTLock mobil ilovasini oching.</li>
                    <li>Qulfni Bluetooth orqali hisobga qo‘shing.</li>
                    <li>Arenda AI’ga qaytib, sinxronlashtiring.</li>
                  </ol>
                </div>
              ) : (
                <ul className="max-h-80 divide-y overflow-y-auto text-sm">
                  {locks.map((lock) => (
                    <li
                      key={lock.id}
                      className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{lock.name}</p>
                        <p className="break-all text-xs text-muted-foreground">
                          lockId: {lock.externalLockId}
                        </p>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                        <p>{mapOnlineStatusLabel(lock.onlineStatus)}</p>
                        <p>Batareya: {formatTtlockBattery(lock.battery)}</p>
                        <p>
                          Gateway:{" "}
                          {lock.hasGateway ? "Mavjud" : "Yo‘q"}
                        </p>
                        <p>
                          Sinxron: {formatTtlockDateTime(lock.lastSyncedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ulanishni uzish</DialogTitle>
            <DialogDescription>{TTLOCK_DISCONNECT_CONFIRM}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDisconnectOpen(false)}
              disabled={busy === "disconnect"}
            >
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onDisconnectConfirm()}
              disabled={busy === "disconnect"}
              aria-label="Ulanishni uzishni tasdiqlash"
            >
              {busy === "disconnect" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Uzishni tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
