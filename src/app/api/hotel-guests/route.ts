import { NextRequest } from "next/server";

import { bookingErrorResponse } from "@/lib/api-server/bookings";
import {
  canRecordGuestPayment,
  createHotelGuest,
  listHotelGuests,
  requireHotelGuestWorkspace,
} from "@/lib/api-server/hotel-guests";
import { fail, ok } from "@/lib/api-server/http";
import { planErrorResponse } from "@/lib/api-server/plan-service";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { sourcePaymentErrorResponse } from "@/lib/api-server/source-payments";
import { parseHotelGuestInput } from "@/lib/hotel-guests";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireHotelGuestWorkspace(req, "GET");
  if (guard.error) return guard.error;
  return ok(await listHotelGuests(prisma, guard.ctx.workspace.id));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireHotelGuestWorkspace(req, "POST");
  if (guard.error) return guard.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseHotelGuestInput(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");

  try {
    const created = await createHotelGuest(guard.ctx, parsed.data, { canPay: canRecordGuestPayment(guard.user) });
    return ok(created, 201);
  } catch (err) {
    return (
      bookingErrorResponse(err) ??
      sourcePaymentErrorResponse(err) ??
      planErrorResponse(err) ??
      fail("Saqlash xatosi", 500)
    );
  }
}
