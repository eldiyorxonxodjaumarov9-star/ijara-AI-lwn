import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { createWithinPlanLimit } from "@/lib/api-server/plan-service";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { promoteDueRentals } from "@/lib/api-server/vehicle-rentals";
import {
  createVehicle,
  listVehicles,
  reconcileVehicleStatuses,
  requireVehicleWorkspace,
  vehicleErrorResponse,
} from "@/lib/api-server/vehicles";
import { parseVehicleInput } from "@/lib/vehicles";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "GET");
  if (guard.error) return guard.error;
  await promoteDueRentals(prisma, guard.ctx.workspace.id);
  await reconcileVehicleStatuses(prisma, guard.ctx.workspace.id);
  return ok(await listVehicles(prisma, guard.ctx.workspace.id));
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
  const parsed = parseVehicleInput(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");
  const input = parsed.data;

  const workspaceId = guard.ctx.workspace.id;
  try {
    const created = await createWithinPlanLimit(guard.ctx, "vehicles", (db) =>
      createVehicle(db, workspaceId, input)
    );
    return ok(created, 201);
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("Saqlash xatosi", 500);
  }
}
