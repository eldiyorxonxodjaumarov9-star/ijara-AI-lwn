import { formatTashkentDate, getTashkentDateParts } from "@/lib/payment-due-schedule";

export const VEHICLE_RENTAL_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type VehicleRentalStatus = (typeof VEHICLE_RENTAL_STATUSES)[number];

export const VEHICLE_RENTAL_STATUS_LABELS: Record<VehicleRentalStatus, string> = {
  PLANNED: "Rejalashtirilgan",
  ACTIVE: "Faol",
  COMPLETED: "Yakunlangan",
  CANCELLED: "Bekor qilingan",
};

/** Statuses that occupy the vehicle for their date range. */
export const BLOCKING_RENTAL_STATUSES: readonly VehicleRentalStatus[] = ["PLANNED", "ACTIVE"];

export const MAX_RENTAL_DAYS = 365;

export type VehicleRental = {
  id: string;
  vehicleId: string;
  tenantId: string;
  /** YYYY-MM-DD (Asia/Tashkent calendar day). */
  startDate: string;
  endDate: string;
  days: number;
  dailyRate: number;
  totalAmount: number;
  status: VehicleRentalStatus;
  notes: string | null;
  vehicleName: string;
  plateNumber: string;
  customerName: string;
  createdAt: string;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Valid calendar date "YYYY-MM-DD" → day index, else null. */
export function dayIndex(value: unknown): number | null {
  const m = typeof value === "string" ? DATE_RE.exec(value.trim()) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}

export function tashkentToday(now = new Date()): string {
  return formatTashkentDate(getTashkentDateParts(now));
}

export function addDays(date: string, days: number): string {
  const idx = dayIndex(date);
  if (idx === null) throw new Error("invalid date");
  return new Date((idx + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Stored as Tashkent midnight so the calendar day survives any server TZ. */
export function toStoredDate(date: string): Date {
  return new Date(`${date}T00:00:00+05:00`);
}

export function fromStoredDate(value: Date | string): string {
  return formatTashkentDate(getTashkentDateParts(value));
}

/**
 * Pricing convention: both the start and the end day are charged
 * (inclusive calendar days). Same-day rental = 1 day; 1st→3rd = 3 days.
 */
export function rentalDays(startDate: string, endDate: string): number | null {
  const s = dayIndex(startDate);
  const e = dayIndex(endDate);
  if (s === null || e === null || e < s) return null;
  return e - s + 1;
}

export function rentalTotal(days: number, dailyRate: number): number {
  return Math.round(days * dailyRate);
}

/** Inclusive ranges: a same-day handover counts as an overlap. */
export function rentalRangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string }
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/** Past range → COMPLETED (history), covering today → ACTIVE, future → PLANNED. */
export function initialRentalStatus(startDate: string, endDate: string, today: string): VehicleRentalStatus {
  if (endDate < today) return "COMPLETED";
  if (startDate <= today) return "ACTIVE";
  return "PLANNED";
}

export type RentalInput = {
  vehicleId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  notes: string | null;
};

export type RentalUpdateInput = Partial<Omit<RentalInput, "vehicleId">> & {
  status?: "COMPLETED" | "CANCELLED";
};

type Parsed<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

function parseDates(startDate: unknown, endDate: unknown): Parsed<{ startDate: string; endDate: string }> {
  if (dayIndex(startDate) === null) return { error: "Boshlanish sanasini to‘g‘ri kiriting" };
  if (dayIndex(endDate) === null) return { error: "Tugash sanasini to‘g‘ri kiriting" };
  const s = String(startDate).trim();
  const e = String(endDate).trim();
  const days = rentalDays(s, e);
  if (days === null) return { error: "Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas" };
  if (days > MAX_RENTAL_DAYS) return { error: `Ijara muddati ${MAX_RENTAL_DAYS} kundan oshmasligi kerak` };
  return { data: { startDate: s, endDate: e } };
}

function parseRate(value: unknown): Parsed<number> {
  const rate = Number(value);
  if (value === "" || value == null || !Number.isFinite(rate) || rate <= 0) {
    return { error: "Kunlik narx 0 dan katta bo‘lishi kerak" };
  }
  return { data: rate };
}

const optionalNotes = (value: unknown) => String(value ?? "").trim().slice(0, 1000) || null;

/** Create body. `customerId` is accepted as an alias of `tenantId`; workspaceId is ignored. */
export function parseRentalInput(body: unknown): Parsed<RentalInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const vehicleId = String(b.vehicleId ?? "").trim();
  if (!vehicleId) return { error: "Avtomobilni tanlang" };
  const tenantId = String(b.tenantId ?? b.customerId ?? "").trim();
  if (!tenantId) return { error: "Mijozni tanlang" };
  const dates = parseDates(b.startDate, b.endDate);
  if (dates.error !== undefined) return { error: dates.error };
  const rate = parseRate(b.dailyRate);
  if (rate.error !== undefined) return { error: rate.error };
  return { data: { vehicleId, tenantId, ...dates.data, dailyRate: rate.data, notes: optionalNotes(b.notes) } };
}

/** PATCH body: only present keys. Dates must be sent together. */
export function parseRentalUpdate(body: unknown): Parsed<RentalUpdateInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const out: RentalUpdateInput = {};
  if (b.status !== undefined) {
    if (b.status !== "COMPLETED" && b.status !== "CANCELLED") return { error: "Status noto‘g‘ri" };
    out.status = b.status;
  }
  const tenant = b.tenantId ?? b.customerId;
  if (tenant !== undefined) {
    out.tenantId = String(tenant).trim();
    if (!out.tenantId) return { error: "Mijozni tanlang" };
  }
  if (b.startDate !== undefined || b.endDate !== undefined) {
    const dates = parseDates(b.startDate, b.endDate);
    if (dates.error !== undefined) return { error: dates.error };
    Object.assign(out, dates.data);
  }
  if (b.dailyRate !== undefined) {
    const rate = parseRate(b.dailyRate);
    if (rate.error !== undefined) return { error: rate.error };
    out.dailyRate = rate.data;
  }
  if (b.notes !== undefined) out.notes = optionalNotes(b.notes);
  return { data: out };
}

/** Rentals that start today (not cancelled). */
export function selectTodayRentals<T extends Pick<VehicleRental, "startDate" | "status">>(rentals: T[], today: string) {
  return rentals.filter((r) => r.startDate === today && r.status !== "CANCELLED");
}

export function selectActiveRentals<T extends Pick<VehicleRental, "status" | "endDate">>(rentals: T[]) {
  return rentals.filter((r) => r.status === "ACTIVE").sort((a, b) => a.endDate.localeCompare(b.endDate));
}

/** Active rentals due back within `withinDays` (overdue ones first). */
export function selectUpcomingReturns<T extends Pick<VehicleRental, "status" | "endDate">>(
  rentals: T[],
  today: string,
  withinDays = 7
) {
  const limit = addDays(today, withinDays);
  return selectActiveRentals(rentals).filter((r) => r.endDate <= limit);
}
