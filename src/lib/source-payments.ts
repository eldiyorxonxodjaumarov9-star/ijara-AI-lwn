import { isBookingIndustry } from "@/lib/bookings";
import { dayIndex } from "@/lib/vehicle-rentals";
import type { Payment, PaymentMethod } from "@/types";

/** CONTRACT = legacy `payments` table; the other two live in `source_payments`. */
export type PaymentSourceKind = "CONTRACT" | "VEHICLE_RENTAL" | "BOOKING";
export type SourcePaymentType = Exclude<PaymentSourceKind, "CONTRACT">;

export const SOURCE_PAYMENT_METHODS = ["CASH", "CARD", "BANK", "OTHER"] as const;
export type SourcePaymentMethod = (typeof SOURCE_PAYMENT_METHODS)[number];

export type PaymentSummaryStatus = "UNPAID" | "PARTIAL" | "PAID";

export const PAYMENT_SUMMARY_LABELS: Record<PaymentSummaryStatus, string> = {
  UNPAID: "To‘lanmagan",
  PARTIAL: "Qisman to‘langan",
  PAID: "To‘langan",
};

export type PaymentSummary = {
  total: number;
  paid: number;
  remaining: number;
  status: PaymentSummaryStatus;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Single place for total/paid/remaining/status. Never treats total as revenue. */
export function getPaymentSummary(total: number, paid: number): PaymentSummary {
  const t = round(Math.max(0, total || 0));
  const p = round(Math.max(0, paid || 0));
  const remaining = round(Math.max(0, t - p));
  const status: PaymentSummaryStatus = p <= 0 ? "UNPAID" : remaining <= 0 ? "PAID" : "PARTIAL";
  return { total: t, paid: p, remaining, status };
}

/** Industry decides the only allowed source; the client cannot pick another one. */
export function sourceTypeForIndustry(industry: string | null | undefined): SourcePaymentType | null {
  if (industry === "CAR_RENTAL") return "VEHICLE_RENTAL";
  if (isBookingIndustry(industry)) return "BOOKING";
  return null;
}

export function isSourcePaymentIndustry(industry: string | null | undefined) {
  return sourceTypeForIndustry(industry) !== null;
}

export type SourcePaymentTerms = {
  title: string;
  subtitle: string;
  customer: string;
  unit: string;
  period: string;
  total: string;
  source: string;
};

export function sourcePaymentTerms(industry: string | null | undefined): SourcePaymentTerms {
  if (industry === "CAR_RENTAL") {
    return {
      title: "To‘lovlar",
      subtitle: "Avtomobil ijaralari bo‘yicha to‘lovlar va qoldiqlar",
      customer: "Mijoz",
      unit: "Avtomobil",
      period: "Ijara muddati",
      total: "Jami ijara",
      source: "Ijara",
    };
  }
  const villa = industry === "VILLA_RENTAL";
  return {
    title: "To‘lovlar",
    subtitle: "Bronlar bo‘yicha to‘lovlar va qoldiqlar",
    customer: villa ? "Mijoz" : "Mehmon",
    unit: villa ? "Dacha / Villa" : "Xona",
    period: "Bron sanalari",
    total: "Jami",
    source: "Bron",
  };
}

export type SourcePaymentInput = {
  sourceId: string;
  sourceType?: SourcePaymentType;
  amount: number;
  /** YYYY-MM-DD (Tashkent) or undefined = now. */
  paymentDate?: string;
  paymentMethod: SourcePaymentMethod;
  notes: string | null;
};

export type SourcePaymentUpdateInput = Partial<Omit<SourcePaymentInput, "sourceId" | "sourceType">>;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT = 1_000_000_000_000;
const SOURCE_TYPES: readonly string[] = ["VEHICLE_RENTAL", "BOOKING"];

function parseAmount(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw.replace(/\s/g, "")) : Number(raw);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? round(n) : null;
}

function parseMethod(raw: unknown): SourcePaymentMethod | null {
  if (raw === undefined || raw === null || raw === "") return "CASH";
  const m = String(raw).toUpperCase();
  return (SOURCE_PAYMENT_METHODS as readonly string[]).includes(m) ? (m as SourcePaymentMethod) : null;
}

function parseDate(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && dayIndex(s) !== null ? s : null;
}

function parseNotes(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().slice(0, 1000);
  return s || null;
}

