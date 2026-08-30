import { resolveMonthlyExpenseLabel } from "@/lib/monthly-expense-type";
import {
  buildMonthlyRecurringPlan,
  mapExpenseCategoryForRecurring,
  mapRecurringIntervalFromApi,
} from "@/lib/recurring-expense";
import { prisma } from "@/lib/api-server/prisma";
import type { Expense, RecurringExpense } from "@/types";

function monthlyTypeFromDb(v: unknown) {
  if (v == null || v === "") return undefined;
  return String(v).toLowerCase() as RecurringExpense["monthlyExpenseType"];
}

function mapSchedule(row: {
  id: string;
  name: string;
  amount: number;
  category: unknown;
  monthlyType: unknown;
  monthlyTypeCustom: string | null;
  notes: string | null;
  firstPaymentDate: Date;
  interval: unknown;
  active: boolean;
  companyId: string | null;
  createdAt: Date;
  company?: { name: string } | null;
}): RecurringExpense {
  const monthlyExpenseType = monthlyTypeFromDb(row.monthlyType);
  const monthlyExpenseCustomName = row.monthlyTypeCustom ?? undefined;
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    category: String(row.category ?? "OTHER").toLowerCase() as RecurringExpense["category"],
    monthlyExpenseType,
    monthlyExpenseCustomName,
    monthlyExpenseLabel: resolveMonthlyExpenseLabel(
      monthlyExpenseType,
      monthlyExpenseCustomName
    ),
    notes: row.notes ?? undefined,
    firstPaymentDate: row.firstPaymentDate.toISOString().slice(0, 10),
    interval: mapRecurringIntervalFromApi(row.interval),
    active: row.active,
    companyId: row.companyId,
    companyName: row.company?.name,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapExpenseRow(row: {
  id: string;
  amount: number;
  category: unknown;
  date: Date;
  notes: string | null;
  source: unknown;
  recurringExpenseId: string | null;
  paymentPeriodKey: string | null;
  createdAt: Date;
}): Expense {
  return {
    id: row.id,
    amount: row.amount,
    category: String(row.category ?? "OTHER").toLowerCase() as Expense["category"],
    date: row.date.toISOString(),
    note: row.notes ?? undefined,
    source:
      String(row.source ?? "MANUAL").toUpperCase() === "RECURRING_EXPENSE"
        ? "recurring_expense"
        : "manual",
    recurringExpenseId: row.recurringExpenseId,
    paymentPeriodKey: row.paymentPeriodKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadRecurringPlan(year: number, month: number) {
  const [schedules, expenses] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: { active: true },
      include: { company: true },
      orderBy: { name: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        OR: [
          { source: "RECURRING_EXPENSE" },
          { recurringExpenseId: { not: null } },
        ],
      },
    }),
  ]);

  return buildMonthlyRecurringPlan(
    schedules.map(mapSchedule),
    expenses.map(mapExpenseRow),
    year,
    month
  );
}

export { mapExpenseCategoryForRecurring, mapSchedule };
