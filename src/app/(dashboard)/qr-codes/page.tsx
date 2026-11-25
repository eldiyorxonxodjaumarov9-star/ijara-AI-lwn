"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Loader2,
  Pencil,
  Power,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, apiFetchBlob, isApiConfigured } from "@/lib/api/client";
import { FEEDBACK_STATUS_LABELS } from "@/lib/api-server/qr-feedback/constants";

type QrItem = {
  id: string;
  codeIndex: number;
  name: string;
  locationLabel: string | null;
  publicToken: string;
  publicUrl: string | null;
  publicPath: string;
  active: boolean;
  feedbackCount: number;
};

type Stats = {
  totalQr: number;
  activeQr: number;
  feedbackCount: number;
  averageRating: number;
  negativeCount: number;
};

type FeedbackItem = {
  id: string;
  ratingValue: number;
  emoji: string;
  label: string;
  comment: string | null;
  status: keyof typeof FEEDBACK_STATUS_LABELS;
  telegramDelivery?: "PENDING" | "SENT" | "FAILED";
  telegramLastError?: string | null;
  qrCodeId: string;
  qrName: string;
  locationLabel: string | null;
  photoIds: string[];
  dateDisplay: string;
  timeDisplay: string;
};

function QrThumb({ id, name }: { id: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await apiFetchBlob(`/qr-codes/${id}?format=png`);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!src) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-lg border bg-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="h-28 w-28 rounded-lg border bg-white object-contain p-1" />
  );
}

