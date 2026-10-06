import type { Prisma, User } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";

import { fromStoredDate, tashkentToday, type BookingUpdateInput } from "@/lib/bookings";
import {
  initialGuestStatus,
  isHotelGuestIndustry,
  type HotelGuestInput,
  type HotelGuestList,
  type HotelGuestUpdate,
} from "@/lib/hotel-guests";
import { getPaymentSummary } from "@/lib/source-payments";

import { BookingError, createBooking, updateBooking } from "./bookings";
import { ensureTenantClientNumber } from "./client-number";
import { upsertClientFromTenant } from "./clients";
import { fail } from "./http";
import { createWithinPlanLimit } from "./plan-service";
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
      let booking = await createBooking(db, workspaceId, {
        propertyId: input.propertyId,
        tenantId: tenant.id,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        nightlyRate: input.nightlyRate,
        guestCount: input.guestCount,
        status: "CONFIRMED",
        notes: input.notes,
      });
      if (status.data === "CHECKED_IN") {
        booking = await updateBooking(db, workspaceId, booking.id, { status: "CHECKED_IN" }, now);
      }
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
    const booking = await updateBooking(db, workspaceId, bookingId, bookingInput, now);
    const guest: Prisma.TenantUpdateManyMutationInput = {};
    if (input.fullName !== undefined) guest.fullName = input.fullName;
    if (input.phone !== undefined) guest.phone = input.phone;
    if (Object.keys(guest).length > 0) {
      await db.tenant.updateMany({ where: { id: existing.tenantId, workspaceId }, data: guest });
    }
    return { tenantId: existing.tenantId, booking };
  }, TX);
  if (input.fullName !== undefined || input.phone !== undefined) await syncClient(result.tenantId);
  return result.booking;
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
        fullName: b.tenant?.fullName ?? "—",
        phone: b.tenant?.phone ?? "",
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
