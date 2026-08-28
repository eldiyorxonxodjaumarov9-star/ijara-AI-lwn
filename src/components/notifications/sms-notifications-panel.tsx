"use client";

import { useMemo, useState } from "react";
import {
  MessageSquarePlus,
  MoreVertical,
  PlugZap,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PaymentDueCell } from "@/components/notifications/payment-due-cell";
import { SmsAssignTenantsDialog } from "@/components/notifications/sms-assign-tenants-dialog";
import { SmsComposeDialog } from "@/components/notifications/sms-compose-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  enabledSmsKindLabels,
  formatPhoneDisplay,
  SMS_KIND_LABELS,
} from "@/lib/sms-notifications";
import { useTenantPaymentDueMap } from "@/hooks/use-tenant-payment-due-lines";
import type { SmsLinkedTenant, SmsNotificationSettings } from "@/types/sms-notifications";

export function SmsNotificationsPanel() {
  const [linked, setLinked] = useState<SmsLinkedTenant[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const paymentDueByTenant = useTenantPaymentDueMap();

  const linkedIds = useMemo(
    () => new Set(linked.map((t) => t.tenantId)),
    [linked]
  );

  const handleAssign = (tenants: SmsLinkedTenant[]) => {
    setLinked((prev) => {
      const ids = new Set(prev.map((t) => t.tenantId));
      const merged = [...prev];
      for (const t of tenants) {
        if (!ids.has(t.tenantId)) merged.push(t);
      }
      return merged;
    });
  };

  const updateTenant = (
    tenantId: string,
    patch: Partial<SmsLinkedTenant> | ((t: SmsLinkedTenant) => SmsLinkedTenant)
  ) => {
    setLinked((prev) =>
      prev.map((t) => {
        if (t.tenantId !== tenantId) return t;
        return typeof patch === "function" ? patch(t) : { ...t, ...patch };
      })
    );
  };

  const toggleSetting = (
    tenantId: string,
    key: keyof SmsNotificationSettings,
    checked: boolean
  ) => {
    updateTenant(tenantId, (t) => ({
      ...t,
      settings: { ...t.settings, [key]: checked },
    }));
  };

  const unlink = (tenantId: string) => {
    setLinked((prev) => prev.filter((t) => t.tenantId !== tenantId));
    toast.success("Arendator biriktirishdan chiqarildi (vaqtinchalik)");
  };

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
      >
        Interfeysni tayyorlash bosqichi: tanlovlar vaqtinchalik, sahifa
        yangilanganda saqlanmaydi.
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <PlugZap className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Play Mobile holati</p>
              <p className="text-sm text-muted-foreground">
                Provayder: <span className="text-foreground">Play Mobile</span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="warning">API ulanmagan</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Hozir SMS yuborilmaydi. Play Mobile integratsiyasi keyingi
                bosqichda ulanadi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAssignOpen(true)}>
          <UserPlus className="size-4" /> Arendator biriktirish
        </Button>
        <Button
          variant="outline"
          onClick={() => setComposeOpen(true)}
          disabled={linked.length === 0}
        >
          <MessageSquarePlus className="size-4" /> Xabar tayyorlash
        </Button>
      </div>

      {linked.length === 0 ? (
        <EmptyState
          icon={Users}
          title="SMS xabarnomalari uchun arendatorlar tanlanmagan"
          description="Arendatorlarni biriktiring va kelajakda avtomatik SMS turlarini sozlang."
          action={
            <Button onClick={() => setAssignOpen(true)}>
              <UserPlus className="size-4" /> Arendator biriktirish
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arendator</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Mulk / xona
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Telefon
                    </TableHead>
                    <TableHead>To&apos;lov sanasi</TableHead>
                    <TableHead>SMS</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Xabarnoma turlari
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linked.map((t) => {
                    const kinds = enabledSmsKindLabels(t.settings);
                    const dueLines = paymentDueByTenant.get(t.tenantId) ?? [];
                    return (
                      <TableRow key={t.tenantId}>
                        <TableCell className="font-medium">
                          {t.fullName}
                          <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                            {formatPhoneDisplay(t.phone)}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                            {t.propertyLabel}
                          </span>
                          {kinds.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 lg:hidden">
                              {kinds.map((k) => (
                                <Badge
                                  key={k}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {k}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {t.propertyLabel}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell whitespace-nowrap text-sm">
                          {formatPhoneDisplay(t.phone)}
                        </TableCell>
                        <TableCell className="min-w-[7rem]">
                          <PaymentDueCell lines={dueLines} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`sms-enabled-${t.tenantId}`}
                              checked={t.smsEnabled}
                              onCheckedChange={(v) =>
                                updateTenant(t.tenantId, { smsEnabled: v })
                              }
                              aria-label={`${t.fullName} uchun SMS`}
                            />
                            <Label
                              htmlFor={`sms-enabled-${t.tenantId}`}
                              className="sr-only"
                            >
                              SMS yoqilgan
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {t.smsEnabled ? "Yoqilgan" : "O'chirilgan"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {kinds.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Tanlanmagan
                              </span>
                            ) : (
                              kinds.map((k) => (
                                <Badge key={k} variant="secondary">
                                  {k}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownMenuLabel className="flex items-center gap-1.5">
                                <Settings2 className="size-4" /> Xabarnoma turlari
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {(
                                Object.keys(
                                  SMS_KIND_LABELS
                                ) as (keyof SmsNotificationSettings)[]
                              ).map((key) => (
                                <DropdownMenuCheckboxItem
                                  key={key}
                                  checked={t.settings[key]}
                                  onCheckedChange={(checked) =>
                                    toggleSetting(t.tenantId, key, checked)
                                  }
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  {SMS_KIND_LABELS[key]}
                                </DropdownMenuCheckboxItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => unlink(t.tenantId)}
                              >
                                Biriktirishdan chiqarish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <SmsAssignTenantsDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        linkedIds={linkedIds}
        onAssign={handleAssign}
      />
      <SmsComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        linkedTenants={linked}
      />
    </div>
  );
}
