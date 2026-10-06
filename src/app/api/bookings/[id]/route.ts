import { NextRequest } from "next/server";

import { recordActivity } from "@/lib/api-server/activity-events";
import {
  bookingErrorResponse,
  deleteBooking,
  getBooking,
  requireBookingWorkspace,
  updateBooking,
} from "@/lib/api-server/bookings";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { sourcePaymentHistoryResponse } from "@/lib/api-server/source-payments";
import { parseBookingUpdate } from "@/lib/bookings";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireBookingWorkspace(req, "GET");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  try {
    return ok(await getBooking(prisma, guard.ctx.workspace.id, id));
  } catch (err) {
    return bookingErrorResponse(err) ?? fail("Yuklash xatosi", 500);
  }
}

async function update(req: NextRequest, ctx: Ctx, method: "PATCH" | "PUT") {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireBookingWorkspace(req, method);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseBookingUpdate(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");
  const input = parsed.data;
  const workspaceId = guard.ctx.workspace.id;

  try {
    const updated = await prisma.$transaction((tx) => updateBooking(tx, workspaceId, id, input), {
      timeout: 15_000,
    });
    // updateBooking rejects closed bookings, so a successful status write is a real transition.
    const action =
      input.status === "CHECKED_OUT" ? "BOOKING_CHECKOUT" : input.status === "CHECKED_IN" ? "BOOKING_ARRIVAL" : null;
    if (action) {
      await recordActivity({ workspaceId, userId: guard.user.id, action, entityType: "Booking", entityId: id });
    }
    return ok(updated);
  } catch (err) {
    return bookingErrorResponse(err) ?? fail("Yangilash xatosi", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return update(req, ctx, "PATCH");
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return update(req, ctx, "PUT");
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireBookingWorkspace(req, "DELETE");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const workspaceId = guard.ctx.workspace.id;
  const history = await sourcePaymentHistoryResponse(prisma, { bookingId: id }, workspaceId);
  if (history) return history;
  try {
    const deleted = await prisma.$transaction((tx) => deleteBooking(tx, workspaceId, id), {
      timeout: 15_000,
    });
    return ok(deleted);
  } catch (err) {
    return bookingErrorResponse(err) ?? fail("O‘chirish xatosi", 500);
  }
}
