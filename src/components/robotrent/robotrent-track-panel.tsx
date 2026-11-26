"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Search, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ROBOTRENT_STATUS_LABELS,
  ROBOTRENT_STATUS_ORDER,
} from "@/lib/robotrent/constants";
import { displayDate, displayNumber, displayValue } from "@/lib/robotrent/format";
import { cn } from "@/lib/utils";

type Status = keyof typeof ROBOTRENT_STATUS_LABELS;

interface TrackingData {
  trackingCode: string;
  type: string;
  typeLabel: string;
  status: Status;
  statusLabel: string;
  companyName: string;
  createdAt: string;
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-[var(--rr-muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--rr-text)] sm:text-right">{value}</dd>
    </div>
  );
}

export function RobotRentTrackPanel({
  initialCode,
}: {
  initialCode?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/public/robotrent/track/${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => null)) as {
        data?: TrackingData;
      } | null;
      if (res.status === 404) {
        setError("Bunday tracking kodli ariza topilmadi.");
        return;
      }
      if (!res.ok || !json?.data) {
        setError("Ariza holatini yuklab bo‘lmadi. Keyinroq urinib ko‘ring.");
        return;
      }
      setData(json.data);
    } catch {
      setError("Server bilan bog‘lanib bo‘lmadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) void load(initialCode);
  }, [initialCode, load]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!initialCode || initialCode.toUpperCase() !== trimmed.toUpperCase()) {
      router.push(`/robotrent/track/${encodeURIComponent(trimmed)}`);
    } else {
      void load(trimmed);
    }
  }

  const reachedIndex = data
    ? ROBOTRENT_STATUS_ORDER.indexOf(data.status)
    : -1;
  const rejected = data?.status === "REJECTED";
  const eventByStatus = new Map(data?.timeline.map((t) => [t.status, t]));

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="robotrent-card flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="rr-track-code" className="text-[var(--rr-text)]">
            Tracking kod
          </Label>
          <Input
            id="rr-track-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="RRG-20260101-ABC123"
            autoComplete="off"
            className="border-white/15 bg-white/5 font-mono uppercase text-[var(--rr-text)] placeholder:text-[var(--rr-muted)] focus-visible:ring-cyan-400/50"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !code.trim()}
          className="bg-[var(--rr-primary)] text-white hover:bg-[var(--rr-primary-hover)]"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
          Tekshirish
        </Button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[var(--rr-muted)]">
          <Loader2 className="size-5 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <section className="robotrent-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[var(--rr-primary)]">
                  {data.trackingCode}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--rr-text)]">
                  {displayValue(data.companyName)}
                </h2>
                <p className="text-sm text-[var(--rr-muted)]">
                  {data.typeLabel} · {displayDate(data.createdAt)}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  rejected
                    ? "bg-red-500/15 text-red-800"
                    : "bg-cyan-400/15 text-[var(--rr-primary)]"
                )}
              >
                {data.statusLabel}
              </span>
            </div>
          </section>

          <section className="robotrent-card p-6">
            <h3 className="text-lg font-semibold text-[var(--rr-text)]">Holat tarixi</h3>
            <ol className="mt-5 space-y-0">
              {ROBOTRENT_STATUS_ORDER.map((status, i) => {
                const event = eventByStatus.get(status);
                const done = !rejected ? i <= reachedIndex : Boolean(event);
                const current = !rejected && i === reachedIndex;
                const last = i === ROBOTRENT_STATUS_ORDER.length - 1 && !rejected;
                return (
                  <li key={status} className="relative flex gap-4 pb-6 last:pb-0">
                    {!last || rejected ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px",
                          done ? "bg-[var(--rr-primary)]/40" : "bg-black/10"
                        )}
                      />
                    ) : null}
                    {done ? (
                      <CheckCircle2
                        className={cn(
                          "relative size-6 shrink-0",
                          current ? "text-[var(--rr-primary)]" : "text-[var(--rr-primary)]/70"
                        )}
                      />
                    ) : (
                      <Circle className="relative size-6 shrink-0 text-[var(--rr-muted)]" />
                    )}
                    <div>
                      <p
                        className={cn(
                          "font-medium",
                          done ? "text-[var(--rr-text)]" : "text-[var(--rr-muted)]"
                        )}
                      >
                        {ROBOTRENT_STATUS_LABELS[status]}
                      </p>
                      {event ? (
                        <p className="text-xs text-[var(--rr-muted)]">
                          {displayDate(event.at)}
                          {event.note ? ` · ${event.note}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {rejected ? (
                <li className="relative flex gap-4 pt-0">
                  <XCircle className="relative size-6 shrink-0 text-red-400" />
                  <div>
                    <p className="font-medium text-red-800">
                      {ROBOTRENT_STATUS_LABELS.REJECTED}
                    </p>
                    {eventByStatus.get("REJECTED") ? (
                      <p className="text-xs text-[var(--rr-muted)]">
                        {displayDate(eventByStatus.get("REJECTED")!.at)}
                        {eventByStatus.get("REJECTED")!.note
                          ? ` · ${eventByStatus.get("REJECTED")!.note}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </li>
              ) : null}
            </ol>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="robotrent-card p-6">
              <h3 className="text-lg font-semibold text-[var(--rr-text)]">Sinov</h3>
              {data.trial ? (
                <dl className="mt-4 space-y-3">
                  <Row label="Robot" value={displayValue(data.trial.robotName)} />
                  <Row label="Sinov zonasi" value={displayValue(data.trial.trialZone)} />
                  <Row label="Boshlanish" value={displayDate(data.trial.startDate)} />
                  <Row label="Muddat" value={displayNumber(data.trial.trialDays, " kun")} />
                  <Row label="Kunlik narx" value={displayNumber(data.trial.dailyRate, " so‘m")} />
                  <Row
                    label="Kunlik tozalangan maydon"
                    value={displayNumber(data.trial.dailyCleanedAreaSqm, " m²")}
                  />
                  <Row label="Xarajat izohi" value={displayValue(data.trial.costNotes)} />
                  <Row label="Hisobot" value={displayValue(data.trial.reportSummary)} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-[var(--rr-muted)]">
                  {displayValue(null)}
                </p>
              )}
            </section>

            <section className="robotrent-card p-6">
              <h3 className="text-lg font-semibold text-[var(--rr-text)]">Oylik ijara</h3>
              {data.rentalOffer ? (
                <dl className="mt-4 space-y-3">
                  <Row
                    label="Oylik to‘lov"
                    value={displayNumber(
                      data.rentalOffer.monthlyAmount,
                      ` ${data.rentalOffer.currency || "so‘m"}`
                    )}
                  />
                  <Row label="Shartlar" value={displayValue(data.rentalOffer.terms)} />
                  <Row label="Amal qilish muddati" value={displayDate(data.rentalOffer.validUntil)} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-[var(--rr-muted)]">
                  {displayValue(null)}
                </p>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

