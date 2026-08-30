import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMonthlyRecurringPlan,
  daysInMonth,
  isMonthOccurrencePaid,
  monthOccurrenceDueDate,
  occurrenceStatusForDate,
  paymentPeriodKey,
  recurrenceMonths,
} from "./recurring-expense";
import type { Expense, RecurringExpense } from "@/types";

function schedule(
  partial: Partial<RecurringExpense> & Pick<RecurringExpense, "id" | "name" | "firstPaymentDate" | "interval">
): RecurringExpense {
  return {
    amount: 100_000,
    category: "utilities",
    active: true,
    createdAt: "2026-01-01",
    ...partial,
  };
}

describe("recurrenceMonths", () => {
  it("maps intervals", () => {
    assert.equal(recurrenceMonths("monthly"), 1);
    assert.equal(recurrenceMonths("quarterly"), 3);
    assert.equal(recurrenceMonths("semiannual"), 6);
    assert.equal(recurrenceMonths("yearly"), 12);
  });
});

describe("monthOccurrenceDueDate", () => {
  it("creates monthly occurrences", () => {
    const due = monthOccurrenceDueDate("2026-01-15", "monthly", 2026, 8);
    assert.deepEqual(due, { year: 2026, month: 8, day: 15 });
  });

  it("creates quarterly occurrences only on matching months", () => {
    assert.ok(monthOccurrenceDueDate("2026-01-10", "quarterly", 2026, 4));
    assert.equal(monthOccurrenceDueDate("2026-01-10", "quarterly", 2026, 5), null);
  });

  it("creates semiannual and yearly occurrences", () => {
    assert.ok(monthOccurrenceDueDate("2026-03-05", "semiannual", 2026, 9));
    assert.equal(monthOccurrenceDueDate("2026-03-05", "semiannual", 2026, 6), null);
    assert.ok(monthOccurrenceDueDate("2025-08-20", "yearly", 2026, 8));
    assert.equal(monthOccurrenceDueDate("2025-08-20", "yearly", 2026, 7), null);
  });

  it("clamps 31 to February non-leap", () => {
    assert.equal(daysInMonth(2026, 2), 28);
    const due = monthOccurrenceDueDate("2026-01-31", "monthly", 2026, 2);
    assert.deepEqual(due, { year: 2026, month: 2, day: 28 });
  });

  it("clamps 31 to February leap day", () => {
    assert.equal(daysInMonth(2024, 2), 29);
    const due = monthOccurrenceDueDate("2024-01-31", "monthly", 2024, 2);
    assert.deepEqual(due, { year: 2024, month: 2, day: 29 });
  });

  it("skips months before firstPaymentDate", () => {
    assert.equal(monthOccurrenceDueDate("2026-08-15", "monthly", 2026, 7), null);
  });
});

describe("isMonthOccurrencePaid + plan", () => {
  it("keeps paid August occurrence when next due is September", () => {
    const internet = schedule({
      id: "r1",
      name: "Internet",
      firstPaymentDate: "2026-01-15",
      interval: "monthly",
      amount: 200_000,
    });
    const expenses: Expense[] = [
      {
        id: "e1",
        category: "other",
        amount: 200_000,
        date: "2026-08-15",
        source: "recurring_expense",
        recurringExpenseId: "r1",
        paymentPeriodKey: "2026-08",
        createdAt: "2026-08-15",
      },
    ];
    assert.equal(isMonthOccurrencePaid(expenses, "r1", 2026, 8), true);
    assert.equal(isMonthOccurrencePaid(expenses, "r1", 2026, 9), false);

    const august = buildMonthlyRecurringPlan([internet], expenses, 2026, 8);
    assert.equal(august.count, 1);
    assert.equal(august.occurrences[0]?.paid, true);
    assert.equal(august.occurrences[0]?.status, "paid");
    assert.equal(august.paidTotal, 200_000);

    const september = buildMonthlyRecurringPlan([internet], expenses, 2026, 9);
    assert.equal(september.count, 1);
    assert.equal(september.occurrences[0]?.paid, false);
    assert.equal(september.occurrences[0]?.paymentPeriodKey, "2026-09");
  });

  it("does not mix next month into current month", () => {
    const s = schedule({
      id: "r2",
      name: "Suv",
      firstPaymentDate: "2026-01-01",
      interval: "monthly",
    });
    const plan = buildMonthlyRecurringPlan([s], [], 2026, 8);
    assert.equal(plan.occurrences.every((o) => o.paymentPeriodKey === "2026-08"), true);
  });

  it("supports custom monthly type label", () => {
    const s = schedule({
      id: "r3",
      name: "Net",
      firstPaymentDate: "2026-01-01",
      interval: "monthly",
      monthlyExpenseType: "custom",
      monthlyExpenseCustomName: "internet",
      category: "other",
    });
    const plan = buildMonthlyRecurringPlan([s], [], 2026, 8);
    assert.equal(plan.occurrences[0]?.monthlyExpenseLabel, "internet");
  });
});

describe("occurrenceStatusForDate", () => {
  it("classifies paid / pending / overdue / due today", () => {
    const due = { year: 2026, month: 8, day: 15 };
    assert.equal(occurrenceStatusForDate(due, true, due), "paid");
    assert.equal(
      occurrenceStatusForDate(due, false, { year: 2026, month: 8, day: 10 }),
      "pending"
    );
    assert.equal(
      occurrenceStatusForDate(due, false, { year: 2026, month: 8, day: 20 }),
      "overdue"
    );
    assert.equal(
      occurrenceStatusForDate(due, false, { year: 2026, month: 8, day: 15 }),
      "due_today"
    );
  });
});

describe("inactive + overdue isolation", () => {
  it("skips inactive schedules", () => {
    const s = schedule({
      id: "r4",
      name: "Off",
      firstPaymentDate: "2026-01-01",
      interval: "monthly",
      active: false,
    });
    const plan = buildMonthlyRecurringPlan([s], [], 2026, 8);
    assert.equal(plan.count, 0);
  });

  it("does not carry previous month debt into current plan", () => {
    const s = schedule({
      id: "r5",
      name: "Elektr",
      firstPaymentDate: "2026-01-10",
      interval: "monthly",
    });
    const expenses: Expense[] = [];
    const july = buildMonthlyRecurringPlan(
      [s],
      expenses,
      2026,
      7,
      new Date("2026-08-20T12:00:00+05:00")
    );
    assert.equal(july.occurrences[0]?.status, "overdue");
    const august = buildMonthlyRecurringPlan(
      [s],
      expenses,
      2026,
      8,
      new Date("2026-08-01T12:00:00+05:00")
    );
    assert.equal(august.count, 1);
    assert.equal(august.occurrences[0]?.paymentPeriodKey, "2026-08");
    assert.equal(august.overdueCount, 0);
  });
});

describe("Asia/Tashkent date-only stability", () => {
  it("keeps YYYY-MM-DD day in Tashkent", () => {
    const due = monthOccurrenceDueDate("2026-08-15", "monthly", 2026, 8);
    assert.deepEqual(due, { year: 2026, month: 8, day: 15 });
  });
});
