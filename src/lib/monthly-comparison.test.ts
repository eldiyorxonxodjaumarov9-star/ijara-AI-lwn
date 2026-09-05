import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMonthlyComparison,
  isInTashkentMonth,
  isPlannedUnpaidExpense,
  parseYearMonth,
  percentChange,
  sumRealExpenses,
  sumRealIncome,
  tashkentMonthBounds,
} from "./monthly-comparison";
import type { Expense, Payment } from "@/types";

function payment(
  partial: Partial<Payment> & Pick<Payment, "id" | "amount">
): Payment {
  return {
    id: partial.id,
    contractId: partial.contractId ?? "c1",
    tenantName: partial.tenantName ?? "Test",
    propertyName: partial.propertyName ?? "Room",
    amount: partial.amount,
    date: partial.date ?? "2026-07-15T10:00:00+05:00",
    periodYear: partial.periodYear,
    periodMonth: partial.periodMonth,
    method: partial.method ?? "cash",
    note: partial.note,
    createdAt: partial.createdAt ?? "2026-07-15T10:00:00+05:00",
  };
}

function expense(
  partial: Partial<Expense> & Pick<Expense, "id" | "amount" | "date">
): Expense {
  return {
    id: partial.id,
    category: partial.category ?? "utilities",
    amount: partial.amount,
    date: partial.date,
    note: partial.note,
    monthlyExpenseType: partial.monthlyExpenseType,
    monthlyExpenseCustomName: partial.monthlyExpenseCustomName,
    monthlyExpenseLabel: partial.monthlyExpenseLabel,
    createdAt: partial.createdAt ?? partial.date,
  };
}

describe("monthly-comparison: year-month parse & Tashkent bounds", () => {
  it("parses YYYY-MM", () => {
    assert.deepEqual(parseYearMonth("2026-07"), { year: 2026, month: 7 });
    assert.equal(parseYearMonth("2026-13"), null);
    assert.equal(parseYearMonth("bad"), null);
  });

  it("Asia/Tashkent month bounds are inclusive/exclusive", () => {
    const b = tashkentMonthBounds({ year: 2026, month: 7 });
    assert.equal(b.startInclusive, "2026-07-01T00:00:00+05:00");
    assert.equal(b.endExclusive, "2026-08-01T00:00:00+05:00");

    // July 31 evening Tashkent is still July
    assert.equal(
      isInTashkentMonth("2026-07-31T23:30:00+05:00", { year: 2026, month: 7 }),
      true
    );
    // Aug 1 00:00 Tashkent is not July
    assert.equal(
      isInTashkentMonth("2026-08-01T00:00:00+05:00", { year: 2026, month: 7 }),
      false
    );
    // July 31 23:00 UTC = Aug 1 04:00 Tashkent → August
    assert.equal(
      isInTashkentMonth("2026-07-31T23:00:00Z", { year: 2026, month: 7 }),
      false
    );
    assert.equal(
      isInTashkentMonth("2026-07-31T23:00:00Z", { year: 2026, month: 8 }),
      true
    );
  });
});

describe("monthly-comparison: income", () => {
  it("sums real accepted payments for billing period", () => {
    const payments = [
      payment({
        id: "p1",
        amount: 1000,
        periodYear: 2026,
        periodMonth: 7,
      }),
      payment({
        id: "p2",
        amount: 500,
        periodYear: 2026,
        periodMonth: 7,
        date: "2026-08-02T12:00:00+05:00",
      }),
      payment({
        id: "p3",
        amount: 999,
        periodYear: 2026,
        periodMonth: 8,
      }),
    ];
    const july = sumRealIncome(payments, { year: 2026, month: 7 });
    assert.equal(july.total, 1500);
    assert.equal(july.count, 2);
  });

  it("excludes debt/synthetic notes from income", () => {
    const payments = [
      payment({
        id: "real",
        amount: 2000,
        periodYear: 2026,
        periodMonth: 7,
      }),
      payment({
        id: "debt",
        amount: 5000,
        periodYear: 2026,
        periodMonth: 7,
        note: "[qarzga] ochiq oy",
      }),
      payment({
        id: "syn",
        amount: 3000,
        periodYear: 2026,
        periodMonth: 7,
        note: "[sintetik] ledger",
      }),
    ];
    const july = sumRealIncome(payments, { year: 2026, month: 7 });
    assert.equal(july.total, 2000);
    assert.equal(july.count, 1);
  });
});

