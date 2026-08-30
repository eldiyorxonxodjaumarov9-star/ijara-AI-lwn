import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { mapExpenseCategoryForRecurring } from "@/lib/recurring-expense";
import { MONTHLY_EXPENSE_TYPE_CATEGORY } from "@/lib/constants";
import type { MonthlyExpenseType } from "@/types";

function parseMonthlyType(body: Record<string, unknown>) {
  const raw = body.monthlyType ?? body.monthlyExpenseType;
  if (raw == null || raw === "") return { monthlyType: null as string | null, custom: null as string | null };
  const monthlyType = String(raw).toUpperCase();
  const customRaw = body.monthlyTypeCustom ?? body.monthlyExpenseCustomName;
  const custom =
    monthlyType === "CUSTOM" && customRaw
      ? String(customRaw).trim() || null
      : null;
  return { monthlyType, custom };
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { page, limit, skip, search, sortBy, order } = parsePagination(
    new URL(req.url)
  );
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { notes: { contains: search, mode: "insensitive" as const } },
          {
            monthlyTypeCustom: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : {};

  const allowed = new Set(["createdAt", "name", "amount", "updatedAt", "firstPaymentDate"]);
  const sortField = allowed.has(sortBy) ? sortBy : "createdAt";

  const [data, total] = await Promise.all([
    prisma.recurringExpense.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: order },
      include: { company: true },
    }),
    prisma.recurringExpense.count({ where }),
  ]);

  return ok(paginated(data, total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!name) return fail("Xarajat nomini kiriting", 400);
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Summani kiriting", 400);
    }
    const firstPaymentDate = body.firstPaymentDate
      ? new Date(String(body.firstPaymentDate))
      : null;
    if (!firstPaymentDate || Number.isNaN(firstPaymentDate.getTime())) {
      return fail("Birinchi to'lov sanasini tanlang", 400);
    }

    const { monthlyType, custom } = parseMonthlyType(body);
    if (!monthlyType) return fail("Oylik xarajat turini tanlang", 400);
    if (monthlyType === "CUSTOM" && !custom) {
      return fail("Xarajat nomini kiriting", 400);
    }

    const frontendType = monthlyType.toLowerCase() as MonthlyExpenseType;
    const category =
      (body.category
        ? String(body.category).toUpperCase()
        : undefined) ??
      MONTHLY_EXPENSE_TYPE_CATEGORY[frontendType]?.toUpperCase() ??
      mapExpenseCategoryForRecurring(frontendType).toUpperCase();

    const interval = String(body.interval ?? "MONTHLY").toUpperCase();

    const created = await prisma.recurringExpense.create({
      data: {
        name,
        amount,
        category: category as never,
        monthlyType: monthlyType as never,
        monthlyTypeCustom: custom,
        notes: body.notes ? String(body.notes) : undefined,
        firstPaymentDate,
        interval: interval as never,
        active: body.active == null ? true : Boolean(body.active),
        companyId:
          body.companyId != null && body.companyId !== ""
            ? String(body.companyId)
            : undefined,
      },
      include: { company: true },
    });
    return ok(created, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Saqlash xatosi";
    return fail(message, 500);
  }
}
