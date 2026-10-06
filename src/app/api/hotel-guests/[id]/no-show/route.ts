import { NextRequest } from "next/server";

import { recordActivity } from "@/lib/api-server/activity-events";
import { bookingErrorResponse } from "@/lib/api-server/bookings";
import { recordNoShow, requireHotelGuestWorkspace } from "@/lib/api-server/hotel-guests";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** "Kelmadi" for booking `id`: cancelled as a no-show; no guest record, no payment. */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireHotelGuestWorkspace(req, "POST");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  try {
    const result = await recordNoShow(guard.ctx.workspace.id, id);
    await recordActivity({
      workspaceId: guard.ctx.workspace.id,
      userId: guard.user.id,
      action: "BOOKING_NO_SHOW",
      entityType: "Booking",
      entityId: id,
    });
    return ok(result);
  } catch (err) {
    return bookingErrorResponse(err) ?? fail("Saqlash xatosi", 500);
  }
}