export default function QrCodesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [codes, setCodes] = useState<QrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<QrItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [publicOrigin, setPublicOrigin] = useState<{
    ok: boolean;
    origin?: string;
    source?: string;
    error?: string;
    raw?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured) return;
    setLoading(true);
    try {
      const res = await apiFetch<{
        stats: Stats;
        codes: QrItem[];
        publicOrigin?: {
          ok: boolean;
          origin?: string;
          source?: string;
          error?: string;
          raw?: string | null;
        };
      }>("/qr-codes");
      setStats(res.stats);
      setCodes(res.codes);
      setPublicOrigin(res.publicOrigin ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function ensureCodes() {
    setEnsuring(true);
    try {
      const res = await apiFetch<{
        stats: Stats;
        codes: QrItem[];
        publicOrigin?: {
          ok: boolean;
          origin?: string;
          source?: string;
          error?: string;
          raw?: string | null;
        };
      }>("/qr-codes", {
        method: "POST",
        body: JSON.stringify({ action: "ensure" }),
      });
      setStats(res.stats);
      setCodes(res.codes);
      setPublicOrigin(res.publicOrigin ?? null);
      toast.success("32 ta QR slot tayyor (mavjud tokenlar saqlangan)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setEnsuring(false);
    }
  }

  async function saveQr() {
    if (!selected) return;
    try {
      await apiFetch(`/qr-codes/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          locationLabel: editLocation || null,
        }),
      });
      toast.success("Saqlandi");
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  async function toggleActive(qr: QrItem) {
    try {
      await apiFetch(`/qr-codes/${qr.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !qr.active }),
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  async function downloadOne(qr: QrItem, format: "png" | "svg") {
    if (publicOrigin && !publicOrigin.ok) {
      toast.error(publicOrigin.error || "QR public URL sozlanmagan");
      return;
    }
    try {
      const blob = await apiFetchBlob(`/qr-codes/${qr.id}?format=${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${qr.name.replace(/\s+/g, "_")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklab bo‘lmadi");
    }
  }

  async function exportAll() {
    if (publicOrigin && !publicOrigin.ok) {
      toast.error(publicOrigin.error || "QR public URL sozlanmagan");
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      for (const qr of codes) {
        const blob = await apiFetchBlob(`/qr-codes/${qr.id}?format=png`);
        zip.file(`${String(qr.codeIndex).padStart(2, "0")}_${qr.name.replace(/\s+/g, "_")}.png`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ijara-qr-codes.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP yuklandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eksport xatosi");
    } finally {
      setExporting(false);
    }
  }

  const selectedId = selected?.id ?? "";

  const loadFeedbacks = useCallback(async () => {
    if (!isApiConfigured || !selectedId) return;
    const params = new URLSearchParams();
    params.set("qrCodeId", selectedId);
    if (statusFilter) params.set("status", statusFilter);
    if (ratingFilter) params.set("rating", ratingFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("limit", "50");
    try {
      const res = await apiFetch<{ items: FeedbackItem[] }>(
        `/qr-codes/feedbacks?${params.toString()}`
      );
      setFeedbacks(res.items);
    } catch {
      setFeedbacks([]);
    }
  }, [selectedId, statusFilter, ratingFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!selected) return;
    const name = selected.name;
    const loc = selected.locationLabel || "";
    const t = setTimeout(() => {
      setEditName(name);
      setEditLocation(loc);
      void loadFeedbacks();
    }, 0);
    return () => clearTimeout(t);
  }, [selected, loadFeedbacks]);

  async function setFeedbackStatus(id: string, status: string) {
    try {
      await apiFetch(`/qr-codes/feedbacks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadFeedbacks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  async function retryTelegram(id: string) {
    try {
      await apiFetch(`/qr-codes/feedbacks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ retryTelegram: true }),
      });
      toast.success("Telegram qayta yuborish urinildi");
      await loadFeedbacks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  }

  const statCards = useMemo(
    () => [
      { label: "Jami QR", value: stats?.totalQr ?? 0 },
      { label: "Faol", value: stats?.activeQr ?? 0 },
      { label: "Fikrlar", value: stats?.feedbackCount ?? 0 },
      { label: "O‘rtacha baho", value: stats?.averageRating ?? 0 },
      { label: "Salbiy", value: stats?.negativeCount ?? 0 },
    ],
    [stats]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR kodlar"
        description="32 ta tozalik feedback QR — chop etilgan tokenlar hech qachon aylanmaydi"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Yangilash
            </Button>
            <Button variant="outline" disabled={exporting || codes.length === 0} onClick={() => void exportAll()}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "ZIP…" : "32 tasini eksport"}
            </Button>
            <Button disabled={ensuring} onClick={() => void ensureCodes()}>
              {ensuring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              32 QR tayyorlash
            </Button>
          </div>
        }
      />

      {publicOrigin ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            publicOrigin.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
        >
          {publicOrigin.ok ? (
            <p>
              Telefon QR manzili:{" "}
              <span className="font-semibold break-all">{publicOrigin.origin}</span>
              <span className="text-muted-foreground"> ({publicOrigin.source})</span>
              . Chop etishdan oldin telefon bilan skanerlab tekshiring.
            </p>
          ) : (
            <p>
              <span className="font-semibold">QR yaratish bloklangan:</span>{" "}
              {publicOrigin.error}
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              {loading && !stats ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="text-2xl font-semibold">{c.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {codes.length === 0 && !loading ? (
        <EmptyState
          icon={QrCode}
          title="QR kodlar yo‘q"
          description="«32 QR tayyorlash» tugmasini bosing. Keyingi bosishda tokenlar o‘zgarmaydi."
          action={
            <Button onClick={() => void ensureCodes()}>32 QR yaratish</Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {codes.map((qr) => (
            <Card key={qr.id} className={!qr.active ? "opacity-70" : undefined}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{qr.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {qr.locationLabel || "Hudud belgilanmagan"}
                    </p>
                  </div>
                  <Badge variant={qr.active ? "default" : "outline"}>
                    {qr.active ? "Aktiv" : "Noaktiv"}
                  </Badge>
                </div>
                <QrThumb id={qr.id} name={qr.name} />
                <p className="truncate text-xs text-muted-foreground">{qr.publicPath}</p>
                <p className="text-xs">Fikrlar: {qr.feedbackCount}</p>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setSelected(qr)}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Ochish
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void downloadOne(qr, "png")}>
                    PNG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void downloadOne(qr, "svg")}>
                    SVG
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggleActive(qr)}>
                    <Power className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Nomi</p>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Xona / hudud</p>
                  <Input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Masalan: 3-qavat, 12-xona"
                  />
                </div>
              </div>
              <p className="break-all text-xs text-muted-foreground">
                {selected.publicUrl ||
                  "Public URL yo‘q — IJARA_QR_PUBLIC_ORIGIN ni sozlang"}
              </p>
              <Button onClick={() => void saveQr()}>Saqlash</Button>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Input type="date" className="w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input type="date" className="w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                <select
                  className="h-10 rounded-md border px-2 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Barcha holat</option>
                  <option value="NEW">Yangi</option>
                  <option value="IN_REVIEW">Ko‘rib chiqilmoqda</option>
                  <option value="RESOLVED">Hal qilindi</option>
                </select>
                <select
                  className="h-10 rounded-md border px-2 text-sm"
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                >
                  <option value="">Barcha baho</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => void loadFeedbacks()}>
                  Filtrlash
                </Button>
              </div>

              <div className="space-y-3">
                {feedbacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Hali fikr yo‘q</p>
                ) : (
                  feedbacks.map((f) => (
                    <div key={f.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl">{f.emoji}</span>
                        <span className="font-medium">
                          {f.ratingValue} · {f.label}
                        </span>
                        <Badge variant="outline">
                          {FEEDBACK_STATUS_LABELS[f.status]}
                        </Badge>
                        {f.telegramDelivery ? (
                          <Badge
                            variant={
                              f.telegramDelivery === "FAILED"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            TG: {f.telegramDelivery}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {f.dateDisplay} {f.timeDisplay}
                        </span>
                      </div>
                      {f.comment ? (
                        <p className="mt-2 text-sm whitespace-pre-wrap">{f.comment}</p>
                      ) : null}
                      {f.telegramLastError ? (
                        <p className="mt-1 text-xs text-destructive">
                          TG: {f.telegramLastError}
                        </p>
                      ) : null}
                      {f.photoIds.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {f.photoIds.map((pid) => (
                            <FeedbackPhoto key={pid} id={pid} />
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" onClick={() => void setFeedbackStatus(f.id, "IN_REVIEW")}>
                          Ko‘rib chiqish
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void setFeedbackStatus(f.id, "RESOLVED")}>
                          Hal qilindi
                        </Button>
                        {f.telegramDelivery === "FAILED" ||
                        f.telegramDelivery === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void retryTelegram(f.id)}
                          >
                            Telegram qayta
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeedbackPhoto({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await apiFetchBlob(`/qr-codes/photos/${id}`);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!src) return <Skeleton className="h-16 w-16" />;
  return (
    <button
      type="button"
      onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
      className="overflow-hidden rounded-md border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-16 w-16 object-cover" />
    </button>
  );
}
