"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Loader2, Save, Unlink } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import type { SaveLockSettingsInput } from "@/lib/lwn-room-lock-api";
import {
  fetchAssignableTtlockLocks,
  fetchTtlockStatus,
  TtlockClientError,
} from "@/lib/ttlock-client";
import {
  filterAssignableLocks,
  isTtlockProviderName,
  LOCK_NOTES_MAX_LENGTH,
  lockDetailRows,
  lockSelectPrimaryLabel,
  lockSelectSecondaryLabel,
  sanitizeAssignableLocks,
  TTLOCK_MIGRATION_REQUIRED_MESSAGE,
  TTLOCK_NO_LOCKS_MESSAGE,
  TTLOCK_NOT_CONNECTED_ROOM_MESSAGE,
  TTLOCK_PROVIDER_LABEL,
  TTLOCK_UNLINK_CONFIRM,
} from "@/lib/ttlock-room-lock-view";
import { mapTtlockUiError } from "@/lib/ttlock-settings-view";
import { cn } from "@/lib/utils";
import type { Property } from "@/types";
import type { RoomLockSettingsRecord } from "@/types/smart-lock";
import type { TtlockAssignableLock } from "@/types/ttlock-assignable-lock";

type ProviderMode = "ttlock" | "manual";

function LockedDetailCard({ lock }: { lock: TtlockAssignableLock }) {
  const d = lockDetailRows(lock);
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium truncate" title={d.name}>
          {d.name}
        </span>
        {d.inactiveOnAccount && (
          <Badge variant="warning">TTLock hisobida hozir topilmadi</Badge>
        )}
        {d.batteryLow && (
          <Badge variant="destructive" className="font-normal">
            Past batareya
          </Badge>
        )}
      </div>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Provayder</dt>
          <dd>{d.provider}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lock ID</dt>
          <dd className="truncate font-mono text-xs" title={d.lockId}>
            lockId: {d.lockId}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Online holati</dt>
          <dd>{d.onlineLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Batareya</dt>
          <dd>{d.batteryLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Gateway</dt>
          <dd>{d.gatewayLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Oxirgi sinxronlash</dt>
          <dd>{d.lastSyncedLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

function LwnRoomLinkLockForm({
  room,
  initial,
  saving,
  onSave,
  onAfterMutation,
  onOpenChange,
}: {
  room: Property;
  initial: RoomLockSettingsRecord | null;
  saving: boolean;
  onSave: (input: SaveLockSettingsInput) => Promise<void>;
  onAfterMutation?: () => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
}) {
  const wasTtlock = isTtlockProviderName(initial?.providerName);
  const [providerMode, setProviderMode] = useState<ProviderMode>(
    wasTtlock ? "ttlock" : "manual"
  );
  const [manualProvider, setManualProvider] = useState(
    wasTtlock ? "" : (initial?.providerName ?? "")
  );
  const [lockName, setLockName] = useState(initial?.lockName ?? "");
  const [deviceId, setDeviceId] = useState(initial?.deviceId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [selectedLockId, setSelectedLockId] = useState<string | null>(
    initial?.ttlockCachedLockId ?? null
  );
  const [locks, setLocks] = useState<TtlockAssignableLock[]>([]);
  const [locksLoading, setLocksLoading] = useState(false);
  const [locksError, setLocksError] = useState<string | null>(null);
  const [locksErrorCode, setLocksErrorCode] = useState<string | null>(null);
  const [ttlockConnected, setTtlockConnected] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const busy = saving || submitting;
  const previousLockId = initial?.ttlockCachedLockId ?? null;

  const loadTtlockData = async () => {
    setLocksLoading(true);
    setLocksError(null);
    setLocksErrorCode(null);
    try {
      const status = await fetchTtlockStatus();
      setTtlockConnected(Boolean(status.connection.connected));
      if (!status.connection.connected) {
        setLocks([]);
        return;
      }
      const res = await fetchAssignableTtlockLocks(room.id);
      setLocks(sanitizeAssignableLocks(res.locks));
    } catch (err) {
      const code =
        err instanceof TtlockClientError
          ? err.code
          : err instanceof ApiError
            ? err.code ?? null
            : null;
      setLocksErrorCode(code);
      setLocksError(
        err instanceof Error ? err.message : mapTtlockUiError(code)
      );
      setLocks([]);
      setTtlockConnected(null);
    } finally {
      setLocksLoading(false);
    }
  };

  useEffect(() => {
    if (providerMode !== "ttlock") return;
    let cancelled = false;
    void (async () => {
      setLocksLoading(true);
      setLocksError(null);
      setLocksErrorCode(null);
      try {
        const status = await fetchTtlockStatus();
        if (cancelled) return;
        setTtlockConnected(Boolean(status.connection.connected));
        if (!status.connection.connected) {
          setLocks([]);
          return;
        }
        const res = await fetchAssignableTtlockLocks(room.id);
        if (cancelled) return;
        setLocks(sanitizeAssignableLocks(res.locks));
      } catch (err) {
        if (cancelled) return;
        const code =
          err instanceof TtlockClientError
            ? err.code
            : err instanceof ApiError
              ? err.code ?? null
              : null;
        setLocksErrorCode(code);
        setLocksError(
          err instanceof Error ? err.message : mapTtlockUiError(code)
        );
        setLocks([]);
        setTtlockConnected(null);
      } finally {
        if (!cancelled) setLocksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerMode, room.id]);

  const filtered = useMemo(
    () => filterAssignableLocks(locks, search),
    [locks, search]
  );

  const selectedLock = useMemo(() => {
    if (!selectedLockId) return null;
    return (
      locks.find((l) => l.id === selectedLockId) ??
      initial?.linkedLock ??
      null
    );
  }, [selectedLockId, locks, initial?.linkedLock]);

  const handleSave = async () => {
    if (busy) return;
    setSubmitting(true);
    try {
      if (providerMode === "ttlock") {
        if (!selectedLockId) {
          toast.info("TTLock qulfini tanlang");
          return;
        }
        const isReplace =
          Boolean(previousLockId) && previousLockId !== selectedLockId;
        const isSame = previousLockId === selectedLockId;
        await onSave({
          providerName: TTLOCK_PROVIDER_LABEL,
          ttlockCachedLockId: selectedLockId,
          notes: notes.trim() || null,
        });
        if (isReplace) {
          toast.success("Xonaga biriktirilgan qulf yangilandi.");
        } else if (isSame && previousLockId) {
          toast.success("Qulf sozlamalari saqlandi");
        } else {
          toast.success("Qulf xonaga muvaffaqiyatli biriktirildi.");
        }
        await onAfterMutation?.();
        onOpenChange(false);
        return;
      }

      const lock = lockName.trim();
      const device = deviceId.trim();
      if (!lock || !device) {
        toast.info("Qulf nomi va qurilma ID majburiy");
        return;
      }
      await onSave({
        providerName: manualProvider.trim(),
        lockName: lock,
        deviceId: device,
        notes: notes.trim() || null,
        ttlockCachedLockId: null,
      });
      toast.success("Qulf sozlamalari saqlandi");
      await onAfterMutation?.();
      onOpenChange(false);
    } catch {
      /* tanlov saqlanadi */
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    setSubmitting(true);
    try {
      await onSave({
        providerName: TTLOCK_PROVIDER_LABEL,
        ttlockCachedLockId: null,
        notes: notes.trim() || null,
      });
      toast.success("Qulf xonadan muvaffaqiyatli ajratildi.");
      await onAfterMutation?.();
      onOpenChange(false);
    } catch {
      /* keep */
    } finally {
      setSubmitting(false);
    }
  };

  const showMigration =
    locksErrorCode === "DATABASE_MIGRATION_REQUIRED" ||
    locksErrorCode === "TTLOCK_DB_UNAVAILABLE";

  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label>Xona</Label>
          <Input value={room.name} disabled readOnly />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lock-provider-mode">Provayder</Label>
          <Select
            value={providerMode}
            onValueChange={(v) =>
              setProviderMode(v === "ttlock" ? "ttlock" : "manual")
            }
          >
            <SelectTrigger id="lock-provider-mode" className="w-full">
              <SelectValue placeholder="Provayder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ttlock">{TTLOCK_PROVIDER_LABEL}</SelectItem>
              <SelectItem value="manual">Qo‘lda / boshqa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {providerMode === "ttlock" ? (
          <div className="space-y-3">
            {locksLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Qulflar yuklanmoqda…
              </div>
            )}

            {showMigration && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
              >
                {TTLOCK_MIGRATION_REQUIRED_MESSAGE}
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void loadTtlockData()}
                  >
                    Qayta urinish
                  </Button>
                </div>
              </div>
            )}

            {!locksLoading && !showMigration && ttlockConnected === false && (
              <div role="status" className="space-y-2 rounded-lg border p-3 text-sm">
                <p>{TTLOCK_NOT_CONNECTED_ROOM_MESSAGE}</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/settings?tab=integrations">
                    Integratsiyalarni ochish
                  </Link>
                </Button>
              </div>
            )}

            {!locksLoading &&
              !showMigration &&
              ttlockConnected &&
              locks.length === 0 &&
              !locksError && (
                <div
                  role="status"
                  className="space-y-2 rounded-lg border p-3 text-sm"
                >
                  <p>{TTLOCK_NO_LOCKS_MESSAGE}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/settings?tab=integrations">
                      Qulflarni sinxronlashtirish
                    </Link>
                  </Button>
                </div>
              )}

            {locksError && !showMigration && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
              >
                <p>{locksError}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadTtlockData()}
                >
                  Qayta urinish
                </Button>
              </div>
            )}

            {ttlockConnected && locks.length > 0 && (
              <div className="space-y-1.5">
                <Label>TTLock qulfi</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={pickerOpen}
                      aria-label="TTLock qulfini tanlash"
                      className="h-auto min-h-9 w-full justify-between px-3 py-2 text-left font-normal"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {selectedLock
                          ? `${lockSelectPrimaryLabel(selectedLock)} · lockId: ${selectedLock.externalLockId}`
                          : "Qulfni tanlang…"}
                      </span>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
                    align="start"
                  >
                    <div className="border-b p-2">
                      <Input
                        placeholder="Nom, lockId yoki MAC…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Qulf qidirish"
                        className="h-9"
                      />
                    </div>
                    <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
                      {filtered.length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          Mos qulf topilmadi
                        </li>
                      )}
                      {filtered.map((lock) => {
                        const disabled = !lock.selectable;
                        const selected = selectedLockId === lock.id;
                        return (
                          <li
                            key={lock.id}
                            role="option"
                            aria-selected={selected}
                          >
                            <button
                              type="button"
                              disabled={disabled}
                              title={`${lock.name} · ${lock.externalLockId}${lock.mac ? ` · ${lock.mac}` : ""}`}
                              className={cn(
                                "flex w-full items-start gap-2 px-3 py-2 text-left text-sm",
                                disabled
                                  ? "cursor-not-allowed opacity-50"
                                  : "hover:bg-accent",
                                selected && "bg-accent/60"
                              )}
                              onClick={() => {
                                if (disabled) return;
                                setSelectedLockId(lock.id);
                                setPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mt-0.5 size-4 shrink-0",
                                  selected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {lockSelectPrimaryLabel(lock)}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {lockSelectSecondaryLabel(lock)}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {selectedLock && <LockedDetailCard lock={selectedLock} />}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="lock-provider">Provayder nomi</Label>
              <Input
                id="lock-provider"
                placeholder="Kelajakdagi provayder"
                value={manualProvider}
                onChange={(e) => setManualProvider(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lock-name">Qulf nomi</Label>
              <Input
                id="lock-name"
                placeholder="Masalan: Asosiy eshik qulfi"
                value={lockName}
                onChange={(e) => setLockName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lock-device-id">Qurilma ID</Label>
              <Input
                id="lock-device-id"
                placeholder="Provayder identifikatori"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="lock-notes">Izoh</Label>
          <Textarea
            id="lock-notes"
            rows={3}
            maxLength={LOCK_NOTES_MAX_LENGTH}
            placeholder="Qo'shimcha eslatma..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {providerMode === "ttlock" && previousLockId && (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => setUnlinkOpen(true)}
              aria-label="Qulfni ajratish"
            >
              <Unlink className="size-4" />
              Qulfni ajratish
            </Button>
          )}
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Bekor qilish
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saqlanmoqda...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Saqlash
              </>
            )}
          </Button>
        </div>
      </DialogFooter>

      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title="Qulfni ajratish"
        description={TTLOCK_UNLINK_CONFIRM}
        confirmText="Ajratish"
        onConfirm={handleUnlink}
      />
    </>
  );
}

export function LwnRoomLinkLockDialog({
  open,
  onOpenChange,
  room,
  initial,
  saving,
  onSave,
  onAfterMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Property;
  initial: RoomLockSettingsRecord | null;
  saving: boolean;
  onSave: (input: SaveLockSettingsInput) => Promise<void>;
  onAfterMutation?: () => Promise<void> | void;
}) {
  const formKey = `${initial?.id ?? "new"}:${initial?.updatedAt ?? "0"}:${open ? "1" : "0"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Qulf sozlamalari</DialogTitle>
          <DialogDescription>
            {room.name} uchun qulf biriktirish. TTLock tanlanganda qulf
            hisobdan tanlanadi; boshqa provayderlar uchun qo‘lda kiritiladi.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <LwnRoomLinkLockForm
            key={formKey}
            room={room}
            initial={initial}
            saving={saving}
            onSave={onSave}
            onAfterMutation={onAfterMutation}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
