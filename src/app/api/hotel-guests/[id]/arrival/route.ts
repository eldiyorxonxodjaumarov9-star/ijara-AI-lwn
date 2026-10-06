import { NextRequest } from "next/server";

import { bookingErrorResponse } from "@/lib/api-server/bookings";
import { canRecordGuestPayment, recordArrival, requireHotelGuestWorkspace } from "@/lib/api-server/hotel-guests";
import { fail, ok } from "@/lib/api-server/http";
import { planErrorResponse } from "@/lib/api-server/plan-service";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { sourcePaymentErrorResponse } from "@/lib/api-server/source-payments";
import { parseArrivalInput } from "@/lib/hotel-guests";

type Ctx = { params: Promise<{ id: string }> };

/** "Keldi" for booking `id`: guest record + CHECKED_IN + optional real payment, in one transaction. */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireHotelGuestWorkspace(req, "POST");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseArrivalInput(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");

  try {
    const result = await recordArrival(guard.ctx, id, parsed.data, { canPay: canRecordGuestPayment(guard.user) });
    return ok(result);
  } catch (err) {
    return (
      bookingErrorResponse(err) ??
      sourcePaymentErrorResponse(err) ??
      planErrorResponse(err) ??
      fail("Saqlash xatosi", 500)
    );
  }
}
