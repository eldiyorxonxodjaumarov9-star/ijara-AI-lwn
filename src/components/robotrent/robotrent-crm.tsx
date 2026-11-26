"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, RefreshCw, Save, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api/client";
import {
  ROBOTRENT_STATUS_LABELS,
  ROBOTRENT_TYPE_LABELS,
} from "@/lib/robotrent/constants";
import { displayDate, displayNumber, displayValue } from "@/lib/robotrent/format";
import { cn } from "@/lib/utils";

type Status = keyof typeof ROBOTRENT_STATUS_LABELS;
type AppType = keyof typeof ROBOTRENT_TYPE_LABELS;
type TabKey = "applications" | "partners" | "trials" | "rentals";
type PartnerFilter = "ALL" | "DISTRIBUTOR" | "MANUFACTURER";

interface AdminApplication {
  id: string;
  trackingCode: string;
  type: AppType;
  typeLabel: string;
  status: Status;
  statusLabel: string;
  companyName: string;
  createdAt: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  objectType: string | null;
  areaSqm: string | null;
  serviceCity: string | null;
  robotModel: string | null;
  hasDemoRobot: boolean | null;
  serviceCapability: string | null;
  country: string | null;
  techDocumentNote: string | null;
  monthlyRentalTerms: string | null;
  startDate: string | null;
  timeline: { status: Status; label: string; at: string; note: string | null }[];
  trial: {
    robotName: string | null;
    trialZone: string | null;
    startDate: string | null;
    trialDays: number | null;
    dailyRate: string | null;
    dailyCleanedAreaSqm: string | null;
    costNotes: string | null;
    reportSummary: string | null;
  } | null;
  rentalOffer: {
    monthlyAmount: string | null;
    currency: string | null;
    terms: string | null;
    validUntil: string | null;
  } | null;
}

interface RobotModelOption {
  id: string;
  name: string;
}

const STATUSES = Object.keys(ROBOTRENT_STATUS_LABELS) as Status[];

const STATUS_TONE: Record<Status, string> = {
  RECEIVED: "bg-slate-100 text-slate-700",
  SITE_INSPECTION: "bg-amber-100 text-amber-800",
  TRIAL_OFFER: "bg-sky-100 text-sky-800",
  MONTHLY_RENTAL: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
};

