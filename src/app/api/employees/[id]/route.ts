import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const item = await prisma.employee.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!item) return fail("Ishchi topilmadi", 404);
  return ok(item);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (body.fullName != null) data.fullName = String(body.fullName).trim();
    if (body.phone !== undefined) {
      data.phone = body.phone ? String(body.phone) : null;
    }
    if (body.position !== undefined) {
      data.position = body.position ? String(body.position) : null;
    }
    if (body.monthlySalary != null) {
      data.monthlySalary = Number(body.monthlySalary);
    }
    if (body.salaryPayDay !== undefined) {
      data.salaryPayDay =
        body.salaryPayDay == null || body.salaryPayDay === ""
          ? null
          : Math.min(31, Math.max(1, Number(body.salaryPayDay)));
    }
    if (body.active != null) data.active = Boolean(body.active);
    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes) : null;
    }
    if (body.companyId !== undefined) {
      data.companyId =
        body.companyId == null || body.companyId === ""
          ? null
          : String(body.companyId);
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: data as never,
      include: { company: true },
    });
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
    await prisma.employee.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
