import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  deleteVehicle,
  getVehicle,
  requireVehicleWorkspace,
  updateVehicle,
  vehicleErrorResponse,
} from "@/lib/api-server/vehicles";
import { parseVehicleInput } from "@/lib/vehicles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "GET");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  try {
    return ok(await getVehicle(prisma, guard.ctx.workspace.id, id));
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("Yuklash xatosi", 500);
  }
}

async function update(req: NextRequest, ctx: Ctx, method: "PATCH" | "PUT") {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, method);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed =
    method === "PUT" ? parseVehicleInput(body) : parseVehicleInput(body, { partial: true });
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");

  try {
    return ok(await updateVehicle(prisma, guard.ctx.workspace.id, id, parsed.data));
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("Yangilash xatosi", 500);
  }
}

export function PATCH(req: NextRequest, ctx: Ctx) {
  return update(req, ctx, "PATCH");
}

export function PUT(req: NextRequest, ctx: Ctx) {
  return update(req, ctx, "PUT");
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireVehicleWorkspace(req, "DELETE");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  try {
    return ok(await deleteVehicle(prisma, guard.ctx.workspace.id, id));
  } catch (err) {
    return vehicleErrorResponse(err) ?? fail("O‘chirish xatosi", 500);
  }
}