export function parseSourcePaymentInput(body: unknown): Parsed<SourcePaymentInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  for (const legacy of ["contractId", "workspaceId"]) {
    if (b[legacy] !== undefined && b[legacy] !== null && b[legacy] !== "") {
      return { ok: false, error: `${legacy} bu to‘lov turi uchun qabul qilinmaydi` };
    }
  }
  const ids = [b.vehicleRentalId, b.bookingId, b.sourceId].filter(
    (v) => typeof v === "string" && v.trim() !== ""
  ) as string[];
  if (ids.length === 0) return { ok: false, error: "To‘lov manbasini tanlang" };
  if (new Set(ids.map((v) => v.trim())).size > 1) {
    return { ok: false, error: "To‘lov faqat bitta manbaga bog‘lanadi" };
  }

  let sourceType: SourcePaymentType | undefined;
  if (b.vehicleRentalId && b.bookingId) return { ok: false, error: "To‘lov faqat bitta manbaga bog‘lanadi" };
  if (b.vehicleRentalId) sourceType = "VEHICLE_RENTAL";
  if (b.bookingId) sourceType = "BOOKING";
  if (b.sourceType !== undefined && b.sourceType !== null && b.sourceType !== "") {
    const st = String(b.sourceType).toUpperCase();
    if (!SOURCE_TYPES.includes(st)) return { ok: false, error: "To‘lov manbasi turi noto‘g‘ri" };
    if (sourceType && sourceType !== st) return { ok: false, error: "To‘lov manbasi turi mos emas" };
    sourceType = st as SourcePaymentType;
  }

  const amount = parseAmount(b.amount);
  if (amount === null) return { ok: false, error: "Summa 0 dan katta bo‘lishi kerak" };
  const paymentMethod = parseMethod(b.paymentMethod);
  if (!paymentMethod) return { ok: false, error: "To‘lov usuli noto‘g‘ri" };
  const paymentDate = parseDate(b.paymentDate ?? b.date);
  if (paymentDate === null) return { ok: false, error: "Sana noto‘g‘ri" };

  return {
    ok: true,
    value: { sourceId: ids[0].trim(), sourceType, amount, paymentDate, paymentMethod, notes: parseNotes(b.notes) },
  };
}

export function parseSourcePaymentUpdate(body: unknown): Parsed<SourcePaymentUpdateInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  for (const locked of ["sourceId", "sourceType", "vehicleRentalId", "bookingId", "contractId", "workspaceId"]) {
    if (b[locked] !== undefined) return { ok: false, error: "To‘lov manbasini o‘zgartirib bo‘lmaydi" };
  }
  const value: SourcePaymentUpdateInput = {};
  if (b.amount !== undefined) {
    const amount = parseAmount(b.amount);
    if (amount === null) return { ok: false, error: "Summa 0 dan katta bo‘lishi kerak" };
    value.amount = amount;
  }
  if (b.paymentMethod !== undefined) {
    const m = parseMethod(b.paymentMethod);
    if (!m) return { ok: false, error: "To‘lov usuli noto‘g‘ri" };
    value.paymentMethod = m;
  }
  if (b.paymentDate !== undefined || b.date !== undefined) {
    const d = parseDate(b.paymentDate ?? b.date);
    if (!d) return { ok: false, error: "Sana noto‘g‘ri" };
    value.paymentDate = d;
  }
  if (b.notes !== undefined) value.notes = parseNotes(b.notes);
  return { ok: true, value };
}

/** One row per rental/booking with server-aggregated balance. */
export type SourceBalance = PaymentSummary & {
  sourceType: SourcePaymentType;
  sourceId: string;
  sourceStatus: string;
  customerName: string;
  unitName: string;
  startDate: string;
  endDate: string;
  lastPaymentDate: string | null;
  paymentCount: number;
};

export type SourcePaymentView = {
  id: string;
  sourceType: SourcePaymentType;
  sourceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: SourcePaymentMethod;
  notes: string | null;
  customerName: string;
  unitName: string;
  createdAt: string;
};

export type SourcePaymentIncome = { today: number; month: number };

/** Same row shape the dashboard already renders for legacy contract payments. */
export type DashboardPaymentRow = Pick<
  Payment,
  "id" | "tenantName" | "propertyName" | "date" | "amount" | "method" | "createdAt"
>;

export function toDashboardPaymentRow(p: SourcePaymentView): Payment {
  return {
    id: `sp:${p.id}`,
    tenantName: p.customerName,
    propertyName: p.unitName,
    date: p.paymentDate,
    amount: p.amount,
    method: p.paymentMethod.toLowerCase() as PaymentMethod,
    createdAt: p.createdAt,
  };
}

/** Legacy + source rows, newest first. */
export function mergeRecentPayments(legacy: Payment[], source: SourcePaymentView[], take = 5): Payment[] {
  return [...legacy, ...source.map(toDashboardPaymentRow)]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, take);
}

/** Sources that may receive a new payment. Cancelled ones are closed (no refund system yet). */
export function isPayableSource(sourceStatus: string, remaining: number) {
  return sourceStatus !== "CANCELLED" && remaining > 0;
}
