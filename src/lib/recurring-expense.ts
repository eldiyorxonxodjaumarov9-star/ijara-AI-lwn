import {
  formatTashkentDate,
  getTashkentDateParts,
  type TashkentDateParts,
} from "@/lib/payment-due-schedule";
import { resolveMonthlyExpenseLabel } from "@/lib/monthly-expense-type";
import type {
  Expense,
  ExpenseCategory,
  MonthlyExpenseType,
  RecurrenceInterval,
  RecurringExpense,
  RecurringOccurrence,
  RecurringOccurrenceStatus,
  RecurringPlanSummary,
} from "@/types";

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function recurrenceMonths(interval: RecurrenceInterval): number {
  switch (interval) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semiannual":
      return 6;
    case "yearly":
      return 12;
  }
}

export function paymentPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parsePaymentPeriodKey(key: string): {
  year: number;
  month: number;
} | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Tanlangan oyda occurrence bor-yo‘qligi va to‘lov sanasi (Toshkent).
 * firstPaymentDate kunini oy oxiriga clamp qiladi (31 → 28/29 fev).
 */
export function monthOccurrenceDueDate(
  firstPaymentDate: string | Date,
  interval: RecurrenceInterval,
  year: number,
  month: number
): TashkentDateParts | null {
  const first = getTashkentDateParts(firstPaymentDate);
  if (year < first.year || (year === first.year && month < first.month)) {
    return null;
  }

  const monthsDiff = (year - first.year) * 12 + (month - first.month);
  const step = recurrenceMonths(interval);
  if (monthsDiff % step !== 0) return null;

  const dueDay = Math.min(first.day, daysInMonth(year, month));
  return { year, month, day: dueDay };
}

export function isMonthOccurrencePaid(
  expenses: Array<{
    source?: string | null;
    recurringExpenseId?: string | null;
    paymentPeriodKey?: string | null;
  }>,
  recurringExpenseId: string,
  year: number,
  month: number
): boolean {
  return Boolean(findPaidExpense(expenses, recurringExpenseId, year, month));
}

function findPaidExpense<
  T extends {
    id?: string;
    amount?: number;
    source?: string | null;
    recurringExpenseId?: string | null;
    paymentPeriodKey?: string | null;
  },
>(
  expenses: T[],
  recurringExpenseId: string,
  year: number,
  month: number
): T | undefined {
  const key = paymentPeriodKey(year, month);
  return expenses.find((e) => {
    if (
      e.recurringExpenseId !== recurringExpenseId ||
      e.paymentPeriodKey !== key
    ) {
      return false;
    }
    const source = String(e.source ?? "").toUpperCase();
    // Asosiy: RECURRING_EXPENSE. Legacy: bog'lanish maydonlari bor, source bo'sh.
    return source === "RECURRING_EXPENSE" || source === "";
  });
}

export function findPaidExpenseId(
  expenses: Array<{
    id: string;
    source?: string | null;
    recurringExpenseId?: string | null;
    paymentPeriodKey?: string | null;
  }>,
  recurringExpenseId: string,
  year: number,
  month: number
): string | undefined {
  return findPaidExpense(expenses, recurringExpenseId, year, month)?.id;
}

export function occurrenceStatusForDate(
  due: TashkentDateParts,
  paid: boolean,
  now: Date | TashkentDateParts = new Date()
): RecurringOccurrenceStatus {
  if (paid) return "paid";
  const today =
    now instanceof Date ? getTashkentDateParts(now) : now;
  const dueN = due.year * 10_000 + due.month * 100 + due.day;
  const todayN = today.year * 10_000 + today.month * 100 + today.day;
  if (dueN === todayN) return "due_today";
  if (dueN > todayN) return "pending";
  return "overdue";
}

export const RECURRING_STATUS_LABEL: Record<
  RecurringOccurrenceStatus,
  string
> = {
  paid: "✅ To'langan",
  pending: "⏳ Kutilmoqda",
  overdue: "🔴 Muddati o'tgan",
  due_today: "🟠 Bugun to'lanadi",
};

export function buildMonthlyRecurringPlan(
  schedules: RecurringExpense[],
  expenses: Expense[],
  year: number,
  month: number,
  now: Date = new Date()
): RecurringPlanSummary {
  const occurrences: RecurringOccurrence[] = [];

  for (const schedule of schedules) {
    if (!schedule.active) continue;
    const due = monthOccurrenceDueDate(
      schedule.firstPaymentDate,
      schedule.interval,
      year,
      month
    );
    if (!due) continue;

    const paid = isMonthOccurrencePaid(expenses, schedule.id, year, month);
    const paidExpense = findPaidExpense(expenses, schedule.id, year, month);
    const expenseId = paidExpense?.id;
    const status = occurrenceStatusForDate(due, paid, now);
    const typeLabel =
      resolveMonthlyExpenseLabel(
        schedule.monthlyExpenseType,
        schedule.monthlyExpenseCustomName
      ) ?? undefined;

    occurrences.push({
      recurringExpenseId: schedule.id,
      name: schedule.name,
      category: schedule.category,
      monthlyExpenseType: schedule.monthlyExpenseType,
      monthlyExpenseCustomName: schedule.monthlyExpenseCustomName,
      monthlyExpenseLabel: typeLabel,
      paymentPeriodKey: paymentPeriodKey(year, month),
      dueDate: formatTashkentDate(due),
      amount: schedule.amount,
      paid,
      status,
      expenseId,
      notes: schedule.notes,
      paidAmount: paid
        ? Number(paidExpense?.amount ?? schedule.amount)
        : undefined,
    });
  }

  occurrences.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.name.localeCompare(b.name, "uz");
  });

  const plannedTotal = occurrences.reduce((s, o) => s + o.amount, 0);
  const paidTotal = occurrences
    .filter((o) => o.paid)
    .reduce((s, o) => s + (o.paidAmount ?? o.amount), 0);
  const remainingTotal = occurrences
    .filter((o) => !o.paid)
    .reduce((s, o) => s + o.amount, 0);
  const overdueCount = occurrences.filter((o) => o.status === "overdue").length;

  return {
    year,
    month,
    paymentPeriodKey: paymentPeriodKey(year, month),
    occurrences,
    count: occurrences.length,
    plannedTotal,
    paidTotal,
    remainingTotal,
    overdueCount,
  };
}

export function mapRecurringIntervalFromApi(
  v: unknown
): RecurrenceInterval {
  const key = String(v ?? "MONTHLY").toLowerCase() as RecurrenceInterval;
  if (
    key === "monthly" ||
    key === "quarterly" ||
    key === "semiannual" ||
    key === "yearly"
  ) {
    return key;
  }
  return "monthly";
}

export function mapRecurringIntervalToApi(
  v: RecurrenceInterval
): string {
  return v.toUpperCase();
}

export function mapExpenseCategoryForRecurring(
  monthlyType?: MonthlyExpenseType | null
): ExpenseCategory {
  if (monthlyType === "water" || monthlyType === "electricity") {
    return "utilities";
  }
  if (monthlyType === "office" || monthlyType === "custom") {
    return "other";
  }
  return "other";
}
