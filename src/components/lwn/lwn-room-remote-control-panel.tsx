"use client";

import { useState } from "react";
import {
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldOff,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import {
  formatTtlockBattery,
  formatTtlockDateTime,
  mapOnlineStatusLabel,
  mapTtlockUiError,
} from "@/lib/ttlock-settings-view";
import { mapGatewayStatusLabel } from "@/lib/ttlock-room-lock-view";
import type { RemoteControlStatusRecord } from "@/types/smart-lock";

function ActionButton({
  label,
  icon,
  disabled,
  reason,
  loading,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  reason?: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="w-full justify-start sm:w-auto"
      disabled={disabled || loading}
      title={disabled && reason ? reason : undefined}
      onClick={onClick}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

export function LwnRoomRemoteControlPanel({
  roomName,
  apiAvailable,
  remoteStatus,
  statusLoading,
  actionBusy,
  onRefreshStatus,
  onUnlock,
  onLock,
  onCreateTimedPasscode,
  onRevokeAccess,
  onSyncHistory,
}: {
  roomName: string;
  apiAvailable: boolean;
  remoteStatus: RemoteControlStatusRecord | null;
  statusLoading: boolean;
  actionBusy: boolean;
  onRefreshStatus: () => Promise<void>;
  onUnlock: () => Promise<void>;
  onLock: () => Promise<void>;
  onCreateTimedPasscode: () => void;
  onRevokeAccess: () => void;
  onSyncHistory: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<"unlock" | "lock" | null>(null);

  const lockLabel = remoteStatus?.lockName?.trim() || "—";
  const wifiLabel =
    remoteStatus?.wifiRemoteCapable === true
      ? "Wi‑Fi masofadan boshqaruv qo‘llab-quvvatlanadi"
      : remoteStatus?.wifiRemoteCapable === false
        ? "Wi‑Fi masofadan boshqaruv aniqlanmadi"
        : "Wi‑Fi masofadan boshqaruv noma’lum";

  const blockReason =
    remoteStatus && !remoteStatus.remoteReady
      ? remoteStatus.unlockReason ??
        remoteStatus.lockReason ??
        remoteStatus.historyReason
      : null;

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-medium">Masofadan boshqarish</h3>
              <p className="text-sm text-muted-foreground truncate">
                {remoteStatus?.provider ?? "TTLock/Sciener"} · {roomName}
              </p>
            </div>
            <Badge variant={remoteStatus?.remoteReady ? "success" : "warning"}>
              {statusLoading
                ? "Yuklanmoqda…"
                : remoteStatus?.remoteReadyLabel ?? "Holat noma’lum"}
            </Badge>
          </div>

          {blockReason && (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            >
              {blockReason}
            </div>
          )}

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <span className="text-muted-foreground">Qulf nomi: </span>
              <span className="font-medium truncate" title={lockLabel}>
                {lockLabel}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">lockId: </span>
              <span className="font-mono text-xs break-all">
                {remoteStatus?.lockExternalId ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Online: </span>
              {mapOnlineStatusLabel(
                (remoteStatus?.lockOnlineStatus ?? "UNKNOWN") as
                  | "ONLINE"
                  | "OFFLINE"
                  | "UNKNOWN"
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Gateway: </span>
              {remoteStatus?.gatewayName?.trim()
                ? `${remoteStatus.gatewayName} · ${mapGatewayStatusLabel({
                    hasGateway: true,
                    gatewayOnlineStatus:
                      (remoteStatus.gatewayOnlineStatus as
                        | "ONLINE"
                        | "OFFLINE"
                        | "UNKNOWN"
                        | null) ?? null,
                  })}`
                : mapGatewayStatusLabel({
                    hasGateway: false,
                    gatewayOnlineStatus: null,
                  })}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Wi‑Fi remote: </span>
              {wifiLabel}
            </div>
            <div>
              <span className="text-muted-foreground">Batareya: </span>
              {formatTtlockBattery(remoteStatus?.battery ?? null)}
            </div>
            <div>
              <span className="text-muted-foreground">Oxirgi sinxronizatsiya: </span>
              {formatTtlockDateTime(remoteStatus?.lastSyncedAt)}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <ActionButton
              label="Qulfni ochish"
              icon={<Unlock className="size-4" />}
              disabled={!apiAvailable || !remoteStatus?.canUnlock}
              reason={remoteStatus?.unlockReason}
              loading={actionBusy}
              onClick={() => setConfirm("unlock")}
            />
            <ActionButton
              label="Qulfni yopish"
              icon={<Lock className="size-4" />}
              disabled={!apiAvailable || !remoteStatus?.canLock}
              reason={remoteStatus?.lockReason}
              loading={actionBusy}
              onClick={() => setConfirm("lock")}
            />
            <ActionButton
              label="Vaqtli parol yaratish"
              icon={<KeyRound className="size-4" />}
              disabled={!apiAvailable || !remoteStatus?.canCreateTimedPasscode}
              reason={remoteStatus?.passcodeReason}
              onClick={onCreateTimedPasscode}
            />
            <ActionButton
              label="Kirishni bekor qilish"
              icon={<ShieldOff className="size-4" />}
              disabled={!apiAvailable || !remoteStatus?.canRevokeAccess}
              reason={remoteStatus?.revokeReason}
              onClick={onRevokeAccess}
            />
            <ActionButton
              label="Kirish tarixini yangilash"
              icon={<RefreshCw className="size-4" />}
              disabled={!apiAvailable || !remoteStatus?.canSyncHistory}
              reason={remoteStatus?.historyReason}
              loading={actionBusy}
              onClick={() => void onSyncHistory()}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={!apiAvailable || statusLoading}
            onClick={() => void onRefreshStatus()}
          >
            {statusLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Holatni yangilash
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {confirm === "unlock" ? "Qulfni ochish" : "Qulfni yopish"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "unlock"
                ? `“${roomName}” xonasidagi “${lockLabel}” qulfini masofadan ochmoqchimisiz?`
                : `“${roomName}” xonasidagi “${lockLabel}” qulfini masofadan yopmoqchimisiz?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Bekor qilish
            </Button>
            <Button
              disabled={actionBusy}
              onClick={() => {
                const run = confirm === "unlock" ? onUnlock : onLock;
                void run()
                  .then(() => setConfirm(null))
                  .catch((err) => {
                    toast.error(
                      err instanceof ApiError
                        ? mapTtlockUiError(err.code, err.message)
                        : "Amal bajarilmadi"
                    );
                  });
              }}
            >
              {actionBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : confirm === "unlock" ? (
                <Unlock className="size-4" />
              ) : (
                <Lock className="size-4" />
              )}
              {confirm === "unlock" ? "Qulfni ochish" : "Qulfni yopish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
