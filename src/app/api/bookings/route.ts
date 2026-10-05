import { NextRequest } from "next/server";

import { bookingErrorResponse, createBooking, listBookings, requireBookingWorkspace } from "@/lib/api-server/bookings";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { parseBookingInput } from "@/lib/bookings";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireBookingWorkspace(req, "GET");
  if (guard.error) return guard.error;
  return ok(await listBookings(prisma, guard.ctx.workspace.id));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireBookingWorkspace(req, "POST");
  if (guard.error) return guard.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseBookingInput(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");
  const input = parsed.data;
  const workspaceId = guard.ctx.workspace.id;

  try {
    const created = await prisma.$transaction((tx) => createBooking(tx, workspaceId, input), {
      timeout: 15_000,
    });
    return ok(created, 201);
  } catch (err) {
    return bookingErrorResponse(err) ?? fail("Saqlash xatosi", 500);
  }
}
