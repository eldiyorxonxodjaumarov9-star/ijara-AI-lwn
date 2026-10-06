import type { Prisma, User } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";

import {
  BLOCKING_BOOKING_STATUSES,
  bookingNights,
  bookingTotal,
  canTransition,
  fromStoredDate,
  isBookingIndustry,
  isClosedBooking,
  isDeletableBooking,
  tashkentToday,
  toStoredDate,
  type Booking,
  type BookingInput,
  type BookingStatus,
  type BookingUpdateInput,
} from "@/lib/bookings";

import { fail } from "./http";
import { requireResourceAccess, type RbacMethod } from "./rbac";
import { resolveUserWorkspaceContext, type WorkspaceContext } from "./workspace";

export class BookingError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const BOOKING_NOT_FOUND = () => new BookingError("Bron topilmadi", 404, "NOT_FOUND");
const PROPERTY_NOT_FOUND = () => new BookingError("Xona yoki obyekt topilmadi", 404, "PROPERTY_NOT_FOUND");
const GUEST_NOT_FOUND = () => new BookingError("Mehmon yoki mijoz topilmadi", 404, "CUSTOMER_NOT_FOUND");

/** Industry comes from the DB workspace row, never from the request. */
export function assertBookingIndustry(ctx: Pick<WorkspaceContext, "workspace">) {
  if (!isBookingIndustry(ctx.workspace.industry)) {
    throw new BookingError(
      "Bronlar bo‘limi faqat mehmonxona va dacha / villa biznesi uchun",
      403,
      "INDUSTRY_NOT_SUPPORTED"
    );
  }
}

type GuardOk = { user: User; ctx: WorkspaceContext; error?: undefined };
type GuardErr = { error: NextResponse; user?: undefined; ctx?: undefined };

