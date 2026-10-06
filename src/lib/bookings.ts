import { addDays, dayIndex } from "@/lib/vehicle-rentals";

export { addDays, fromStoredDate, tashkentToday, toStoredDate } from "@/lib/vehicle-rentals";

export const BOOKING_INDUSTRIES = ["HOTEL_HOSTEL", "VILLA_RENTAL"] as const;
export type BookingIndustry = (typeof BOOKING_INDUSTRIES)[number];

export function isBookingIndustry(value: unknown): value is BookingIndustry {
  return (BOOKING_INDUSTRIES as readonly unknown[]).includes(value);
}

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Joylashgan",
  CHECKED_OUT: "Chiqib ketgan",
  CANCELLED: "Bekor qilingan",
};

/** Statuses that occupy the unit for their nights. */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];
export const CLOSED_BOOKING_STATUSES: readonly BookingStatus[] = ["CHECKED_OUT", "CANCELLED"];
export const INITIAL_BOOKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export const isClosedBooking = (status: BookingStatus) => CLOSED_BOOKING_STATUSES.includes(status);

/** Only bookings that never became a stay can be removed; the rest is history. */
export const isDeletableBooking = (status: BookingStatus) => status === "PENDING" || status === "CANCELLED";

export type BookingAction = "confirm" | "checkIn" | "checkOut" | "cancel" | "delete";

export const BOOKING_ACTION_STATUS: Record<Exclude<BookingAction, "delete">, BookingStatus> = {
  confirm: "CONFIRMED",
  checkIn: "CHECKED_IN",
  checkOut: "CHECKED_OUT",
  cancel: "CANCELLED",
};

/** Row actions offered in the UI; mirrors the server transition table. */
export function availableBookingActions(status: BookingStatus): BookingAction[] {
  const kinds = (Object.keys(BOOKING_ACTION_STATUS) as Exclude<BookingAction, "delete">[]).filter((k) =>
    canTransition(status, BOOKING_ACTION_STATUS[k])
  ) as BookingAction[];
  if (isDeletableBooking(status)) kinds.push("delete");
  return kinds;
}

export const MAX_BOOKING_NIGHTS = 365;
export const MAX_GUESTS = 50;

export type Booking = {
  id: string;
  propertyId: string;
  tenantId: string;
  /** YYYY-MM-DD (Asia/Tashkent calendar day). */
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  nightlyRate: number;
  totalAmount: number;
  status: BookingStatus;
  guestCount: number;
  notes: string | null;
  propertyName: string;
  guestName: string;
  createdAt: string;
};

/**
 * Hotel convention: nights = checkOut − checkIn (10→11 = 1 night).
 * Same day or reversed → null. Not the inclusive-day CAR rental rule.
 */
export function bookingNights(checkInDate: string, checkOutDate: string): number | null {
  const a = dayIndex(checkInDate);
  const b = dayIndex(checkOutDate);
  if (a === null || b === null || b <= a) return null;
  return b - a;
}

export function bookingTotal(nights: number, nightlyRate: number): number {
  return Math.round(nights * nightlyRate);
}

/** Half-open [checkIn, checkOut): a checkout day can be the next guest's check-in day. */
export function bookingRangesOverlap(
  a: { checkInDate: string; checkOutDate: string },
  b: { checkInDate: string; checkOutDate: string }
): boolean {
  return a.checkInDate < b.checkOutDate && b.checkInDate < a.checkOutDate;
}

/** Wording per industry. Same engine, different labels. */
export function bookingTerms(industry: unknown) {
  const villa = industry === "VILLA_RENTAL";
  return {
    unit: villa ? "Dacha / Villa" : "Xona",
    guest: villa ? "Mijoz" : "Mehmon",
    subtitle: villa
      ? "Dacha va villa bronlarini boshqaring"
      : "Mehmonxona bronlari va joylashuvlarini boshqaring",
  };
}

export type BookingInput = {
  propertyId: string;
  tenantId: string;
  checkInDate: string;
  checkOutDate: string;
  nightlyRate: number;
  guestCount: number;
  status: (typeof INITIAL_BOOKING_STATUSES)[number];
  notes: string | null;
};

/** `propertyId` is never parsed from /api/bookings PATCH; only the hotel guest flow moves a stay. */
export type BookingUpdateInput = Partial<Omit<BookingInput, "status">> & {
  status?: BookingStatus;
};

type Parsed<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export function parseDates(checkIn: unknown, checkOut: unknown): Parsed<{ checkInDate: string; checkOutDate: string }> {
  if (dayIndex(checkIn) === null) return { error: "Kirish sanasini to‘g‘ri kiriting" };
  if (dayIndex(checkOut) === null) return { error: "Chiqish sanasini to‘g‘ri kiriting" };
  const checkInDate = String(checkIn).trim();
  const checkOutDate = String(checkOut).trim();
  const nights = bookingNights(checkInDate, checkOutDate);
  if (nights === null) return { error: "Chiqish sanasi kirish sanasidan keyin bo‘lishi kerak (kamida 1 tun)" };
  if (nights > MAX_BOOKING_NIGHTS) return { error: `Bron ${MAX_BOOKING_NIGHTS} tundan oshmasligi kerak` };
  return { data: { checkInDate, checkOutDate } };
}

export function parseRate(value: unknown): Parsed<number> {
  const rate = Number(value);
  if (value === "" || value == null || !Number.isFinite(rate) || rate <= 0) {
    return { error: "Tunlik narx 0 dan katta bo‘lishi kerak" };
  }
  return { data: rate };
}

