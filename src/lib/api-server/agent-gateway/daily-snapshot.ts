import { MAPPERS } from "@/lib/api/mappers";
import { getAdminDashboardRows } from "@/lib/api-server/telegram-admin";
import { prisma } from "@/lib/api-server/prisma";
import {
  buildMonthlyComparison,
  parseYearMonth,
  tashkentMonthBounds,
  type YearMonth,
} from "@/lib/monthly-comparison";
import { occupancyRate } from "@/lib/occupancy";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import type { Expense, Payment } from "@/types";

export type DailySnapshot = {
  date: string;
  timezone: "Asia/Tashkent";
  payments: {
    dueTodayCount: number;
    overdueCount: number;
    totalDebt: number;
    items: Array<{
      tenantId: string;
      fullName: string;
      room: string;
      debtAmount: number;
      overdueDays: number;
      daysLeft: number | null;
      hasDebt: boolean;
      isDueSoon: boolean;
    }>;
  };
  occupancy: {
    occupied: number;
    vacant: number;
    total: number;
    rate: number;
  };
  comparison: {
    currentMonth: string;
    compareToMonth: string;
    income: {
      current: number;
      previous: number;
      difference: number;
      percent: number | null;
    };
    expenses: {
      current: number;
      previous: number;
      difference: number;
      percent: number | null;
    };
  };
  expenseHighlights: Array<{
    type: string;
    label: string;
    current: number;
    previous: number;
    difference: number;
    percent: number | null;
  }>;
};

function ymKey(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function percentOrNull(previous: number, difference: number): number | null {
  if (previous === 0) return null;
  return Math.round((difference / previous) * 10000) / 100;
}

export async function buildDailySnapshot(
  now = new Date()
): Promise<DailySnapshot> {
  const parts = getTashkentDateParts(now);
  const date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const currentMonth: YearMonth = { year: parts.year, month: parts.month };
  const previousMonth = shiftMonth(currentMonth, -1);

  const rows = await getAdminDashboardRows();
  const overdue = rows.filter((r) => r.hasDebt && r.overdueDays > 0);
  const dueTodayCount = rows.filter((r) => r.daysLeft === 0 && !r.hasDebt).length;
  const overdueCount = overdue.length;
  const totalDebt = rows.reduce((s, r) => s + (r.hasDebt ? r.debtAmount : 0), 0);

  const [occupied, vacant, totalRooms] = await Promise.all([
    prisma.property.count({ where: { status: "RENTED" } }),
    prisma.property.count({ where: { status: "AVAILABLE" } }),
    prisma.property.count(),
  ]);

  const baseRaw = ymKey(previousMonth);
  const compareRaw = ymKey(currentMonth);
  const baseMonth = parseYearMonth(baseRaw)!;
  const compareMonth = parseYearMonth(compareRaw)!;
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

  const paymentMapper = MAPPERS.payments!;
  const expenseMapper = MAPPERS.expenses!;
  const payments = paymentRows.map(
    (row) =>
      paymentMapper.fromApi(row as unknown as Record<string, unknown>) as Payment
  );
  const expenses = expenseRows.map(
    (row) =>
      expenseMapper.fromApi(row as unknown as Record<string, unknown>) as Expense
  );

  const comparison = buildMonthlyComparison({
    payments,
    expenses,
    baseMonth,
    compareMonth,
  });

  const incomePrev = comparison.income.base;
  const incomeCurr = comparison.income.compare;
  const incomeDiff = comparison.income.diff;
  const expPrev = comparison.expense.base;
  const expCurr = comparison.expense.compare;
  const expDiff = comparison.expense.diff;

  const expenseHighlights = comparison.topIncreases
    .slice(0, 5)
    .map((row) => ({
      type: row.key,
      label: row.label,
      current: row.compareAmount,
      previous: row.baseAmount,
      difference: row.diff,
      percent: row.percent.percent,
    }));

  return {
    date,
    timezone: "Asia/Tashkent",
    payments: {
      dueTodayCount,
      overdueCount,
      totalDebt,
      items: rows
        .filter((r) => r.hasDebt || r.isDueSoon || r.daysLeft === 0)
        .slice(0, 50)
        .map((r) => ({
          tenantId: r.id,
          fullName: r.fullName,
          room: r.room,
          debtAmount: r.debtAmount,
          overdueDays: r.overdueDays,
          daysLeft: r.daysLeft,
          hasDebt: r.hasDebt,
          isDueSoon: r.isDueSoon,
        })),
    },
    occupancy: {
      occupied,
      vacant,
      total: totalRooms,
      rate: occupancyRate({ totalRooms, occupiedRooms: occupied }),
    },
    comparison: {
      currentMonth: compareRaw,
      compareToMonth: baseRaw,
      income: {
        current: incomeCurr,
        previous: incomePrev,
        difference: incomeDiff,
        percent: percentOrNull(incomePrev, incomeDiff),
      },
      expenses: {
        current: expCurr,
        previous: expPrev,
        difference: expDiff,
        percent: percentOrNull(expPrev, expDiff),
      },
    },
    expenseHighlights,
  };
}

export function dailyReportIdempotencyKey(date: string): string {
  return `daily-manager-report:${date}`;
}
