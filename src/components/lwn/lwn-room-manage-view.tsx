"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, DoorOpen, Pencil } from "lucide-react";
import { toast } from "sonner";

import { LwnRoomAccessLogTab } from "@/components/lwn/lwn-room-access-log-tab";
import { LwnRoomAccessRightsTab } from "@/components/lwn/lwn-room-access-rights-tab";
import { LwnRoomGeneralTab } from "@/components/lwn/lwn-room-general-tab";
import { LwnRoomRevokeAccessDialog } from "@/components/lwn/lwn-room-revoke-access-dialog";
import { LwnRoomSmartLockTab } from "@/components/lwn/lwn-room-smart-lock-tab";
import { LwnRoomDialog } from "@/components/lwn/lwn-room-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useCollection } from "@/hooks/use-collection";
import { useLwnRoomLockData } from "@/hooks/use-lwn-room-lock-data";
import { ApiError } from "@/lib/api/client";
import { mapTtlockUiError } from "@/lib/ttlock-settings-view";
import { hasSavedLockSettings } from "@/lib/lwn-room-lock-api";
import {
  getRoomContractTenants,
  getRoomObjectLabel,
  resolveLwnRoomById,
} from "@/lib/lwn-room-detail";
import { PROPERTY_STATUS_MAP } from "@/lib/constants";

import type { Contract, Property, Tenant } from "@/types";

