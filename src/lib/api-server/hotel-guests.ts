import type { Prisma, User } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";

import { fromStoredDate, tashkentToday, type BookingUpdateInput } from "@/lib/bookings";
import {
  initialGuestStatus,
  isHotelGuestIndustry,
  phoneKey,
  type ArrivalInput,
  type HotelGuestInput,
  type HotelGuestList,
  type HotelGuestUpdate,
} from "@/lib/hotel-guests";
import { getPaymentSummary } from "@/lib/source-payments";

import { BookingError, createBooking, getBooking, updateBooking } from "./bookings";
import { ensureTenantClientNumber } from "./client-number";
import { upsertClientFromTenant } from "./clients";
import { fail } from "./http";
import { createWithinPlanLimit, lockPlanQuota } from "./plan-service";
import { prisma } from "./prisma";
import { canAccessResource, requireResourceAccess, type RbacMethod } from "./rbac";
import { createSourcePayment } from "./source-payments";
import { resolveUserWorkspaceContext, type WorkspaceContext } from "./workspace";

const TX = { timeout: 15_000 };

type GuardOk = { user: User; ctx: WorkspaceContext; error?: undefined };
type GuardErr = { error: NextResponse; user?: undefined; ctx?: undefined };

/** Same RBAC as tenants; industry is read from the DB workspace, never from the request. */
export async function requireHotelGuestWorkspace(req: NextRequest, method: RbacMethod): Promise<GuardOk | GuardErr> {
  const auth = await requireResourceAccess(req, "tenants", method);
  if (auth.error) return { error: auth.error };
  const ctx = await resolveUserWorkspaceContext(auth.user);
  if (!ctx.hasAccess) return { error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") };
  if (!isHotelGuestIndustry(ctx.workspace.industry)) {
    return { error: fail("Mehmon joylashtirish faqat mehmonxona biznesi uchun", 403, "INDUSTRY_NOT_SUPPORTED") };
  }
  return { user: auth.user, ctx };
}

/** EMPLOYEE may place guests but cannot record money (same rule as /api/source-payments). */
export const canRecordGuestPayment = (user: Pick<User, "role">) => canAccessResource(user.role, "payments", "POST");

type GuestDb = Prisma.TransactionClient;

async function syncClient(tenantId: string) {
  try {
    await ensureTenantClientNumber(tenantId);
    const fresh = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (fresh) await upsertClientFromTenant(fresh);
  } catch (err) {
    console.error("[hotel-guests] client sync failed", err instanceof Error ? err.name : "unknown");
  }
}

/** Guest + booking (+ real source payment) in one transaction. No login, no contract. */
export async function createHotelGuest(
  ctx: WorkspaceContext,
  input: HotelGuestInput,
  opts: { canPay: boolean; now?: Date }
) {
  const now = opts.now ?? new Date();
  const status = initialGuestStatus(input, tashkentToday(now));
  if (status.error !== undefined) throw new BookingError(status.error, 400, "VALIDATION_ERROR");
  if (input.paymentAmount > 0 && !opts.canPay) {
    throw new BookingError("To‘lov kiritishga ruxsatingiz yo‘q", 403, "FORBIDDEN");
  }
  const workspaceId = ctx.workspace.id;

  const result = await createWithinPlanLimit(
    ctx,
    "tenants",
    async (db) => {
      const tenant = await db.tenant.create({
        data: { workspaceId, fullName: input.fullName, phone: input.phone, passport: "", rentAmount: 0 },
        select: { id: true },
      });
      const reserved = await createBooking(db, workspaceId, {
        propertyId: input.propertyId,
        tenantId: tenant.id,
        guestName: input.fullName,
        guestPhone: input.phone,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        nightlyRate: input.nightlyRate,
        guestCount: input.guestCount,
        status: "CONFIRMED",
        notes: input.notes,
      });
      const booking = await updateBooking(db, workspaceId, reserved.id, { status: status.data }, now);
      let payment = getPaymentSummary(booking.totalAmount, 0);
      if (input.paymentAmount > 0) {
        const paid = await createSourcePayment(
          db,
          workspaceId,
          "BOOKING",
          { sourceId: booking.id, sourceType: "BOOKING", amount: input.paymentAmount, paymentMethod: input.paymentMethod, notes: null },
          now
        );
        payment = paid.summary;
      }
      return { tenantId: tenant.id, booking, payment };
    },
    TX
  );
  await syncClient(result.tenantId);
  return result;
}

const BOOKING_KEYS = ["propertyId", "guestCount", "checkInDate", "checkOutDate", "nightlyRate", "notes"] as const;

/** Booking rules (closed, overlap, maintenance, total ≥ paid) run before the guest record changes. */
export async function updateHotelGuest(workspaceId: string, bookingId: string, input: HotelGuestUpdate, now = new Date()) {
  const result = await prisma.$transaction(async (db) => {
    const existing = await db.booking.findFirst({ where: { id: bookingId, workspaceId }, select: { tenantId: true } });
    if (!existing) throw new BookingError("Bron topilmadi", 404, "NOT_FOUND");
    const bookingInput: BookingUpdateInput = {};
    for (const key of BOOKING_KEYS) {
      if (input[key] !== undefined) Object.assign(bookingInput, { [key]: input[key] });
    }
    if (input.fullName !== undefined) bookingInput.guestName = input.fullName;
    if (input.phone !== undefined) bookingInput.guestPhone = input.phone;
    const booking = await updateBooking(db, workspaceId, bookingId, bookingInput, now);
    const guest: Prisma.TenantUpdateManyMutationInput = {};
    if (input.fullName !== undefined) guest.fullName = input.fullName;
    if (input.phone !== undefined) guest.phone = input.phone;
    if (existing.tenantId && Object.keys(guest).length > 0) {
      await db.tenant.updateMany({ where: { id: existing.tenantId, workspaceId }, data: guest });
    }
    return { tenantId: existing.tenantId, booking };
  }, TX);
  if (result.tenantId && (input.fullName !== undefined || input.phone !== undefined)) await syncClient(result.tenantId);
  return result.booking;
}

const ARRIVAL_ALREADY_PROCESSED = () =>
  new BookingError("Bu bron bo‘yicha kelish allaqachon belgilangan", 409, "ARRIVAL_ALREADY_PROCESSED");

/**
 * Locks room then booking (same order as booking edits) and re-reads the booking under the lock,
 * so parallel "Keldi" / "Kelmadi" calls on one booking are serialized and only the first wins.
 */
async function lockBookingForArrival(db: GuestDb, workspaceId: string, bookingId: string) {
  const peek = await db.booking.findFirst({ where: { id: bookingId, workspaceId }, select: { propertyId: true } });
  if (!peek) throw new BookingError("Bron topilmadi", 404, "NOT_FOUND");
  await db.$queryRaw`SELECT id FROM properties WHERE id = ${peek.propertyId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  await db.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  const booking = await db.booking.findFirst({ where: { id: bookingId, workspaceId } });
  if (!booking) throw new BookingError("Bron topilmadi", 404, "NOT_FOUND");
  if (booking.arrivalStatus !== "EXPECTED") throw ARRIVAL_ALREADY_PROCESSED();
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw new BookingError("Yakunlangan yoki bekor qilingan bronni o‘zgartirib bo‘lmaydi", 409, "BOOKING_CLOSED");
  }
  return booking;
}

/** Same-workspace guest with the same phone; never matched by name alone or across workspaces. */
async function findGuestByPhone(db: GuestDb, workspaceId: string, phone: string | null) {
  const key = phoneKey(phone);
  if (!key) return null;
  const candidates = await db.tenant.findMany({ where: { workspaceId }, select: { id: true, phone: true } });
  return candidates.find((t) => phoneKey(t.phone) === key)?.id ?? null;
}

/**
 * "Keldi": links (or creates) the guest record, checks the stay in and records real money taken
 * at arrival, all in one transaction. The plan quota is used only when a new guest is created.
 */
export async function recordArrival(
  ctx: WorkspaceContext,
  bookingId: string,
  input: ArrivalInput,
  opts: { canPay: boolean; now?: Date }
) {
  const now = opts.now ?? new Date();
  if (input.paymentAmount > 0 && !opts.canPay) {
    throw new BookingError("To‘lov kiritishga ruxsatingiz yo‘q", 403, "FORBIDDEN");
  }
  const workspaceId = ctx.workspace.id;
  const result = await prisma.$transaction(async (db) => {
    const assertQuota = await lockPlanQuota(db, ctx);
    const booking = await lockBookingForArrival(db, workspaceId, bookingId);
    const property = await db.property.findFirst({
      where: { id: booking.propertyId, workspaceId },
      select: { status: true },
    });
    if (!property) throw new BookingError("Xona yoki obyekt topilmadi", 404, "PROPERTY_NOT_FOUND");
    if (property.status === "MAINTENANCE") {
      throw new BookingError("Xona ta’mirda. Avval boshqa xonaga ko‘chiring.", 409, "PROPERTY_NOT_BOOKABLE");
    }

    let tenantId = booking.tenantId ?? (await findGuestByPhone(db, workspaceId, booking.guestPhone));
    let guestCreated = false;
    if (!tenantId) {
      await assertQuota("tenants");
      const tenant = await db.tenant.create({
        data: {
          workspaceId,
          fullName: booking.guestName,
          phone: booking.guestPhone ?? "",
          passport: "",
          rentAmount: 0,
        },
        select: { id: true },
      });
      tenantId = tenant.id;
      guestCreated = true;
    }

    if (booking.status === "PENDING") {
      await updateBooking(db, workspaceId, bookingId, { status: "CONFIRMED" }, now);
    }
    const checkedIn = await updateBooking(
      db,
      workspaceId,
      bookingId,
      { tenantId, guestName: booking.guestName, guestPhone: booking.guestPhone, status: "CHECKED_IN" },
      now
    );

    let payment;
    if (input.paymentAmount > 0) {
      const paid = await createSourcePayment(
        db,
        workspaceId,
        "BOOKING",
        { sourceId: bookingId, sourceType: "BOOKING", amount: input.paymentAmount, paymentMethod: input.paymentMethod, notes: null },
        now
      );
      payment = paid.summary;
    } else {
      const agg = await db.sourcePayment.aggregate({ where: { workspaceId, bookingId }, _sum: { amount: true } });
      payment = getPaymentSummary(checkedIn.totalAmount, agg._sum.amount ?? 0);
    }
    return { booking: checkedIn, tenantId, guestCreated, payment };
  }, TX);
  if (result.guestCreated) await syncClient(result.tenantId);
  return result;
}

/** "Kelmadi": the reservation is cancelled as a no-show. No guest, no payment; history stays. */
export async function recordNoShow(workspaceId: string, bookingId: string, now = new Date()) {
  return prisma.$transaction(async (db) => {
    const booking = await lockBookingForArrival(db, workspaceId, bookingId);
    if (fromStoredDate(booking.checkInDate) > tashkentToday(now)) {
      throw new BookingError("Kelish kuni hali kelmagan. Bronni «Bronlar» bo‘limida bekor qiling.", 409, "NO_SHOW_TOO_EARLY");
    }
    await db.booking.updateMany({
      where: { id: bookingId, workspaceId },
      data: { status: "CANCELLED", arrivalStatus: "NO_SHOW" },
    });
    return getBooking(db, workspaceId, bookingId);
  }, TX);
}

/** Fixed query count. Totals come from bookings; paid comes only from real source payments. */
export async function listHotelGuests(db: GuestDb, workspaceId: string): Promise<HotelGuestList> {
  const [bookings, sums, unplaced] = await Promise.all([
    db.booking.findMany({
      where: { workspaceId },
      orderBy: { checkInDate: "desc" },
      include: {
        property: { select: { title: true } },
        tenant: { select: { fullName: true, phone: true, clientNumber: true } },
      },
    }),
    db.sourcePayment.groupBy({
      by: ["bookingId"],
      where: { workspaceId, sourceType: "BOOKING", bookingId: { not: null } },
      _sum: { amount: true },
      _max: { paymentDate: true },
      _count: { _all: true },
    }),
    db.tenant.findMany({
      where: { workspaceId, leftAt: null, bookings: { none: {} } },
      orderBy: { createdAt: "desc" },
      select: { id: true, fullName: true, phone: true, clientNumber: true },
    }),
  ]);
  const byBooking = new Map(sums.map((s) => [s.bookingId, s]));
  return {
    rows: bookings.map((b) => {
      const s = byBooking.get(b.id);
      const summary = getPaymentSummary(b.totalAmount, s?._sum.amount ?? 0);
      return {
        bookingId: b.id,
        tenantId: b.tenantId,
        arrivalStatus: b.arrivalStatus,
        fullName: b.guestName || b.tenant?.fullName || "—",
        phone: b.guestPhone || b.tenant?.phone || "",
        clientNumber: b.tenant?.clientNumber ?? null,
        propertyId: b.propertyId,
        propertyName: b.property?.title ?? "—",
        guestCount: b.guestCount,
        checkInDate: fromStoredDate(b.checkInDate),
        checkOutDate: fromStoredDate(b.checkOutDate),
        nights: b.nights,
        nightlyRate: b.nightlyRate,
        totalAmount: b.totalAmount,
        status: b.status,
        notes: b.notes,
        paid: summary.paid,
        remaining: summary.remaining,
        paymentStatus: summary.status,
        paymentCount: s?._count._all ?? 0,
        lastPaymentDate: s?._max.paymentDate ? new Date(s._max.paymentDate).toISOString() : null,
      };
    }),
    unplaced: unplaced.map((t) => ({ tenantId: t.id, fullName: t.fullName, phone: t.phone, clientNumber: t.clientNumber })),
  };
}
