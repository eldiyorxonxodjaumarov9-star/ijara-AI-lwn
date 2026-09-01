"use client";

import type { ReactNode } from "react";
import {
  Link2,
  Pencil,
} from "lucide-react";

import { LwnRoomLinkLockDialog } from "@/components/lwn/lwn-room-link-lock-dialog";
import { LwnRoomRemoteControlPanel } from "@/components/lwn/lwn-room-remote-control-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { hasSavedLockSettings } from "@/lib/lwn-room-lock-api";
import {
  isTtlockProviderName,
  lockDetailRows,
  TTLOCK_PROVIDER_LABEL,
} from "@/lib/ttlock-room-lock-view";
import type { Property } from "@/types";
import type { RoomLockSettingsRecord } from "@/types/smart-lock";
import type { RemoteControlStatusRecord } from "@/types/smart-lock";
import type { SaveLockSettingsInput } from "@/lib/lwn-room-lock-api";

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-sm font-medium break-words text-right sm:text-left">
        {value}
      </span>
    </div>
  );
}

export function LwnRoomSmartLockTab({
  room,
  settings,
  saving,
  apiAvailable,
  remoteStatus,
  remoteStatusLoading,
  remoteBusy,
  onSaveSettings,
  onAfterLockMutation,
  onRefreshRemoteStatus,
  onRemoteUnlock,
  onRemoteLock,
  onCreateTimedPasscode,
  onRevokeAccess,
  onSyncHistory,
  linkDialogOpen,
  onLinkDialogOpenChange,
}: {
  room: Property;
  settings: RoomLockSettingsRecord | null;
  saving: boolean;
  apiAvailable: boolean;
  remoteStatus: RemoteControlStatusRecord | null;
  remoteStatusLoading: boolean;
  remoteBusy: boolean;
  onSaveSettings: (input: SaveLockSettingsInput) => Promise<void>;
  onAfterLockMutation?: () => Promise<void> | void;
  onRefreshRemoteStatus: () => Promise<void>;
  onRemoteUnlock: () => Promise<void>;
  onRemoteLock: () => Promise<void>;
  onCreateTimedPasscode: () => void;
  onRevokeAccess: () => void;
  onSyncHistory: () => Promise<void>;
  linkDialogOpen: boolean;
  onLinkDialogOpenChange: (open: boolean) => void;
}) {
  const configured = hasSavedLockSettings(settings);
  const isTtlock = isTtlockProviderName(settings?.providerName);
  const linked = settings?.linkedLock ?? null;
  const detail = linked ? lockDetailRows(linked) : null;

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
      >
        {isTtlock && settings?.ttlockCachedLockId
          ? "TTLock qulfi xonaga biriktirilgan. Masofadan boshqarish quyidagi kartada."
          : configured
            ? "Qulf sozlamalari saqlangan — TTLock qulfini biriktiring yoki masofadan boshqarish uchun qulf ulang."
            : "Qulf sozlamalari kiritilmagan. TTLock yoki qo‘lda provayderni biriktiring."}
      </div>

      {!apiAvailable && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Server rejimi yoqilmagan — sozlamalarni saqlab bo&apos;lmaydi.
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Qulf holati</h3>
              <p className="text-sm text-muted-foreground">
                {isTtlock
                  ? "TTLock cache va xona bog‘lanishi"
                  : "Qurilma telemetriyasi integratsiya yoqilgach keladi"}
              </p>
            </div>
            <Badge variant={isTtlock && settings?.ttlockCachedLockId ? "success" : "warning"}>
              {isTtlock && settings?.ttlockCachedLockId
                ? TTLOCK_PROVIDER_LABEL
                : "API ulanmagan"}
            </Badge>
          </div>

          <div className="divide-y rounded-lg border">
            <div className="space-y-3 p-4">
              {detail ? (
                <>
                  <InfoRow label="Provayder" value={detail.provider} />
                  <InfoRow
                    label="Qulf nomi"
                    value={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span title={detail.name}>{detail.name}</span>
                        {detail.inactiveOnAccount && (
                          <Badge variant="warning">
                            TTLock hisobida hozir topilmadi
                          </Badge>
                        )}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Lock ID"
                    value={
                      <span className="font-mono text-xs" title={detail.lockId}>
                        lockId: {detail.lockId}
                      </span>
                    }
                  />
                  <InfoRow label="Online holati" value={detail.onlineLabel} />
                  <InfoRow
                    label="Batareya"
                    value={
                      <span className="inline-flex items-center gap-2">
                        {detail.batteryLabel}
                        {detail.batteryLow && (
                          <Badge variant="destructive" className="font-normal">
                            Past
                          </Badge>
                        )}
                      </span>
                    }
                  />
                  <InfoRow label="Gateway" value={detail.gatewayLabel} />
                  <InfoRow
                    label="Izoh"
                    value={settings?.notes?.trim() || "—"}
                  />
                  <InfoRow
                    label="Oxirgi sinxronlash"
                    value={detail.lastSyncedLabel}
                  />
                </>
              ) : (
                <>
                  <InfoRow
                    label="Provayder"
                    value={settings?.providerName?.trim() || "Ma'lumot yo'q"}
                  />
                  <InfoRow
                    label="Qulf nomi"
                    value={settings?.lockName?.trim() || "—"}
                  />
                  <InfoRow
                    label="Qurilma ID"
                    value={settings?.deviceId?.trim() || "—"}
                  />
                  <InfoRow
                    label="Izoh"
                    value={settings?.notes?.trim() || "—"}
                  />
                  <InfoRow
                    label="API ulanish holati"
                    value={
                      <Badge variant="outline" className="font-normal">
                        Ulanmagan
                      </Badge>
                    }
                  />
                  <InfoRow label="Qurilma aloqasi" value="Noma'lum" />
                  <InfoRow label="Batareya darajasi" value="Ma'lumot yo'q" />
                  <InfoRow label="Qulf holati" value="Noma'lum" />
                  <InfoRow label="Eshik holati" value="Ma'lumot yo'q" />
                  <InfoRow
                    label="Oxirgi sinxronlash"
                    value={
                      settings?.updatedAt
                        ? formatDate(settings.updatedAt)
                        : "—"
                    }
                  />
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onLinkDialogOpenChange(true)}
              disabled={!apiAvailable}
            >
              {configured ? (
                <>
                  <Pencil className="size-4" /> Sozlamalarni tahrirlash
                </>
              ) : (
                <>
                  <Link2 className="size-4" /> Qulf biriktirish
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <LwnRoomRemoteControlPanel
        roomName={room.name}
        apiAvailable={apiAvailable}
        remoteStatus={remoteStatus}
        statusLoading={remoteStatusLoading}
        actionBusy={remoteBusy || saving}
        onRefreshStatus={onRefreshRemoteStatus}
        onUnlock={onRemoteUnlock}
        onLock={onRemoteLock}
        onCreateTimedPasscode={onCreateTimedPasscode}
        onRevokeAccess={onRevokeAccess}
        onSyncHistory={onSyncHistory}
      />

      <LwnRoomLinkLockDialog
        open={linkDialogOpen}
        onOpenChange={onLinkDialogOpenChange}
        room={room}
        initial={settings}
        saving={saving}
        onSave={onSaveSettings}
        onAfterMutation={onAfterLockMutation}
      />
    </div>
  );
}