describe("monthly-comparison: expenses", () => {
  it("sums real expenses in Tashkent month", () => {
    const expenses = [
      expense({
        id: "e1",
        amount: 100,
        date: "2026-07-10T12:00:00+05:00",
        monthlyExpenseType: "water",
      }),
      expense({
        id: "e2",
        amount: 200,
        date: "2026-07-20T12:00:00+05:00",
        monthlyExpenseType: "electricity",
      }),
      expense({
        id: "e3",
        amount: 50,
        date: "2026-08-01T00:00:00+05:00",
        monthlyExpenseType: "water",
      }),
    ];
    const july = sumRealExpenses(expenses, { year: 2026, month: 7 });
    assert.equal(july.total, 300);
    assert.equal(july.count, 2);
    assert.equal(july.byCategory.get("monthly:water"), 100);
    assert.equal(july.byCategory.get("monthly:electricity"), 200);
  });

  it("excludes planned unpaid recurring notes", () => {
    const expenses = [
      expense({
        id: "paid",
        amount: 150,
        date: "2026-07-05T12:00:00+05:00",
        monthlyExpenseType: "office",
      }),
      expense({
        id: "planned",
        amount: 150,
        date: "2026-07-05T12:00:00+05:00",
        monthlyExpenseType: "office",
        note: "[reja] oylik ofis",
      }),
    ];
    assert.equal(isPlannedUnpaidExpense(expenses[1]!), true);
    const july = sumRealExpenses(expenses, { year: 2026, month: 7 });
    assert.equal(july.total, 150);
    assert.equal(july.count, 1);
  });

  it("does not double-count same expense id (recurring → real)", () => {
    const same = expense({
      id: "exp-once",
      amount: 80,
      date: "2026-07-12T12:00:00+05:00",
      monthlyExpenseType: "water",
    });
    // Same row appears twice in a merged list (template + materialised)
    const july = sumRealExpenses([same, same], { year: 2026, month: 7 });
    assert.equal(july.total, 80);
    assert.equal(july.count, 1);
  });
});

describe("monthly-comparison: net, percent, zero base", () => {
  it("computes net = income - expense", () => {
    const result = buildMonthlyComparison({
      payments: [
        payment({
          id: "p1",
          amount: 1000,
          periodYear: 2026,
          periodMonth: 7,
        }),
        payment({
          id: "p2",
          amount: 1200,
          periodYear: 2026,
          periodMonth: 8,
        }),
      ],
      expenses: [
        expense({
          id: "e1",
          amount: 300,
          date: "2026-07-10T12:00:00+05:00",
          monthlyExpenseType: "water",
        }),
        expense({
          id: "e2",
          amount: 400,
          date: "2026-08-10T12:00:00+05:00",
          monthlyExpenseType: "water",
        }),
      ],
      baseMonth: { year: 2026, month: 7 },
      compareMonth: { year: 2026, month: 8 },
    });
    assert.equal(result.base.net, 700);
    assert.equal(result.compare.net, 800);
    assert.equal(result.net.diff, 100);
    assert.equal(result.net.improved, true);
  });

  it("percentChange avoids Infinity/NaN when base is 0", () => {
    const p = percentChange(0, 500, { asExpenseCategory: true });
    assert.equal(p.kind, "new_expense");
    assert.equal(p.percent, null);
    assert.match(p.label, /Yangi xarajat/i);

    const p2 = percentChange(0, 500);
    assert.equal(p2.kind, "no_base");
    assert.equal(p2.percent, null);
    assert.match(p2.label, /baza yo'q/i);

    const p3 = percentChange(100, 125);
    assert.equal(p3.kind, "ok");
    assert.equal(p3.percent, 25);
  });

  it("July vs August comparison with category recommendations", () => {
    const result = buildMonthlyComparison({
      payments: [
        payment({
          id: "p-jul",
          amount: 5000,
          periodYear: 2026,
          periodMonth: 7,
        }),
        payment({
          id: "p-aug",
          amount: 5500,
          periodYear: 2026,
          periodMonth: 8,
        }),
      ],
      expenses: [
        expense({
          id: "el-jul",
          amount: 100,
          date: "2026-07-08T12:00:00+05:00",
          monthlyExpenseType: "electricity",
        }),
        expense({
          id: "el-aug",
          amount: 125,
          date: "2026-08-08T12:00:00+05:00",
          monthlyExpenseType: "electricity",
        }),
        expense({
          id: "su-jul",
          amount: 200,
          date: "2026-07-08T12:00:00+05:00",
          monthlyExpenseType: "water",
        }),
        expense({
          id: "su-aug",
          amount: 176,
          date: "2026-08-08T12:00:00+05:00",
          monthlyExpenseType: "water",
        }),
        expense({
          id: "new-aug",
          amount: 50,
          date: "2026-08-15T12:00:00+05:00",
          monthlyExpenseType: "office",
        }),
        expense({
          id: "planned-aug",
          amount: 999,
          date: "2026-08-20T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "Reja",
          note: "[reja] to'lanmagan",
        }),
      ],
      baseMonth: { year: 2026, month: 7 },
      compareMonth: { year: 2026, month: 8 },
    });

    assert.equal(result.base.income, 5000);
    assert.equal(result.compare.income, 5500);
    assert.equal(result.compare.expense, 125 + 176 + 50);
    assert.ok(result.compare.expense < 999);

    const el = result.categories.find((c) => c.key === "monthly:electricity");
    assert.ok(el);
    assert.equal(el!.status, "high_increase");
    assert.match(el!.recommendation, /25% oshgan/i);

    const su = result.categories.find((c) => c.key === "monthly:water");
    assert.ok(su);
    assert.equal(su!.status, "saving");
    assert.match(su!.recommendation, /kamaygan/i);

    const office = result.categories.find((c) => c.key === "monthly:office");
    assert.ok(office);
    assert.equal(office!.status, "new_expense");
    assert.match(office!.recommendation, /Yangi xarajat/i);

    assert.equal(result.estimatedSavingsOpportunity, 25 + 50);
    assert.equal(result.sameMonth, false);
  });
});
