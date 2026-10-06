import {
  bookingNights,
  bookingTotal,
  optionalNotes,
  parseDates,
  parseGuests,
  parseRate,
  type BookingArrivalStatus,
  type BookingStatus,
} from "@/lib/bookings";
import {
  SOURCE_PAYMENT_METHODS,
  type PaymentSummaryStatus,
  type SourcePaymentMethod,
} from "@/lib/source-payments";

/** The guest-placement flow (guest + room + people + dates + payment) is HOTEL_HOSTEL only. */
export const isHotelGuestIndustry = (industry: unknown) => industry === "HOTEL_HOSTEL";

export type HotelGuestRow = {
  bookingId: string;
  /** Null for a reservation whose guest has not arrived yet. */
  tenantId: string | null;
  arrivalStatus: BookingArrivalStatus;
  fullName: string;
  phone: string;
  clientNumber: string | null;
  propertyId: string;
  propertyName: string;
  guestCount: number;
  /** YYYY-MM-DD (Asia/Tashkent). */
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  nightlyRate: number;
  totalAmount: number;
  status: BookingStatus;
  notes: string | null;
  paid: number;
  remaining: number;
  paymentStatus: PaymentSummaryStatus;
  paymentCount: number;
  lastPaymentDate: string | null;
};

/** Guests from the old rental form that never got a booking. */
export type UnplacedGuest = { tenantId: string; fullName: string; phone: string; clientNumber: string | null };

export type HotelGuestList = { rows: HotelGuestRow[]; unplaced: UnplacedGuest[] };

export type HotelGuestInput = {
  fullName: string;
  phone: string;
  propertyId: string;
  guestCount: number;
  checkInDate: string;
  checkOutDate: string;
  nightlyRate: number;
  paymentAmount: number;
  paymentMethod: SourcePaymentMethod;
  notes: string | null;
};

export type HotelGuestUpdate = Partial<Omit<HotelGuestInput, "paymentAmount" | "paymentMethod">>;

type Parsed<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

function parseName(value: unknown): Parsed<string> {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) return { error: "F.I.O kiriting" };
  return { data: name.slice(0, 120) };
}

function parsePhone(value: unknown): Parsed<string> {
  const phone = String(value ?? "").trim();
  if (phone.replace(/\D/g, "").length < 7) return { error: "Telefon raqamini kiriting" };
  return { data: phone.slice(0, 32) };
}

function parsePaymentAmount(value: unknown): Parsed<number> {
  if (value === undefined || value === null || value === "") return { data: 0 };
  const n = typeof value === "string" ? Number(value.replace(/\s/g, "")) : Number(value);
  if (!Number.isFinite(n) || n < 0) return { error: "To‘lov summasi noto‘g‘ri" };
  return { data: Math.round(n * 100) / 100 };
}

function parseMethod(value: unknown): Parsed<SourcePaymentMethod> {
  if (value === undefined || value === null || value === "") return { data: "CASH" };
  const m = String(value).toUpperCase();
  return (SOURCE_PAYMENT_METHODS as readonly string[]).includes(m)
    ? { data: m as SourcePaymentMethod }
    : { error: "To‘lov turi noto‘g‘ri" };
}

function parseRoom(value: unknown): Parsed<string> {
  const id = String(value ?? "").trim();
  return id ? { data: id } : { error: "Xona yoki domikni tanlang" };
}

