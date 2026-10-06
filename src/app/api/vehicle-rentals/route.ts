import { NextRequest } from "next/server";

import { recordActivity } from "@/lib/api-server/activity-events";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { createRental, listRentals, promoteDueRentals } from "@/lib/api-server/vehicle-rentals";
import { requireVehicleWorkspace, vehicleErrorResponse } from "@/lib/api-server/vehicles";
import { parseRentalInput } from "@/lib/vehicle-rentals";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "GET");
  if (guard.error) return guard.error;
  const workspaceId = guard.ctx.workspace.id;
  await promoteDueRentals(prisma, workspaceId);
  return ok(await listRentals(prisma, workspaceId));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "POST");
  if (guard.error) return guard.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseRentalInput(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");
  const input = parsed.data;
  const workspaceId = guard.ctx.workspace.id;

  try {
    const created = await prisma.$transaction((tx) => createRental(tx, workspaceId, input), {
      timeout: 15_000,
    });
    await recordActivity({
      workspaceId,
      userId: guard.user.id,
      action: "VEHICLE_RENTAL_CREATE",
      entityType: "VehicleRental",
      entityId: created.id,
    });
    return ok(created, 201);
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("Saqlash xatosi", 500);
  }
}