export function parseGuests(value: unknown): Parsed<number> {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_GUESTS) {
    return { error: `Mehmonlar soni 1 dan ${MAX_GUESTS} gacha bo‘lishi kerak` };
  }
  return { data: n };
}

export const optionalNotes = (value: unknown) => String(value ?? "").trim().slice(0, 1000) || null;

/** Create body. `customerId`/`guestId` alias `tenantId`; workspaceId and industry are ignored. */
export function parseBookingInput(body: unknown): Parsed<BookingInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const propertyId = String(b.propertyId ?? "").trim();
  if (!propertyId) return { error: "Xona yoki obyektni tanlang" };
  const tenantId = String(b.tenantId ?? b.customerId ?? b.guestId ?? "").trim();
  if (!tenantId) return { error: "Mehmon yoki mijozni tanlang" };
  const dates = parseDates(b.checkInDate, b.checkOutDate);
  if (dates.error !== undefined) return { error: dates.error };
  const rate = parseRate(b.nightlyRate);
  if (rate.error !== undefined) return { error: rate.error };
  const guests = parseGuests(b.guestCount ?? 1);
  if (guests.error !== undefined) return { error: guests.error };
  const status = b.status ?? "CONFIRMED";
  if (status !== "PENDING" && status !== "CONFIRMED") {
    return { error: "Yangi bron faqat «Kutilmoqda» yoki «Tasdiqlangan» bo‘lishi mumkin" };
  }
  return {
    data: {
      propertyId,
      tenantId,
      ...dates.data,
      nightlyRate: rate.data,
      guestCount: guests.data,
      status,
      notes: optionalNotes(b.notes),
    },
  };
}

/** PATCH body: only present keys. Dates must be sent together; the unit cannot change. */
export function parseBookingUpdate(body: unknown): Parsed<BookingUpdateInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const out: BookingUpdateInput = {};
  if (b.status !== undefined) {
    if (!(BOOKING_STATUSES as readonly unknown[]).includes(b.status)) return { error: "Status noto‘g‘ri" };
    out.status = b.status as BookingStatus;
  }
  const tenant = b.tenantId ?? b.customerId ?? b.guestId;
  if (tenant !== undefined) {
    out.tenantId = String(tenant).trim();
    if (!out.tenantId) return { error: "Mehmon yoki mijozni tanlang" };
  }
  if (b.checkInDate !== undefined || b.checkOutDate !== undefined) {
    const dates = parseDates(b.checkInDate, b.checkOutDate);
    if (dates.error !== undefined) return { error: dates.error };
    Object.assign(out, dates.data);
  }
  if (b.nightlyRate !== undefined) {
    const rate = parseRate(b.nightlyRate);
    if (rate.error !== undefined) return { error: rate.error };
    out.nightlyRate = rate.data;
  }
  if (b.guestCount !== undefined) {
    const guests = parseGuests(b.guestCount);
    if (guests.error !== undefined) return { error: guests.error };
    out.guestCount = guests.data;
  }
  if (b.notes !== undefined) out.notes = optionalNotes(b.notes);
  return { data: out };
}

// ---- Dashboard selectors (all dates YYYY-MM-DD, Asia/Tashkent) ----

type Stay = Pick<Booking, "status" | "checkInDate" | "checkOutDate">;

const isBlocking = (b: Stay) => BLOCKING_BOOKING_STATUSES.includes(b.status);

/** Occupies the unit tonight: checked in (even if overstaying), or a blocking booking covering today. */
export function occupiesToday(b: Stay, today: string): boolean {
  if (b.status === "CHECKED_IN") return true;
  return isBlocking(b) && b.checkInDate <= today && today < b.checkOutDate;
}

export function selectOccupiedPropertyIds<T extends Stay & Pick<Booking, "propertyId">>(bookings: T[], today: string) {
  return new Set(bookings.filter((b) => occupiesToday(b, today)).map((b) => b.propertyId));
}

/** Arrivals expected today (not yet cancelled; includes ones already checked in today). */
export function selectTodayCheckIns<T extends Stay>(bookings: T[], today: string) {
  return bookings.filter((b) => b.checkInDate === today && isBlocking(b));
}

/** Departures due today: still in house or already checked out today. */
export function selectTodayCheckOuts<T extends Stay>(bookings: T[], today: string) {
  return bookings.filter(
    (b) => b.checkOutDate === today && (b.status === "CHECKED_IN" || b.status === "CONFIRMED" || b.status === "CHECKED_OUT")
  );
}

export function selectCurrentStays<T extends Stay>(bookings: T[], today: string) {
  return bookings
    .filter((b) => occupiesToday(b, today))
    .sort((a, b) => a.checkOutDate.localeCompare(b.checkOutDate));
}

/** Guests in house right now (checked in). */
export function countCurrentGuests(bookings: Pick<Booking, "status" | "guestCount">[]): number {
  return bookings.reduce((sum, b) => (b.status === "CHECKED_IN" ? sum + (b.guestCount || 0) : sum), 0);
}

export function selectUpcomingArrivals<T extends Stay>(bookings: T[], today: string, withinDays = 7) {
  const until = addDays(today, withinDays);
  return bookings
    .filter((b) => (b.status === "PENDING" || b.status === "CONFIRMED") && b.checkInDate >= today && b.checkInDate <= until)
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
}

export function selectUpcomingDepartures<T extends Stay>(bookings: T[], today: string, withinDays = 7) {
  const until = addDays(today, withinDays);
  return bookings
    .filter((b) => occupiesToday(b, today) && b.checkOutDate <= until)
    .sort((a, b) => a.checkOutDate.localeCompare(b.checkOutDate));
}