/** Create body. Credentials, contract and monthly-rent fields are not part of this flow and are ignored. */
export function parseHotelGuestInput(body: unknown): Parsed<HotelGuestInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const name = parseName(b.fullName);
  if (name.error !== undefined) return name;
  const phone = parsePhone(b.phone);
  if (phone.error !== undefined) return phone;
  const room = parseRoom(b.propertyId);
  if (room.error !== undefined) return room;
  const guests = parseGuests(b.guestCount);
  if (guests.error !== undefined) return { error: "Odam soni kamida 1 bo‘lishi kerak" };
  const dates = parseDates(b.checkInDate, b.checkOutDate);
  if (dates.error !== undefined) return dates;
  const rate = parseRate(b.nightlyRate);
  if (rate.error !== undefined) return rate;
  const amount = parsePaymentAmount(b.paymentAmount);
  if (amount.error !== undefined) return amount;
  const method = parseMethod(b.paymentMethod);
  if (method.error !== undefined) return method;
  const total = bookingTotal(bookingNights(dates.data.checkInDate, dates.data.checkOutDate)!, rate.data);
  if (amount.data > total) return { error: "To‘lov summasi jami summadan oshmasligi kerak" };
  return {
    data: {
      fullName: name.data,
      phone: phone.data,
      propertyId: room.data,
      guestCount: guests.data,
      ...dates.data,
      nightlyRate: rate.data,
      paymentAmount: amount.data,
      paymentMethod: method.data,
      notes: optionalNotes(b.notes),
    },
  };
}

/** Edit body: only present keys. Dates travel together. Payments are edited in To‘lovlar. */
export function parseHotelGuestUpdate(body: unknown): Parsed<HotelGuestUpdate> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const out: HotelGuestUpdate = {};
  if (b.fullName !== undefined) {
    const r = parseName(b.fullName);
    if (r.error !== undefined) return r;
    out.fullName = r.data;
  }
  if (b.phone !== undefined) {
    const r = parsePhone(b.phone);
    if (r.error !== undefined) return r;
    out.phone = r.data;
  }
  if (b.propertyId !== undefined) {
    const r = parseRoom(b.propertyId);
    if (r.error !== undefined) return r;
    out.propertyId = r.data;
  }
  if (b.guestCount !== undefined) {
    const r = parseGuests(b.guestCount);
    if (r.error !== undefined) return { error: "Odam soni kamida 1 bo‘lishi kerak" };
    out.guestCount = r.data;
  }
  if (b.checkInDate !== undefined || b.checkOutDate !== undefined) {
    const r = parseDates(b.checkInDate, b.checkOutDate);
    if (r.error !== undefined) return r;
    Object.assign(out, r.data);
  }
  if (b.nightlyRate !== undefined) {
    const r = parseRate(b.nightlyRate);
    if (r.error !== undefined) return r;
    out.nightlyRate = r.data;
  }
  if (b.notes !== undefined) out.notes = optionalNotes(b.notes);
  return { data: out };
}

/**
 * Placing a guest means they are in the room now (CHECKED_IN). A future arrival is a reservation
 * (Bronlar) and gets no guest record until "Keldi". A stay that already ended is not a placement.
 */
export function initialGuestStatus(
  range: { checkInDate: string; checkOutDate: string },
  today: string
): Parsed<"CHECKED_IN"> {
  if (range.checkOutDate <= today) return { error: "Ketish sanasi bugundan keyin bo‘lishi kerak" };
  if (range.checkInDate > today) {
    return { error: "Kelajakdagi kelish uchun «Bronlar» bo‘limida bron yarating" };
  }
  return { data: "CHECKED_IN" };
}

/** Comparable phone: digits only, local 9-digit UZ numbers get the 998 prefix. Too short → null. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length === 9 ? `998${digits}` : digits;
}

/** "Keldi" body: whether money was taken at arrival, and how much. */
export type ArrivalInput = { paymentAmount: number; paymentMethod: SourcePaymentMethod };

export function parseArrivalInput(body: unknown): Parsed<ArrivalInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  if (b.paymentStatus !== "PAID" && b.paymentStatus !== "UNPAID") return { error: "To‘lov holatini tanlang" };
  if (b.paymentStatus === "UNPAID") return { data: { paymentAmount: 0, paymentMethod: "CASH" } };
  const amount = parsePaymentAmount(b.paymentAmount);
  if (amount.error !== undefined) return amount;
  if (amount.data <= 0) return { error: "To‘lov summasi 0 dan katta bo‘lishi kerak" };
  const method = parseMethod(b.paymentMethod);
  if (method.error !== undefined) return method;
  return { data: { paymentAmount: amount.data, paymentMethod: method.data } };
}
