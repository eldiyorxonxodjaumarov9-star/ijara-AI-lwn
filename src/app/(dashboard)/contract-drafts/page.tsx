"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Eye,
  FilePlus2,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { ApiError, apiFetch, isApiConfigured } from "@/lib/api/client";
import { computeMonthlyAmount, computeTotalAmount } from "@/lib/contract-money";

type EligibleTenant = {
  id: string;
  fullName: string;
  phone: string;
  clientNumber: string | null;
  telegramChatId: string | null;
};

type DraftRequest = {
  id: string;
  status: string;
  partyCategory: string;
  serviceName: string;
  monthlyAmount: number;
  totalAmount: number;
  failReasonSafe: string | null;
  contractNumber: string | null;
  hasDocument: boolean;
  tenant: { id: string; fullName: string; phone: string };
  property: { id: string; title: string; address: string };
  createdAt: string;
};

type PropertyOpt = { id: string; title: string; address: string; area?: number };

const STATUS_LABEL: Record<string, string> = {
  AWAITING_CLIENT: "Mijoz ma’lumotlari kutilmoqda",
  CLIENT_FORM_OPENED: "Forma ochilgan",
  GENERATING: "Yaratilmoqda",
  CREATED: "Shartnoma tuzildi",
  FAILED: "Xatolik",
  CANCELLED: "Bekor qilingan",
  EXPIRED: "Muddati tugagan",
  DRAFT: "Qoralama",
};

