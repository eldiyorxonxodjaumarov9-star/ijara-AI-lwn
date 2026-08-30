import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  monthOccurrenceDueDate,
  parsePaymentPeriodKey,
  paymentPeriodKey,
} from "@/lib/recurring-expense";
import { resolveMonthlyExpenseLabel } from "@/lib/monthly-expense-type";
import { formatTashkentDate } from "@/lib/payment-due-schedule";
import type { MonthlyExpenseType, RecurrenceInterval } from "@/types";
import { mapRecurringIntervalFromApi } from "@/lib/recurring-expense";

/**
 * Occurrence to'lash — Expense yaratadi (idempotent unique).
 * Body: recurringExpenseId, paymentPeriodKey, amount?, date?, notes?
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const recurringExpenseId = String(body.recurringExpenseId ?? "").trim();
    const periodKey = String(body.paymentPeriodKey ?? "").trim();
    if (!recurringExpenseId) return fail("recurringExpenseId kerak", 400);
    const period = parsePaymentPeriodKey(periodKey);
    if (!period) return fail("paymentPeriodKey YYYY-MM formatida bo'lsin", 400);

    const schedule = await prisma.recurringExpense.findUnique({
      where: { id: recurringExpenseId },
    });
    if (!schedule) return fail("Doimiy xarajat topilmadi", 404);
    if (!schedule.active) return fail("Schedule nofaol", 400);

    const interval = mapRecurringIntervalFromApi(schedule.interval);
    const due = monthOccurrenceDueDate(
      schedule.firstPaymentDate,
      interval as RecurrenceInterval,
      period.year,
      period.month
    );
    if (!due) {
      return fail("Bu oyda ushbu schedule uchun occurrence yo'q", 400);
    }

    const existing = await prisma.expense.findFirst({
      where: {
        recurringExpenseId,
        paymentPeriodKey: periodKey,
        source: "RECURRING_EXPENSE",
      },
    });
    if (existing) {
      return ok({ expense: existing, alreadyPaid: true });
    }

    const amount =
      body.amount != null ? Number(body.amount) : schedule.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Summani kiriting", 400);
    }

    const payDate = body.date
      ? new Date(String(body.date))
      : new Date(`${formatTashkentDate(due)}T12:00:00+05:00`);
    if (Number.isNaN(payDate.getTime())) return fail("Sana noto'g'ri", 400);

    const typeLabel =
      resolveMonthlyExpenseLabel(
        schedule.monthlyType
          ? (String(schedule.monthlyType).toLowerCase() as MonthlyExpenseType)
          : null,
        schedule.monthlyTypeCustom
      ) ?? schedule.name;

    const title = `${schedule.name}${typeLabel && typeLabel !== schedule.name ? ` — ${typeLabel}` : ""}`;
    const notes =
      body.notes != null
        ? String(body.notes)
        : schedule.notes ?? undefined;

    try {
      const expense = await prisma.$transaction(async (tx) => {
        const again = await tx.expense.findFirst({
          where: {
            recurringExpenseId,
            paymentPeriodKey: periodKey,
            source: "RECURRING_EXPENSE",
          },
        });
        if (again) return again;

        return tx.expense.create({
          data: {
            title,
            amount,
            category: schedule.category,
            date: payDate,
            notes,
            monthlyType: schedule.monthlyType,
            monthlyTypeCustom: schedule.monthlyTypeCustom,
            source: "RECURRING_EXPENSE",
            recurringExpenseId,
            paymentPeriodKey: periodKey,
            plannedDueDate: new Date(
              `${formatTashkentDate(due)}T12:00:00+05:00`
            ),
          },
          include: { employee: { include: { company: true } } },
        });
      });

      return ok({
        expense,
        alreadyPaid: false,
        paymentPeriodKey: paymentPeriodKey(period.year, period.month),
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const dup = await prisma.expense.findFirst({
          where: {
            recurringExpenseId,
            paymentPeriodKey: periodKey,
          },
        });
        if (dup) return ok({ expense: dup, alreadyPaid: true });
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "To'lash xatosi";
    return fail(message, 500);
  }
}
