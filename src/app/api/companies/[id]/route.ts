import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

function assertStaffRole(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const item = await prisma.partnerCompany.findUnique({ where: { id } });
  if (!item) return fail("Kompaniya topilmadi", 404);
  return ok(item);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!assertStaffRole(auth.user.role)) {
    return fail("Ruxsat yo'q", 403);
  }

  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.phone !== undefined) {
      data.phone = body.phone ? String(body.phone) : null;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes) : null;
    }
    if (body.active != null) data.active = Boolean(body.active);

    const updated = await prisma.partnerCompany.update({
      where: { id },
      data: data as never,
    });
    return ok(updated);
  } catch {
    return fail("Yangilash xatosi", 500);
  }
}
