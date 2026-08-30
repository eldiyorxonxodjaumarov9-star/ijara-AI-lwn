"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  MessageSquarePlus,
  MoreVertical,
  PlugZap,
  RefreshCw,
  Search,
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useTenantPaymentDueMap } from "@/hooks/use-tenant-payment-due-lines";
import { ApiError, isApiConfigured } from "@/lib/api/client";
import { smsCandidateKey } from "@/lib/sms-link-candidates";
import {
  deleteSmsLink,
  fetchSmsLinks,
  updateSmsLink,
} from "@/lib/sms-links-client";
import {
  enabledSmsKindLabels,
  formatPhoneDisplay,
  SMS_KIND_LABELS,
} from "@/lib/sms-notifications";
import type { TenantPaymentDueLine } from "@/lib/tenant-payment-due-display";
import type {
  SmsLinkedTenant,
  SmsNotificationSettings,
} from "@/types/sms-notifications";

function dueLinesForLink(
  link: SmsLinkedTenant,
  paymentDueByTenant: Map<string, TenantPaymentDueLine[]>
): TenantPaymentDueLine[] {
  const all = paymentDueByTenant.get(link.tenantId) ?? [];
  if (!link.contractId && link.propertyLabel === "—") {
    return all.length > 0 ? all : [];
  }
  const matched = all.filter(
    (line) =>
      line.propertyLabel === link.propertyLabel ||
      (link.propertyLabel !== "—" &&
        line.propertyLabel.includes(link.propertyLabel))
  );
  if (matched.length > 0) return matched;
  if (all.length === 1) return all;
  return [];
}

export function SmsNotificationsPanel() {
  const [linked, setLinked] = useState<SmsLinkedTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const paymentDueByTenant = useTenantPaymentDueMap();

  const loadLinks = useCallback(async () => {
    if (!isApiConfigured) {
      setError(
        "API sozlanmagan. NEXT_PUBLIC_API_URL=/api ni o'rnating va qayta ishga tushiring."
      );
      setLinked([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSmsLinks();
      setLinked(rows);
    } catch (err) {
      setLinked([]);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Biriktirilganlar yuklanmadi"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Serverdan biriktirilganlar — asosiy manba
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await loadLinks();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLinks]);

  const linkedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const t of linked) {
      set.add(smsCandidateKey(t.tenantId, t.scopeKey || "none"));
    }
    return set;
  }, [linked]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return linked;
    const digits = q.replace(/\D/g, "");
    return linked.filter((t) => {
      if (t.fullName.toLowerCase().includes(q)) return true;
      if (t.propertyLabel.toLowerCase().includes(q)) return true;
      if (t.phone.toLowerCase().includes(q)) return true;
      if (digits && t.phone.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
  }, [linked, search]);

  const patchLink = async (
    id: string,
    patch: {
      smsEnabled?: boolean;
      settings?: Partial<SmsNotificationSettings>;
    }
  ) => {
    setBusyId(id);
    try {
      const updated = await updateSmsLink(id, patch);
      setLinked((prev) => prev.map((row) => (row.id === id ? updated : row)));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Yangilashda xatolik"
      );
      await loadLinks();
    } finally {
      setBusyId(null);
    }
  };

  const toggleSetting = async (
    link: SmsLinkedTenant,
    key: keyof SmsNotificationSettings,
    checked: boolean
  ) => {
    await patchLink(link.id, {
      settings: { ...link.settings, [key]: checked },
    });
  };

  const unlink = async (id: string) => {
    setBusyId(id);
    try {
      const next = await deleteSmsLink(id);
      setLinked(next);
      toast.success("Biriktirish bekor qilindi");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "O'chirishda xatolik"
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAssignOpen(true)} disabled={!!error && !isApiConfigured}>
          <UserPlus className="size-4" /> Arendator biriktirish
        </Button>
        <Button
          variant="outline"
          onClick={() => setComposeOpen(true)}
          disabled={linked.length === 0}
        >
          <MessageSquarePlus className="size-4" /> Xabar tayyorlash
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void loadLinks()}
          disabled={loading}
          aria-label="Yangilash"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          Jami biriktirilgan:{" "}
          <span className="font-medium text-foreground">{linked.length} ta</span>
          {search.trim() && filtered.length !== linked.length && (
            <span className="ml-2">· Topildi: {filtered.length}</span>
          )}
        </p>
      </div>

      {linked.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ism, xona yoki telefon bo'yicha qidirish..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <AlertCircle className="size-10 text-destructive" />
          <div>
            <p className="font-medium">Ma&apos;lumotlarni yuklab bo&apos;lmadi</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {error}
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadLinks()}>
            <RefreshCw className="size-4" /> Qayta urinish
          </Button>
        </div>
      ) : linked.length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Qidiruv bo'yicha topilmadi"
          description="Barcha biriktirilgan yozuvlar ichidan mos keladigan topilmadi."
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
                  {filtered.map((t) => {
                    const kinds = enabledSmsKindLabels(t.settings);
                    const dueLines = dueLinesForLink(t, paymentDueByTenant);
                    const phoneLabel = t.phone.trim()
                      ? formatPhoneDisplay(t.phone)
                      : "—";
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.fullName}
                          <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                            {phoneLabel}
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
                          {t.propertyLabel || "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell whitespace-nowrap text-sm">
                          {phoneLabel}
                        </TableCell>
                        <TableCell className="min-w-[7rem]">
                          {dueLines.length === 0 ? (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <PaymentDueCell lines={dueLines} />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`sms-enabled-${t.id}`}
                              checked={t.smsEnabled}
                              disabled={busyId === t.id}
                              onCheckedChange={(v) =>
                                void patchLink(t.id, { smsEnabled: v })
                              }
                              aria-label={`${t.fullName} uchun SMS`}
                            />
                            <Label
                              htmlFor={`sms-enabled-${t.id}`}
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
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={busyId === t.id}
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownMenuLabel className="flex items-center gap-1.5">
                                <Settings2 className="size-4" /> Xabarnoma
                                turlari
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
                                    void toggleSetting(t, key, checked)
                                  }
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  {SMS_KIND_LABELS[key]}
                                </DropdownMenuCheckboxItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void unlink(t.id)}
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
        linkedKeys={linkedKeys}
        onAssigned={(rows) => {
          setLinked(rows);
          setError(null);
        }}
      />
      <SmsComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        linkedTenants={linked}
      />
    </div>
  );
}
