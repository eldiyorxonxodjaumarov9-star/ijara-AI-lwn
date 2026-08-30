import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { MONTHLY_EXPENSE_TYPE_CATEGORY } from "@/lib/constants";
import type { MonthlyExpenseType } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

function parseMonthlyType(body: Record<string, unknown>) {
  if (
    body.monthlyType === undefined &&
    body.monthlyExpenseType === undefined
  ) {
    return undefined;
  }
  const raw = body.monthlyType ?? body.monthlyExpenseType;
  if (raw == null || raw === "") {
    return { monthlyType: null as string | null, custom: null as string | null };
  }
  const monthlyType = String(raw).toUpperCase();
  const customRaw = body.monthlyTypeCustom ?? body.monthlyExpenseCustomName;
  const custom =
    monthlyType === "CUSTOM" && customRaw
      ? String(customRaw).trim() || null
      : monthlyType === "CUSTOM"
        ? null
        : null;
  return { monthlyType, custom };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const item = await prisma.recurringExpense.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!item) return fail("Doimiy xarajat topilmadi", 404);
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

    if (body.name != null) data.name = String(body.name).trim();
    if (body.amount != null) data.amount = Number(body.amount);
    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes) : null;
    }
    if (body.firstPaymentDate != null) {
      data.firstPaymentDate = new Date(String(body.firstPaymentDate));
    }
    if (body.interval != null) {
      data.interval = String(body.interval).toUpperCase();
    }
    if (body.active != null) data.active = Boolean(body.active);
    if (body.companyId !== undefined) {
      data.companyId =
        body.companyId == null || body.companyId === ""
          ? null
          : String(body.companyId);
    }

    const monthly = parseMonthlyType(body);
    if (monthly) {
      data.monthlyType = monthly.monthlyType;
      data.monthlyTypeCustom = monthly.custom;
      if (monthly.monthlyType) {
        const frontendType =
          monthly.monthlyType.toLowerCase() as MonthlyExpenseType;
        data.category =
          (body.category
            ? String(body.category).toUpperCase()
            : undefined) ??
          MONTHLY_EXPENSE_TYPE_CATEGORY[frontendType]?.toUpperCase() ??
          "OTHER";
      }
    } else if (body.category != null) {
      data.category = String(body.category).toUpperCase();
    }

    if (monthly?.monthlyType === "CUSTOM" && !monthly.custom) {
      return fail("Xarajat nomini kiriting", 400);
    }

    const updated = await prisma.recurringExpense.update({
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
    // Soft delete: active=false (haqiqiy Expense yozuvlari saqlanadi)
    const updated = await prisma.recurringExpense.update({
      where: { id },
      data: { active: false },
      include: { company: true },
    });
    return ok(updated);
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
