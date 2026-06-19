import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const item = await prisma.property.findUnique({
    where: { id },
    include: { contracts: true, maintenances: true },
  });
  if (!item) return fail("Mulk topilmadi", 404);
  return ok(item);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data: Prisma.PropertyUpdateInput = {
      ...(body.title != null || body.name != null
        ? { title: String(body.title ?? body.name) }
        : {}),
      ...(body.address != null ? { address: String(body.address) } : {}),
      ...(body.region != null ? { region: String(body.region) } : {}),
      ...(body.district != null ? { district: String(body.district) } : {}),
      ...(body.building != null
        ? { building: String(body.building) || null }
        : {}),
      ...(body.rentPrice != null || body.price != null
        ? { rentPrice: Number(body.rentPrice ?? body.price) }
        : {}),
      ...(body.rooms != null ? { rooms: Number(body.rooms) } : {}),
      ...(body.area != null ? { area: Number(body.area) } : {}),
      ...(body.description != null
        ? { description: String(body.description) }
        : {}),
      ...(body.status != null
        ? { status: body.status as Prisma.PropertyUpdateInput["status"] }
        : {}),
      ...(body.images != null ? { images: body.images as string[] } : {}),
    };
    const updated = await prisma.property.update({ where: { id }, data });
    return ok(updated);
  } catch {
    return fail("Yangilash xatosi", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    await prisma.property.delete({ where: { id } });
    return ok({ message: "Mulk o'chirildi" });
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