const selectCls =
  "flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const textareaCls =
  "flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function errMessage(err: unknown) {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : "Xatolik yuz berdi";
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function fetchApplications(params: {
  q?: string;
  type?: string;
  status?: string;
}): Promise<AdminApplication[]> {
  const rows = await apiFetch<AdminApplication[]>(
    `/robotrent/applications${buildQuery(params)}`
  );
  return Array.isArray(rows) ? rows : [];
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function RobotRentCrm() {
  const [tab, setTab] = useState<TabKey>("applications");
  const [partnerFilter, setPartnerFilter] = useState<PartnerFilter>("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rows, setRows] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = debouncedSearch || undefined;
      let result: AdminApplication[];
      if (tab === "partners") {
        if (partnerFilter === "ALL") {
          const [d, m] = await Promise.all([
            fetchApplications({ q, type: "DISTRIBUTOR" }),
            fetchApplications({ q, type: "MANUFACTURER" }),
          ]);
          result = [...d, ...m].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
          );
        } else {
          result = await fetchApplications({ q, type: partnerFilter });
        }
      } else if (tab === "trials") {
        result = await fetchApplications({ q, status: "TRIAL_OFFER" });
      } else if (tab === "rentals") {
        result = await fetchApplications({ q, status: "MONTHLY_RENTAL" });
      } else {
        result = await fetchApplications({ q });
      }
      setRows(result);
    } catch (err) {
      setError(errMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, partnerFilter, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  function onUpdated(updated: AdminApplication) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedId(updated.id);
    // Status o‘zgargach joriy tab filtri o‘zgarishi mumkin — qayta yuklaymiz
    void load();
  }

  return (
    <div>
      <PageHeader
        title="RobotRent CRM"
        description="Mijoz, hamkor, sinov va ijara arizalarini boshqarish"
        action={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Yangilash
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as TabKey);
            setSelectedId(null);
          }}
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="applications">Arizalar</TabsTrigger>
            <TabsTrigger value="partners">Hamkorlar</TabsTrigger>
            <TabsTrigger value="trials">Sinovlar</TabsTrigger>
            <TabsTrigger value="rentals">Ijaralar</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row">
          {tab === "partners" ? (
            <select
              aria-label="Hamkor turi"
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value as PartnerFilter)}
              className={cn(selectCls, "sm:w-52")}
            >
              <option value="ALL">Barcha hamkorlar</option>
              <option value="DISTRIBUTOR">{ROBOTRENT_TYPE_LABELS.DISTRIBUTOR}</option>
              <option value="MANUFACTURER">{ROBOTRENT_TYPE_LABELS.MANUFACTURER}</option>
            </select>
          ) : null}
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kod, kompaniya, telefon, email…"
              className="pl-9"
              aria-label="Qidirish"
            />
          </div>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Kod</th>
                    <th className="px-4 py-3">Kompaniya</th>
                    <th className="px-4 py-3">Tur</th>
                    <th className="px-4 py-3">Holat</th>
                    <th className="px-4 py-3">Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        Arizalar topilmadi
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={cn(
                          "cursor-pointer border-b last:border-0 hover:bg-muted/40",
                          selectedId === r.id && "bg-primary/5"
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{r.trackingCode}</td>
                        <td className="px-4 py-3 font-medium">{displayValue(r.companyName)}</td>
                        <td className="px-4 py-3">{ROBOTRENT_TYPE_LABELS[r.type]}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={STATUS_TONE[r.status]}>
                            {ROBOTRENT_STATUS_LABELS[r.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {displayDate(r.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">
              {selected ? displayValue(selected.companyName) : "Ariza tafsilotlari"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <ApplicationDetail
                key={selected.id}
                application={selected}
                onUpdated={onUpdated}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Tafsilotlarni ko‘rish uchun ro‘yxatdan arizani tanlang.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ApplicationDetail({
  application: a,
  onUpdated,
}: {
  application: AdminApplication;
  onUpdated: (updated: AdminApplication) => void;
}) {
  const [status, setStatus] = useState<Status>(a.status);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [robots, setRobots] = useState<RobotModelOption[]>([]);

  const [robotModelId, setRobotModelId] = useState("");
  const [trialZone, setTrialZone] = useState(a.trial?.trialZone ?? "");
  const [trialStart, setTrialStart] = useState(a.trial?.startDate?.slice(0, 10) ?? "");
  const [trialDays, setTrialDays] = useState(String(a.trial?.trialDays ?? 14));
  const [dailyRate, setDailyRate] = useState(a.trial?.dailyRate ?? "");
  const [cleanedArea, setCleanedArea] = useState(a.trial?.dailyCleanedAreaSqm ?? "");
  const [costNotes, setCostNotes] = useState(a.trial?.costNotes ?? "");
  const [reportSummary, setReportSummary] = useState(a.trial?.reportSummary ?? "");

  const [monthlyAmount, setMonthlyAmount] = useState(a.rentalOffer?.monthlyAmount ?? "");
  const [terms, setTerms] = useState(a.rentalOffer?.terms ?? "");
  const [validUntil, setValidUntil] = useState(a.rentalOffer?.validUntil?.slice(0, 10) ?? "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/robotrent/robots", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as {
          data?: RobotModelOption[];
        } | null;
        if (!cancelled && res.ok && Array.isArray(json?.data)) {
          setRobots(json.data.map((r) => ({ id: r.id, name: r.name })));
        }
      } catch {
        /* ixtiyoriy ro‘yxat */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showTrial = status === "TRIAL_OFFER" || status === "MONTHLY_RENTAL";
  const showRental = status === "MONTHLY_RENTAL";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        status,
        note: note.trim() || undefined,
      };
      if (showTrial) {
        body.trial = {
          robotModelId: strOrNull(robotModelId),
          trialZone: strOrNull(trialZone),
          startDate: strOrNull(trialStart),
          trialDays: numOrNull(trialDays),
          dailyRate: numOrNull(dailyRate),
          dailyCleanedAreaSqm: numOrNull(cleanedArea),
          costNotes: strOrNull(costNotes),
          reportSummary: strOrNull(reportSummary),
        };
      }
      if (showRental && (numOrNull(monthlyAmount) !== null || terms.trim() || validUntil)) {
        body.rentalOffer = {
          monthlyAmount: numOrNull(monthlyAmount),
          terms: strOrNull(terms),
          validUntil: strOrNull(validUntil),
        };
      }
      const updated = await apiFetch<AdminApplication>(
        `/robotrent/applications/${encodeURIComponent(a.id)}`,
        { method: "PATCH", body }
      );
      toast.success("Ariza yangilandi");
      setNote("");
      onUpdated(updated);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <dl className="space-y-2">
        <DetailRow label="Kod" value={a.trackingCode} />
        <DetailRow label="Tur" value={ROBOTRENT_TYPE_LABELS[a.type]} />
        <DetailRow label="Holat" value={ROBOTRENT_STATUS_LABELS[a.status]} />
        <DetailRow label="Telefon" value={displayValue(a.phone)} />
        <DetailRow label="Email" value={displayValue(a.email)} />
        {a.type === "CUSTOMER" ? (
          <>
            <DetailRow label="Shahar" value={displayValue(a.city)} />
            <DetailRow label="Obyekt turi" value={displayValue(a.objectType)} />
            <DetailRow label="Maydon" value={displayNumber(a.areaSqm, " m²")} />
            <DetailRow label="Boshlanish" value={displayDate(a.startDate)} />
          </>
        ) : null}
        {a.type === "DISTRIBUTOR" ? (
          <>
            <DetailRow label="Xizmat shahri" value={displayValue(a.serviceCity)} />
            <DetailRow label="Robot modeli" value={displayValue(a.robotModel)} />
            <DetailRow
              label="Demo robot"
              value={a.hasDemoRobot == null ? displayValue(null) : a.hasDemoRobot ? "Bor" : "Yo‘q"}
            />
            <DetailRow label="Servis" value={displayValue(a.serviceCapability)} />
          </>
        ) : null}
        {a.type === "MANUFACTURER" ? (
          <>
            <DetailRow label="Davlat" value={displayValue(a.country)} />
            <DetailRow label="Robot modeli" value={displayValue(a.robotModel)} />
            <DetailRow label="Texnik hujjat" value={displayValue(a.techDocumentNote)} />
            <DetailRow label="Ijara shartlari" value={displayValue(a.monthlyRentalTerms)} />
          </>
        ) : null}
      </dl>

      {a.timeline.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Holat tarixi</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {a.timeline.map((t, i) => (
              <li key={`${t.status}-${t.at}-${i}`}>
                {displayDate(t.at)} — {ROBOTRENT_STATUS_LABELS[t.status]}
                {t.note ? ` (${t.note})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
        <h4 className="text-sm font-semibold">Holatni yangilash</h4>

        <div className="space-y-2">
          <Label htmlFor="rrc-status">Yangi holat</Label>
          <select
            id="rrc-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className={selectCls}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ROBOTRENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rrc-note">Izoh</Label>
          <textarea
            id="rrc-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={textareaCls}
          />
        </div>

        {showTrial ? (
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">
              Sinov (ixtiyoriy)
            </legend>
            <div className="space-y-2">
              <Label htmlFor="rrc-robot">Robot modeli</Label>
              <select
                id="rrc-robot"
                value={robotModelId}
                onChange={(e) => setRobotModelId(e.target.value)}
                className={selectCls}
              >
                <option value="">
                  {a.trial?.robotName ? `Joriy: ${a.trial.robotName}` : "Tanlanmagan"}
                </option>
                {robots.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rrc-zone">Sinov zonasi</Label>
                <Input id="rrc-zone" value={trialZone} onChange={(e) => setTrialZone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rrc-tstart">Boshlanish</Label>
                <Input id="rrc-tstart" type="date" value={trialStart} onChange={(e) => setTrialStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rrc-days">Muddat (kun)</Label>
                <Input id="rrc-days" type="number" min={1} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rrc-rate">Kunlik narx</Label>
                <Input id="rrc-rate" type="number" min={0} value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="rrc-area">Kunlik tozalangan maydon (m²)</Label>
                <Input id="rrc-area" type="number" min={0} value={cleanedArea} onChange={(e) => setCleanedArea(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rrc-cost">Xarajat izohi</Label>
              <textarea id="rrc-cost" rows={2} value={costNotes} onChange={(e) => setCostNotes(e.target.value)} className={textareaCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rrc-report">Hisobot xulosasi</Label>
              <textarea id="rrc-report" rows={2} value={reportSummary} onChange={(e) => setReportSummary(e.target.value)} className={textareaCls} />
            </div>
          </fieldset>
        ) : null}

        {showRental ? (
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">
              Oylik ijara taklifi (ixtiyoriy)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rrc-monthly">Oylik summa</Label>
                <Input id="rrc-monthly" type="number" min={0} value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rrc-valid">Amal qilish muddati</Label>
                <Input id="rrc-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rrc-terms">Shartlar</Label>
              <textarea id="rrc-terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} className={textareaCls} />
            </div>
          </fieldset>
        ) : null}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Saqlash
        </Button>
      </form>
    </div>
  );
}