export default function ContractDraftsPage() {
  const [eligible, setEligible] = useState<EligibleTenant[]>([]);
  const [requests, setRequests] = useState<DraftRequest[]>([]);
  const [properties, setProperties] = useState<PropertyOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [partyUiType, setPartyUiType] = useState("individual");
  const [contractDate, setContractDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [serviceName, setServiceName] = useState("Ofis ijarasi");
  const [areaSqm, setAreaSqm] = useState(20);
  const [ratePerSqm, setRatePerSqm] = useState(91200);
  const [monthCount, setMonthCount] = useState(4);
  const [paymentDueDay, setPaymentDueDay] = useState(5);
  const [depositAmount, setDepositAmount] = useState(1_000_000);
  const [phone, setPhone] = useState("");
  const [lessorMissing, setLessorMissing] = useState<string[]>([]);

  const monthly = useMemo(
    () => computeMonthlyAmount(areaSqm, ratePerSqm),
    [areaSqm, ratePerSqm]
  );
  const total = useMemo(
    () => computeTotalAmount(monthly, monthCount),
    [monthly, monthCount]
  );

  const reload = useCallback(async () => {
    if (!isApiConfigured) return;
    setLoading(true);
    try {
      const [el, req, props] = await Promise.all([
        apiFetch<EligibleTenant[]>("/contract-drafts?eligible=1"),
        apiFetch<DraftRequest[]>("/contract-drafts"),
        apiFetch<{ data?: PropertyOpt[] } | PropertyOpt[]>("/properties?limit=200"),
      ]);
      setEligible(el);
      setRequests(req);
      const list = Array.isArray(props)
        ? props
        : Array.isArray(props?.data)
          ? props.data
          : [];
      setProperties(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklab bo‘lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = (t: EligibleTenant) => {
    setTenantId(t.id);
    setPhone(t.phone);
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<{ userMessage: string }>("/contract-drafts", {
        method: "POST",
        body: {
          tenantId,
          propertyId,
          partyUiType,
          contractDate,
          startDate,
          endDate,
          serviceName,
          areaSqm,
          ratePerSqm,
          monthCount,
          paymentDueDay,
          depositAmount,
          phone,
          monthlyAmountClient: monthly,
          totalAmountClient: total,
        },
      });
      toast.success(res.userMessage);
      setOpen(false);
      setLessorMissing([]);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === "LESSOR_INCOMPLETE") {
        const msg = err.message;
        const parts = msg.includes(":")
          ? msg.split(":").slice(1).join(":").split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        setLessorMissing(parts);
        toast.error(msg);
      } else {
        toast.error(err instanceof Error ? err.message : "Yuborib bo‘lmadi");
      }
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    id: string,
    action: string,
    extra?: { force?: boolean }
  ) => {
    try {
      const res = await apiFetch<{
        userMessage?: string;
        formPath?: string;
        queued?: boolean;
      }>(`/contract-drafts/${id}`, {
        method: "POST",
        body: { action, ...extra },
      });
      if (res.formPath) {
        toast.message(`Havola: ${res.formPath}`);
      } else {
        toast.success(res.userMessage ?? "Bajarildi");
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  };

  const download = async (id: string) => {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("arenda_access_token") ||
            localStorage.getItem("accessToken")
          : null;
      const res = await fetch(`/api/contract-drafts/${id}?download=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Yuklab bo‘lmadi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shartnoma-${id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklab bo‘lmadi");
    }
  };

  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="Shartnoma tuzish"
        description="Shartnomasi yo‘q mijozlarga so‘rov yuboring. Mijoz bot orqali formani to‘ldiradi."
      />

      <Card
        className={
          lessorMissing.length > 0
            ? "border-amber-500/40 bg-amber-500/5"
            : undefined
        }
      >
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {lessorMissing.length > 0
                ? "Shartnoma rekvizitlari to‘liq emas"
                : "Shartnomada ijaraga beruvchi rekvizitlari"}
            </p>
            <p className="text-muted-foreground">
              {lessorMissing.length > 0
                ? `Yetishmayotgan: ${lessorMissing.join(", ")}`
                : "Sozlamalar → Kompaniya → Shartnoma rekvizitlarida qo‘lda saqlangan ma’lumotlar yangi shartnomalarga avtomatik olinadi."}
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href="/settings?tab=company&section=lessor">
              Shartnoma rekvizitlarini to‘ldirish
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Shartnomasi yo‘q mijozlar</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" /> Yangilash
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          ) : eligible.length === 0 ? (
            <EmptyState
              icon={FilePlus2}
              title="Ro‘yxat bo‘sh"
              description="Barcha mijozlarda shartnoma yoki faol so‘rov bor."
            />
          ) : (
            eligible.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{t.fullName}</p>
                  <p className="text-sm text-muted-foreground">{t.phone}</p>
                </div>
                <Button onClick={() => openCreate(t)}>
                  <Send className="size-4" /> Shartnoma tuzish
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shartnoma so‘rovlari</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hali so‘rov yo‘q.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.tenant.fullName}</p>
                  <Badge>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  {r.contractNumber && (
                    <Badge variant="outline">№ {r.contractNumber}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.property.title} · {r.serviceName} ·{" "}
                  {r.monthlyAmount.toLocaleString("uz-UZ")} / oy
                </p>
                {r.failReasonSafe && (
                  <p className="text-sm text-destructive">{r.failReasonSafe}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {r.hasDocument && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void download(r.id)}
                      >
                        <Download className="size-4" /> Yuklab olish
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void download(r.id)}
                        aria-label="Hujjatni yuklab ko‘rish"
                      >
                        <Eye className="size-4" /> Ko‘rish
                      </Button>
                      {r.status === "CREATED" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void runAction(r.id, "retry-delivery", {
                              force: true,
                            })
                          }
                        >
                          <Send className="size-4" /> Botga qayta yuborish
                        </Button>
                      )}
                    </>
                  )}
                  {r.status === "FAILED" && (
                    <Button
                      size="sm"
                      onClick={() => void runAction(r.id, "retry")}
                    >
                      Qayta urinish
                    </Button>
                  )}
                  {(r.status === "AWAITING_CLIENT" ||
                    r.status === "CLIENT_FORM_OPENED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runAction(r.id, "regenerate-link")}
                    >
                      Havolani yangilash
                    </Button>
                  )}
                  {r.status !== "CREATED" && r.status !== "CANCELLED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void runAction(r.id, "cancel")}
                    >
                      Bekor qilish
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yangi shartnoma so‘rovi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Mijoz turi</Label>
              <Select value={partyUiType} onValueChange={setPartyUiType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Jismoniy shaxs</SelectItem>
                  <SelectItem value="self_employed">
                    O‘zini o‘zi band qilgan
                  </SelectItem>
                  <SelectItem value="ytt">YTT</SelectItem>
                  <SelectItem value="legal">Yuridik shaxs</SelectItem>
                  <SelectItem value="mchj">MChJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Xona / obyekt</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Shartnoma sanasi</Label>
                <Input
                  type="date"
                  value={contractDate}
                  onChange={(e) => setContractDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Boshlanish</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tugash</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Xizmat nomi</Label>
              <Input
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Maydon (m²)</Label>
                <Input
                  type="number"
                  value={areaSqm}
                  onChange={(e) => setAreaSqm(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>1 m² tarifi</Label>
                <Input
                  type="number"
                  value={ratePerSqm}
                  onChange={(e) => setRatePerSqm(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Oylar</Label>
                <Input
                  type="number"
                  value={monthCount}
                  onChange={(e) => setMonthCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To‘lov kuni</Label>
                <Input
                  type="number"
                  value={paymentDueDay}
                  onChange={(e) => setPaymentDueDay(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Depozit</Label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon (faqat shu so‘rov)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>Oylik: {monthly.toLocaleString("uz-UZ")} so‘m</p>
              <p>Jami: {total.toLocaleString("uz-UZ")} so‘m</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Bekor
            </Button>
            <Button onClick={() => void submit()} disabled={saving || !propertyId}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Mijozga yuborish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