export function LwnRoomManageView({ roomId }: { roomId: string }) {
  const { data: properties, loading: propertiesLoading } =
    useCollection<Property>("properties");
  const { data: contracts, loading: contractsLoading } =
    useCollection<Contract>("contracts");
  const { data: tenants, loading: tenantsLoading } =
    useCollection<Tenant>("tenants");

  const [tab, setTab] = useState("general");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const room = useMemo(
    () => resolveLwnRoomById(roomId, properties),
    [roomId, properties]
  );

  const {
    apiAvailable,
    lockSettings,
    accessGrants,
    accessLog,
    loading: lockLoading,
    saving,
    error: lockError,
    reload,
    reloadRemoteStatus,
    saveSettings,
    addGrant,
    cancelGrant,
    syncGrant,
    refreshLog,
    remoteStatus,
    remoteStatusLoading,
    remoteBusy,
    runRemoteUnlock,
    runRemoteLock,
    runSyncHistory,
  } = useLwnRoomLockData(room?.id ?? null);

  const roomTenants = useMemo(
    () =>
      room ? getRoomContractTenants(room.id, contracts, tenants) : [],
    [room, contracts, tenants]
  );

  const collectionsLoading =
    propertiesLoading || contractsLoading || tenantsLoading;

  if (collectionsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!room) {
    return (
      <EmptyState
        icon={DoorOpen}
        title="Xona topilmadi"
        description="So'ralgan xona mavjud emas yoki LWN xonalar ro'yxatiga kirmaydi."
        action={
          <Button asChild variant="outline">
            <Link href="/lwn-rooms">
              <ArrowLeft className="size-4" /> Xonalar ro&apos;yxatiga qaytish
            </Link>
          </Button>
        }
      />
    );
  }

  const status = PROPERTY_STATUS_MAP[room.status];
  const tenantSummary =
    roomTenants.length > 0
      ? roomTenants.map((t) => t.fullName).join(", ")
      : "Arendator biriktirilmagan";
  const settingsSaved = hasSavedLockSettings(lockSettings);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/lwn-rooms">
              <ArrowLeft className="size-4" /> Xonalar ro&apos;yxatiga qaytish
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {room.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {getRoomObjectLabel(room)} · {tenantSummary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status?.variant}>{status?.label}</Badge>
            <Badge variant="outline">
              Aqlli qulf:{" "}
              {lockSettings?.ttlockCachedLockId
                ? "TTLock biriktirilgan"
                : settingsSaved
                  ? "Sozlamalar saqlangan"
                  : "Ulanmagan"}
            </Badge>
            <Badge
              variant={
                lockSettings?.ttlockCachedLockId ? "success" : "warning"
              }
            >
              {lockSettings?.ttlockCachedLockId
                ? "TTLock/Sciener"
                : "API ulanmagan"}
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" /> Xonani tahrirlash
        </Button>
      </div>

      {lockError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {lockError}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="general">Umumiy ma&apos;lumot</TabsTrigger>
          <TabsTrigger value="smart-lock">Aqlli qulf</TabsTrigger>
          <TabsTrigger value="access-log">Kirish-chiqish jurnali</TabsTrigger>
          <TabsTrigger value="access-rights">Kirish huquqlari</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <LwnRoomGeneralTab room={room} tenants={roomTenants} />
        </TabsContent>

        <TabsContent value="smart-lock" className="mt-6">
          {lockLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <LwnRoomSmartLockTab
              room={room}
              settings={lockSettings}
              saving={saving}
              apiAvailable={apiAvailable}
              remoteStatus={remoteStatus}
              remoteStatusLoading={remoteStatusLoading}
              remoteBusy={remoteBusy}
              onSaveSettings={async (input) => {
                await saveSettings(input);
              }}
              onAfterLockMutation={async () => {
                await reload();
              }}
              onRefreshRemoteStatus={reloadRemoteStatus}
              onRemoteUnlock={async () => {
                const res = await runRemoteUnlock();
                toast.success(
                  res?.userMessage ??
                    "Qulfni ochish buyrug‘i muvaffaqiyatli yuborildi."
                );
              }}
              onRemoteLock={async () => {
                const res = await runRemoteLock();
                toast.success(
                  res?.userMessage ??
                    "Qulfni yopish buyrug‘i muvaffaqiyatli yuborildi."
                );
              }}
              onCreateTimedPasscode={() => setTab("access-rights")}
              onRevokeAccess={() => setRevokeOpen(true)}
              onSyncHistory={async () => {
                try {
                  const res = await runSyncHistory();
                  toast.success(res?.userMessage ?? "Kirish tarixi yangilandi.");
                } catch (err) {
                  toast.error(
                    err instanceof ApiError
                      ? mapTtlockUiError(err.code, err.message)
                      : "Kirish tarixini yangilab bo‘lmadi"
                  );
                  throw err;
                }
              }}
              linkDialogOpen={linkDialogOpen}
              onLinkDialogOpenChange={setLinkDialogOpen}
            />
          )}
        </TabsContent>

        <TabsContent value="access-log" className="mt-6">
          <LwnRoomAccessLogTab
            entries={accessLog}
            hasLockSettings={settingsSaved}
            loading={lockLoading}
            onApplyFilters={(filters) => void refreshLog(filters)}
          />
        </TabsContent>

        <TabsContent value="access-rights" className="mt-6">
          {lockLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <LwnRoomAccessRightsTab
              roomName={room.name}
              tenants={roomTenants}
              grants={accessGrants}
              lockSettings={lockSettings}
              saving={saving}
              apiAvailable={apiAvailable}
              onAddGrant={async (input) => addGrant(input)}
              onCancelGrant={async (grantId) => {
                await cancelGrant(grantId);
              }}
              onSyncGrant={async (grantId) => syncGrant(grantId)}
            />
          )}
        </TabsContent>
      </Tabs>

      <LwnRoomRevokeAccessDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        grants={accessGrants}
        saving={saving}
        onRevoke={async (grantId) => {
          try {
            await cancelGrant(grantId);
            await reloadRemoteStatus();
          } catch (err) {
            toast.error(
              err instanceof ApiError
                ? mapTtlockUiError(err.code, err.message)
                : "Bekor qilib bo‘lmadi"
            );
            throw err;
          }
        }}
      />

      <LwnRoomDialog open={editOpen} onOpenChange={setEditOpen} room={room} />
    </div>
  );
}
