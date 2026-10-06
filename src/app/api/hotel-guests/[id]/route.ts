import { NextRequest } from "next/server";

import { bookingErrorResponse } from "@/lib/api-server/bookings";
import { requireHotelGuestWorkspace, updateHotelGuest } from "@/lib/api-server/hotel-guests";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { parseHotelGuestUpdate } from "@/lib/hotel-guests";

type Ctx = { params: Promise<{ id: string }> };

/** `id` is the booking id: a guest row is one stay. Status changes (check-in/out) use /api/bookings. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireHotelGuestWorkspace(req, "PATCH");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseHotelGuestUpdate(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");

  try {
    return ok(await updateHotelGuest(guard.ctx.workspace.id, id, parsed.data));
  } catch (err) {
    return bookingErrorResponse(err) ?? fail("Yangilash xatosi", 500);
  }
}
