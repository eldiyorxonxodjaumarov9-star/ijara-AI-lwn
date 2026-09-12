"use client";

import { useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldOff,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoomTenantRow } from "@/lib/lwn-room-detail";
import { formatDate } from "@/lib/utils";
import type { CreateAccessGrantInput } from "@/lib/lwn-room-lock-api";
import { EKEY_RECEIVER_MISSING_HINT } from "@/lib/ttlock-access-view";
import type { RoomLockSettingsRecord } from "@/types/smart-lock";
import type { RoomAccessGrantRecord } from "@/types/smart-lock";
import {
  ACCESS_PERMISSION_LABELS,
  TTLOCK_ACCESS_UI_TYPES,
  type AccessPermissionType,
} from "@/types/smart-lock";
import { TTLOCK_PROVIDER_LABEL } from "@/lib/ttlock-room-lock-view";
import {
  formatTtlockBattery,
  mapOnlineStatusLabel,
} from "@/lib/ttlock-settings-view";
import { mapGatewayStatusLabel } from "@/lib/ttlock-room-lock-view";
import {
  CUSTOM_PIN_GATEWAY_REQUIRED_MESSAGE,
  CUSTOM_PIN_MAX_LEN,
  CUSTOM_PIN_MIN_LEN,
  validateCustomKeyboardPin,
} from "@/lib/ttlock-custom-pin";

function effectiveBadgeVariant(
  status: string | undefined
): "default" | "secondary" | "warning" | "destructive" | "success" | "outline" {
  switch (status) {
    case "FAOL":
      return "success";
    case "API_YUBORILGAN":
      return "default";
    case "REJALASHTIRILGAN":
    case "YUBORILMOQDA":
    case "BEKOR_KUTILMOQDA":
      return "warning";
    case "XATOLIK":
      return "destructive";
    case "TUGAGAN":
    case "BEKOR_QILINGAN":
      return "secondary";
    default:
      return "outline";
  }
}

function toastForGrantResult(created: RoomAccessGrantRecord | null | void) {
  const msg =
    created && "userMessage" in created && created.userMessage
      ? created.userMessage
      : "Kirish huquqi saqlandi.";
  const outcome =
    created && "syncOutcome" in created ? created.syncOutcome : undefined;
  if (outcome === "install_blocked" || outcome === "failed_keep_plan") {
    toast.error(msg);
    return;
  }
  if (outcome === "cloud_accepted") {
    toast.message(msg);
    return;
  }
  toast.success(msg);
}

