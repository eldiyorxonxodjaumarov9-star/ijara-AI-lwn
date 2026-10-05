import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { sourcePaymentHistoryResponse } from "@/lib/api-server/source-payments";
import { deleteRental, getRental, updateRental } from "@/lib/api-server/vehicle-rentals";
import { requireVehicleWorkspace, vehicleErrorResponse } from "@/lib/api-server/vehicles";
import { parseRentalUpdate } from "@/lib/vehicle-rentals";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "GET");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  try {
    return ok(await getRental(prisma, guard.ctx.workspace.id, id));
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("Yuklash xatosi", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "PATCH");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseRentalUpdate(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");
  const input = parsed.data;
  const workspaceId = guard.ctx.workspace.id;

  try {
    const updated = await prisma.$transaction((tx) => updateRental(tx, workspaceId, id, input), {
      timeout: 15_000,
    });
    return ok(updated);
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("Yangilash xatosi", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "DELETE");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const workspaceId = guard.ctx.workspace.id;
  const history = await sourcePaymentHistoryResponse(prisma, { vehicleRentalId: id }, workspaceId);
  if (history) return history;
  try {
    const deleted = await prisma.$transaction((tx) => deleteRental(tx, workspaceId, id), {
      timeout: 15_000,
    });
    return ok(deleted);
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("O‘chirish xatosi", 500);
  }
}