export async function requireBookingWorkspace(req: NextRequest, method: RbacMethod): Promise<GuardOk | GuardErr> {
  const auth = await requireResourceAccess(req, "bookings", method);
  if (auth.error) return { error: auth.error };
  const ctx = await resolveUserWorkspaceContext(auth.user);
  if (!ctx.hasAccess) {
    return { error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") };
  }
  try {
    assertBookingIndustry(ctx);
  } catch (err) {
    return { error: bookingErrorResponse(err)! };
  }
  return { user: auth.user, ctx };
}

export function bookingErrorResponse(err: unknown) {
  if (err instanceof BookingError) return fail(err.message, err.status, err.code);
  if (err && typeof err === "object" && (err as { code?: string }).code === "P2003") {
    return fail("Bron tarixi bilan bog‘liq yozuvni o‘chirib bo‘lmaydi", 409, "BOOKING_HISTORY");
  }
  return null;
}

export type BookingDb = Pick<
  Prisma.TransactionClient,
  "booking" | "property" | "tenant" | "sourcePayment" | "$queryRaw"
>;

const BOOKING_INCLUDE = {
  property: { select: { title: true } },
  tenant: { select: { fullName: true } },
} as const;

type BookingRow = {
  id: string;
  propertyId: string;
  tenantId: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  nightlyRate: number;
  totalAmount: number;
  status: BookingStatus;
  guestCount: number;
  notes: string | null;
  createdAt: Date;
  property?: { title: string } | null;
  tenant?: { fullName: string } | null;
};

export function toBookingView(row: BookingRow): Booking {
  return {
    id: row.id,
    propertyId: row.propertyId,
    tenantId: row.tenantId,
    checkInDate: fromStoredDate(row.checkInDate),
    checkOutDate: fromStoredDate(row.checkOutDate),
    nights: row.nights,
    nightlyRate: row.nightlyRate,
    totalAmount: row.totalAmount,
    status: row.status,
    guestCount: row.guestCount,
    notes: row.notes,
    propertyName: row.property?.title ?? "—",
    guestName: row.tenant?.fullName ?? "—",
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/** Serializes bookings per unit (parallel creates queue here) and proves workspace ownership. */
async function lockProperty(db: BookingDb, workspaceId: string, propertyId: string) {
  await db.$queryRaw`SELECT id FROM properties WHERE id = ${propertyId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  const property = await db.property.findFirst({
    where: { id: propertyId, workspaceId },
    select: { id: true, status: true },
  });
  if (!property) throw PROPERTY_NOT_FOUND();
  return property;
}

async function assertGuest(db: BookingDb, workspaceId: string, tenantId: string) {
  const tenant = await db.tenant.findFirst({ where: { id: tenantId, workspaceId }, select: { id: true } });
  if (!tenant) throw GUEST_NOT_FOUND();
}

/** Half-open overlap in SQL: existing.checkIn < new.checkOut AND new.checkIn < existing.checkOut. */
async function assertAvailable(
  db: BookingDb,
  workspaceId: string,
  propertyId: string,
  range: { checkInDate: string; checkOutDate: string },
  exceptId?: string
) {
  const clash = await db.booking.findFirst({
    where: {
      workspaceId,
      propertyId,
      status: { in: [...BLOCKING_BOOKING_STATUSES] },
      checkInDate: { lt: toStoredDate(range.checkOutDate) },
      checkOutDate: { gt: toStoredDate(range.checkInDate) },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new BookingError(
      "Bu sanalarda joy band. Boshqa sana yoki boshqa joy tanlang.",
      409,
      "PROPERTY_NOT_AVAILABLE"
    );
  }
}

export async function listBookings(db: BookingDb, workspaceId: string) {
  const rows = await db.booking.findMany({
    where: { workspaceId },
    orderBy: { checkInDate: "desc" },
    include: BOOKING_INCLUDE,
  });
  return rows.map(toBookingView);
}

export async function getBooking(db: BookingDb, workspaceId: string, id: string) {
  const row = await db.booking.findFirst({ where: { id, workspaceId }, include: BOOKING_INCLUDE });
  if (!row) throw BOOKING_NOT_FOUND();
  return toBookingView(row);
}

export async function createBooking(db: BookingDb, workspaceId: string, input: BookingInput) {
  const property = await lockProperty(db, workspaceId, input.propertyId);
  if (property.status === "MAINTENANCE") {
    throw new BookingError("Ta’mirdagi joyni bron qilib bo‘lmaydi", 409, "PROPERTY_NOT_BOOKABLE");
  }
  await assertGuest(db, workspaceId, input.tenantId);
  await assertAvailable(db, workspaceId, property.id, input);

  const nights = bookingNights(input.checkInDate, input.checkOutDate)!;
  const created = await db.booking.create({
    data: {
      workspaceId,
      propertyId: property.id,
      tenantId: input.tenantId,
      checkInDate: toStoredDate(input.checkInDate),
      checkOutDate: toStoredDate(input.checkOutDate),
      nights,
      nightlyRate: input.nightlyRate,
      totalAmount: bookingTotal(nights, input.nightlyRate),
      status: input.status,
      guestCount: input.guestCount,
      notes: input.notes,
    },
    select: { id: true },
  });
  return getBooking(db, workspaceId, created.id);
}

export async function updateBooking(
  db: BookingDb,
  workspaceId: string,
  id: string,
  input: BookingUpdateInput,
  now = new Date()
) {
  const existing = await db.booking.findFirst({ where: { id, workspaceId } });
  if (!existing) throw BOOKING_NOT_FOUND();
  await lockProperty(db, workspaceId, existing.propertyId);

  if (isClosedBooking(existing.status)) {
    throw new BookingError("Yakunlangan yoki bekor qilingan bronni o‘zgartirib bo‘lmaydi", 409, "BOOKING_CLOSED");
  }

  const data: Prisma.BookingUncheckedUpdateManyInput = {};

  if (input.status !== undefined && input.status !== existing.status) {
    if (!canTransition(existing.status, input.status)) {
      throw new BookingError("Bu status o‘zgarishiga ruxsat yo‘q", 409, "INVALID_TRANSITION");
    }
    if (input.status === "CHECKED_IN" && fromStoredDate(existing.checkInDate) > tashkentToday(now)) {
      throw new BookingError("Kirish sanasidan oldin check-in qilib bo‘lmaydi", 409, "CHECK_IN_TOO_EARLY");
    }
    data.status = input.status;
  }

  if (input.notes !== undefined) data.notes = input.notes;
  if (input.guestCount !== undefined) data.guestCount = input.guestCount;
  if (input.tenantId !== undefined && input.tenantId !== existing.tenantId) {
    await assertGuest(db, workspaceId, input.tenantId);
    data.tenantId = input.tenantId;
  }

  let propertyId = existing.propertyId;
  const moved = input.propertyId !== undefined && input.propertyId !== existing.propertyId;
  if (moved) {
    const next = await lockProperty(db, workspaceId, input.propertyId!);
    if (next.status === "MAINTENANCE") {
      throw new BookingError("Ta’mirdagi joyni bron qilib bo‘lmaydi", 409, "PROPERTY_NOT_BOOKABLE");
    }
    propertyId = next.id;
    data.propertyId = next.id;
  }

  const datesChanged = input.checkInDate !== undefined || input.nightlyRate !== undefined;
  if (moved && !datesChanged) {
    const nextStatus = (data.status as BookingStatus | undefined) ?? existing.status;
    if (!isClosedBooking(nextStatus)) {
      const range = { checkInDate: fromStoredDate(existing.checkInDate), checkOutDate: fromStoredDate(existing.checkOutDate) };
      await assertAvailable(db, workspaceId, propertyId, range, id);
    }
  }

  if (datesChanged) {
    const checkInDate = input.checkInDate ?? fromStoredDate(existing.checkInDate);
    const checkOutDate = input.checkOutDate ?? fromStoredDate(existing.checkOutDate);
    const nightlyRate = input.nightlyRate ?? existing.nightlyRate;
    const nights = bookingNights(checkInDate, checkOutDate);
    if (nights === null) {
      throw new BookingError("Chiqish sanasi kirish sanasidan keyin bo‘lishi kerak", 400, "VALIDATION_ERROR");
    }
    const nextStatus = (data.status as BookingStatus | undefined) ?? existing.status;
    if (!isClosedBooking(nextStatus)) {
      await assertAvailable(db, workspaceId, propertyId, { checkInDate, checkOutDate }, id);
    }
    const totalAmount = bookingTotal(nights, nightlyRate);
    if (totalAmount < existing.totalAmount) {
      await db.$queryRaw`SELECT id FROM bookings WHERE id = ${id} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
      const agg = await db.sourcePayment.aggregate({ where: { workspaceId, bookingId: id }, _sum: { amount: true } });
      const paid = agg._sum.amount ?? 0;
      if (totalAmount < paid) {
        throw new BookingError(
          `Jami summa allaqachon to‘langan summadan (${paid}) kam bo‘lishi mumkin emas`,
          409,
          "TOTAL_BELOW_PAID"
        );
      }
    }
    Object.assign(data, {
      checkInDate: toStoredDate(checkInDate),
      checkOutDate: toStoredDate(checkOutDate),
      nights,
      nightlyRate,
      totalAmount,
    });
  }

  if (Object.keys(data).length > 0) {
    const { count } = await db.booking.updateMany({ where: { id, workspaceId }, data });
    if (count === 0) throw BOOKING_NOT_FOUND();
  }
  return getBooking(db, workspaceId, id);
}

export async function deleteBooking(db: BookingDb, workspaceId: string, id: string) {
  const existing = await db.booking.findFirst({ where: { id, workspaceId }, select: { propertyId: true, status: true } });
  if (!existing) throw BOOKING_NOT_FOUND();
  await lockProperty(db, workspaceId, existing.propertyId);
  if (!isDeletableBooking(existing.status)) {
    throw new BookingError(
      "Tasdiqlangan yoki yakunlangan bron tarix sifatida saqlanadi. Avval bekor qiling.",
      409,
      "BOOKING_NOT_DELETABLE"
    );
  }
  const { count } = await db.booking.deleteMany({ where: { id, workspaceId } });
  if (count === 0) throw BOOKING_NOT_FOUND();
  return { id };
}

type HistoryDb = Pick<Prisma.TransactionClient, "booking">;

/** Guards for existing property/tenant delete routes. Null = safe to delete. */
export async function propertyBookingHistoryResponse(db: HistoryDb, propertyId: string) {
  const n = await db.booking.count({ where: { propertyId } });
  return n > 0
    ? fail(
        "Bu joyning bron tarixi bor. O‘chirish o‘rniga holatini o‘zgartiring.",
        409,
        "PROPERTY_HAS_BOOKING_HISTORY"
      )
    : null;
}

export async function tenantBookingHistoryResponse(db: HistoryDb, tenantId: string) {
  const n = await db.booking.count({ where: { tenantId } });
  return n > 0
    ? fail("Bu mehmon / mijozning bron tarixi bor, uni o‘chirib bo‘lmaydi.", 409, "TENANT_HAS_BOOKING_HISTORY")
    : null;
}