export function LwnRoomAccessRightsTab({
  roomName,
  tenants,
  grants,
  lockSettings,
  saving,
  apiAvailable,
  onAddGrant,
  onCancelGrant,
  onSyncGrant,
}: {
  roomName: string;
  tenants: RoomTenantRow[];
  grants: RoomAccessGrantRecord[];
  lockSettings: RoomLockSettingsRecord | null;
  saving: boolean;
  apiAvailable: boolean;
  onAddGrant: (input: CreateAccessGrantInput) => Promise<RoomAccessGrantRecord | null | void>;
  onCancelGrant: (grantId: string) => Promise<void>;
  onSyncGrant: (grantId: string) => Promise<RoomAccessGrantRecord | null | void>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [permissionType, setPermissionType] =
    useState<AccessPermissionType>("pin");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [customPin, setCustomPin] = useState("");
  const [oneTimePin, setOneTimePin] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const linked = lockSettings?.linkedLock ?? null;
  const hasLock = Boolean(lockSettings?.ttlockCachedLockId && linked);
  const hasGatewayOrWifi = Boolean(linked?.hasGateway);

  const selectedTenant = tenants.find((t) => t.tenantId === tenantId);
  const ekeyReceiverResolved =
    permissionType === "app"
      ? (selectedTenant?.email?.trim() ||
          selectedTenant?.phone?.trim() ||
          "")
      : "";
  const ekeyReceiverMissing =
    permissionType === "app" && Boolean(tenantId) && !ekeyReceiverResolved;

  const resetForm = () => {
    setTenantId("");
    setValidFrom("");
    setValidTo("");
    setNotes("");
    setCustomPin("");
  };

  const handleSave = async (autoSync: boolean) => {
    if (!tenantId) {
      toast.info("Arendator tanlang");
      return;
    }
    if (!validFrom || !validTo) {
      toast.info("Boshlanish va tugash vaqtini kiriting");
      return;
    }
    if (permissionType === "pin") {
      const pinCheck = validateCustomKeyboardPin(customPin);
      if (!pinCheck.ok) {
        toast.info(pinCheck.message);
        return;
      }
    }
    try {
      const created = await onAddGrant({
        tenantId,
        permissionType,
        validFrom,
        validTo,
        notes: notes.trim() || undefined,
        autoSync,
        customPin: permissionType === "pin" ? customPin.trim() : undefined,
      });
      toastForGrantResult(created);
      if (created?.oneTimePasscode) {
        setOneTimePin(created.oneTimePasscode);
      }
      resetForm();
    } catch {
      /* hook */
    }
  };

  const handleSync = async (grantId: string) => {
    if (busyId) return;
    setBusyId(grantId);
    try {
      const updated = await onSyncGrant(grantId);
      toastForGrantResult(updated);
      if (updated?.oneTimePasscode) {
        setOneTimePin(updated.oneTimePasscode);
      }
    } catch {
      /* hook */
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (grantId: string) => {
    if (busyId) return;
    setBusyId(grantId);
    try {
      await onCancelGrant(grantId);
      toast.success("Kirish huquqi bekor qilindi.");
    } catch {
      /* hook — xato toast hookda */
    } finally {
      setBusyId(null);
    }
  };

  const canRetry = (g: RoomAccessGrantRecord) => {
    const code = g.delivery?.lastErrorCode;
    if (code === "TTLOCK_RESULT_UNKNOWN") return false;
    if (g.delivery?.externalAccessId) return false;
    if (g.status === "cancelled") return false;
    const sync = g.delivery?.syncStatus;
    return (
      !g.delivery?.hasCredential ||
      sync === "PLANNED" ||
      sync === "FAILED" ||
      g.effectiveStatus === "REJALASHTIRILGAN" ||
      g.effectiveStatus === "XATOLIK"
    );
  };

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="rounded-xl border border-muted bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      >
        Reja PostgreSQL’da saqlanadi. Maxsus PIN faqat shifrlangan holda
        saqlanadi va umumiy javoblarda ko‘rsatilmaydi. Qulf biriktirilmagan
        bo‘lsa ham reja yaratiladi, lekin qurilmaga yuborilmaydi.
      </div>

      {!apiAvailable && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Server rejimi yoqilmagan — kirish huquqlarini saqlab bo&apos;lmaydi.
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 p-5 text-sm">
          <h3 className="font-medium">Xona va qulf</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Xona</span>
              <p className="font-medium">{roomName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Provayder</span>
              <p className="font-medium">{TTLOCK_PROVIDER_LABEL}</p>
            </div>
            {hasLock && linked ? (
              <>
                <div>
                  <span className="text-muted-foreground">Qulf</span>
                  <p className="font-medium truncate" title={linked.name}>
                    {linked.name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">lockId</span>
                  <p className="font-mono text-xs">{linked.externalLockId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Online</span>
                  <p>{mapOnlineStatusLabel(linked.onlineStatus)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Batareya</span>
                  <p>{formatTtlockBattery(linked.battery)}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Gateway</span>
                  <p>
                    {mapGatewayStatusLabel({
                      hasGateway: linked.hasGateway,
                      gatewayOnlineStatus: linked.gatewayOnlineStatus,
                    })}
                  </p>
                </div>
              </>
            ) : (
              <p className="sm:col-span-2 text-amber-700 dark:text-amber-300">
                Qulf biriktirilmagan — reja saqlanadi, qurilmaga yuborilmaydi.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {hasLock && !hasGatewayOrWifi && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          {CUSTOM_PIN_GATEWAY_REQUIRED_MESSAGE}
        </div>
      )}

      <Card id="timed-passcode-form">
        <CardContent className="space-y-4 p-5">
          <h3 className="font-medium">Yangi kirish huquqi / vaqtli parol</h3>
          {tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ushbu xonaga tegishli shartnomali arendator yo&apos;q.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Arendator</Label>
                  <Select
                    value={tenantId}
                    onValueChange={setTenantId}
                    disabled={!apiAvailable}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.tenantId} value={t.tenantId}>
                          {t.fullName}
                          {t.phone ? ` · ${t.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kirish turi</Label>
                  <Select
                    value={permissionType}
                    onValueChange={(v) =>
                      setPermissionType(v as AccessPermissionType)
                    }
                    disabled={!apiAvailable}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TTLOCK_ACCESS_UI_TYPES.map((key) => (
                        <SelectItem key={key} value={key}>
                          {ACCESS_PERMISSION_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Boshlanish (Toshkent)</Label>
                  <Input
                    type="datetime-local"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    disabled={!apiAvailable}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tugash (Toshkent)</Label>
                  <Input
                    type="datetime-local"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    disabled={!apiAvailable}
                  />
                </div>
                {permissionType === "pin" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="custom-pin-input">
                      PIN-kod ({CUSTOM_PIN_MIN_LEN}–{CUSTOM_PIN_MAX_LEN} raqam)
                    </Label>
                    <Input
                      id="custom-pin-input"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={CUSTOM_PIN_MAX_LEN}
                      value={customPin}
                      onChange={(e) =>
                        setCustomPin(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder={`${CUSTOM_PIN_MIN_LEN}–${CUSTOM_PIN_MAX_LEN} raqam`}
                      disabled={!apiAvailable}
                    />
                    <p className="text-xs text-muted-foreground">
                      PIN chat, URL yoki umumiy API javoblarida ko‘rsatilmaydi.
                    </p>
                  </div>
                )}
                {permissionType === "app" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>eKey receiver</Label>
                    <Input
                      value={ekeyReceiverResolved || "—"}
                      readOnly
                      disabled
                      aria-label="eKey receiver (tenant telefon/email)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Server tenant telefon/emailidan oladi; client o‘zgartira
                      olmaydi.
                    </p>
                    {ekeyReceiverMissing && (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        {EKEY_RECEIVER_MISSING_HINT}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                  <Label>Izoh</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ixtiyoriy"
                    disabled={!apiAvailable}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSave(false)}
                  disabled={!apiAvailable || saving}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Faqat reja saqlash
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSave(true)}
                  disabled={!apiAvailable || saving}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Qulfga o‘rnatish
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {grants.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Saqlangan kirish huquqlari yo'q"
          description="Yuqorida arendator, muddat va PIN belgilab saqlang."
        />
      ) : (
        <div className="space-y-4">
          <h3 className="font-medium">Saqlangan rejalar</h3>
          {grants.map((g) => {
            const label =
              g.effectiveLabel ||
              (g.status === "cancelled" ? "Bekor qilingan" : "Rejalashtirilgan");
            const syncing = busyId === g.id || saving;
            return (
              <Card key={g.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="font-medium">{g.tenantName || "—"}</p>
                      {g.tenantPhone?.trim() && (
                        <p className="text-sm text-muted-foreground">
                          {g.tenantPhone}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {ACCESS_PERMISSION_LABELS[g.permissionType] ??
                            g.permissionType}
                        </Badge>
                        <Badge variant={effectiveBadgeVariant(g.effectiveStatus)}>
                          {label}
                        </Badge>
                        {g.delivery?.syncStatus && (
                          <Badge variant="outline" className="font-normal">
                            {g.delivery.syncStatus}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Qulf:{" "}
                        {g.delivery?.lockName?.trim() ||
                          (hasLock && linked ? linked.name : "Qulf biriktirilmagan")}
                        {g.delivery?.lockExternalId
                          ? ` · lockId ${g.delivery.lockExternalId}`
                          : ""}
                      </p>
                      {g.delivery?.lockMissingHint && (
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {g.delivery.lockMissingHint}
                        </p>
                      )}
                      {g.delivery?.lastErrorMessage && (
                        <p className="text-sm text-destructive">
                          {g.delivery.lastErrorMessage}
                        </p>
                      )}
                      {g.accessKind === "passcode" &&
                        g.delivery?.externalAccessId && (
                          <p className="text-sm text-muted-foreground">
                            Parol: ••••••
                            {g.effectiveStatus === "API_YUBORILGAN"
                              ? " · qurilmada tasdiqlanmagan"
                              : ""}
                          </p>
                        )}
                    </div>
                    <p className="shrink-0 text-sm text-muted-foreground">
                      {g.validFrom || g.validTo
                        ? `${g.validFrom ? formatDate(g.validFrom) : "—"} — ${
                            g.validTo ? formatDate(g.validTo) : "—"
                          }`
                        : "Muddat belgilanmagan"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canRetry(g) && (
                      <Button
                        size="sm"
                        disabled={!apiAvailable || syncing}
                        onClick={() => void handleSync(g.id)}
                      >
                        {syncing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : g.delivery?.syncStatus === "FAILED" ? (
                          <RefreshCw className="size-4" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        {g.delivery?.syncStatus === "FAILED"
                          ? "Qayta urinish"
                          : "TTLock’ga yuborish"}
                      </Button>
                    )}
                    {g.status !== "cancelled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!apiAvailable || syncing}
                        onClick={() => void handleCancel(g.id)}
                      >
                        <ShieldOff className="size-4" /> Bekor qilish
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={oneTimePin != null}
        onOpenChange={(open) => {
          if (!open) setOneTimePin(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi parol</DialogTitle>
            <DialogDescription>
              Bu parol faqat bir marta ko‘rsatiladi. Modal yopilgach qayta
              olinmaydi.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-center font-mono text-2xl tracking-widest">
            {oneTimePin}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!oneTimePin) return;
                try {
                  await navigator.clipboard.writeText(oneTimePin);
                  toast.success("Nusxa olindi");
                } catch {
                  toast.info("Nusxalab bo‘lmadi");
                }
              }}
            >
              Nusxalash
            </Button>
            <Button type="button" onClick={() => setOneTimePin(null)}>
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
