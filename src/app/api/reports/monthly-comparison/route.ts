import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { MAPPERS } from "@/lib/api/mappers";
import {
  buildMonthlyComparison,
  parseYearMonth,
  tashkentMonthBounds,
} from "@/lib/monthly-comparison";
import type { Expense, Payment } from "@/types";

function assertStaffRole(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

/**
 * GET /api/reports/monthly-comparison?baseMonth=2026-07&compareMonth=2026-08
 * Read-only. Production bazaga yozmaydi.
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!assertStaffRole(auth.user.role)) {
    return fail("Ruxsat yo'q", 403);
  }

  const url = new URL(req.url);
  const baseRaw = url.searchParams.get("baseMonth") ?? "";
  const compareRaw = url.searchParams.get("compareMonth") ?? "";
  const baseMonth = parseYearMonth(baseRaw);
  const compareMonth = parseYearMonth(compareRaw);

  if (!baseMonth || !compareMonth) {
    return fail(
      "baseMonth va compareMonth YYYY-MM formatida bo'lishi kerak (masalan: 2026-07)",
      400
    );
  }

  const baseBounds = tashkentMonthBounds(baseMonth);
  const compareBounds = tashkentMonthBounds(compareMonth);
  const rangeStart =
    baseBounds.startInclusive < compareBounds.startInclusive
      ? baseBounds.startInclusive
      : compareBounds.startInclusive;
  const rangeEnd =
    baseBounds.endExclusive > compareBounds.endExclusive
      ? baseBounds.endExclusive
      : compareBounds.endExclusive;

  const [paymentRows, expenseRows] = await Promise.all([
    prisma.payment.findMany({
      where: {
        OR: [
          {
            AND: [
              { periodYear: baseMonth.year },
              { periodMonth: baseMonth.month },
            ],
          },
          {
            AND: [
              { periodYear: compareMonth.year },
              { periodMonth: compareMonth.month },
            ],
          },
          {
            AND: [
              { periodYear: null },
              {
                paymentDate: {
                  gte: new Date(rangeStart),
                  lt: new Date(rangeEnd),
                },
              },
            ],
          },
        ],
      },
      include: { contract: { include: { property: true, tenant: true } } },
    }),
    prisma.expense.findMany({
      where: {
        date: {
          gte: new Date(rangeStart),
          lt: new Date(rangeEnd),
        },
      },
      include: { employee: { include: { company: true } } },
    }),
  ]);

  const paymentMapper = MAPPERS.payments;
  const expenseMapper = MAPPERS.expenses;
  if (!paymentMapper || !expenseMapper) {
    return fail("Hisobot mapper sozlanmagan", 500);
  }

  const payments = paymentRows.map(
    (row) =>
      paymentMapper.fromApi(row as unknown as Record<string, unknown>) as Payment
  );
  const expenses = expenseRows.map(
    (row) =>
      expenseMapper.fromApi(row as unknown as Record<string, unknown>) as Expense
  );

  const result = buildMonthlyComparison({
    payments,
    expenses,
    baseMonth,
    compareMonth,
  });

  return ok(result);
}
