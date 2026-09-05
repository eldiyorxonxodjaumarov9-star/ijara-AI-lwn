import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMonthlyComparison,
  filterExpenseRows,
  isInTashkentMonth,
  isPlannedUnpaidExpense,
  listExpenseRows,
  listIncomeRows,
  paginateRows,
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
    employeeName: partial.employeeName,
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

    assert.equal(
      isInTashkentMonth("2026-07-31T23:30:00+05:00", { year: 2026, month: 7 }),
      true
    );
    assert.equal(
      isInTashkentMonth("2026-08-01T00:00:00+05:00", { year: 2026, month: 7 }),
      false
    );
    assert.equal(
      isInTashkentMonth("2026-07-31T23:00:00Z", { year: 2026, month: 7 }),
      false
    );
    assert.equal(
      isInTashkentMonth("2026-07-31T23:00:00Z", { year: 2026, month: 8 }),
      true
    );
  });

  it("supports year crossover Dec→Jan", () => {
    const dec = tashkentMonthBounds({ year: 2026, month: 12 });
    assert.equal(dec.endExclusive, "2027-01-01T00:00:00+05:00");
    const result = buildMonthlyComparison({
      payments: [
        payment({
          id: "p-dec",
          amount: 100,
          periodYear: 2026,
          periodMonth: 12,
        }),
        payment({
          id: "p-jan",
          amount: 200,
          periodYear: 2027,
          periodMonth: 1,
        }),
      ],
      expenses: [],
      baseMonth: { year: 2026, month: 12 },
      compareMonth: { year: 2027, month: 1 },
    });
    assert.equal(result.base.income, 100);
    assert.equal(result.compare.income, 200);
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
    assert.equal(listIncomeRows(payments, { year: 2026, month: 7 }).length, 2);
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

describe("monthly-comparison: expenses detail", () => {
  it("lists all one-time and monthly expenses", () => {
    const expenses = [
      expense({
        id: "one",
        amount: 40,
        date: "2026-07-03T12:00:00+05:00",
        category: "repair",
      }),
      expense({
        id: "water",
        amount: 100,
        date: "2026-07-10T12:00:00+05:00",
        monthlyExpenseType: "water",
      }),
      expense({
        id: "elec",
        amount: 200,
        date: "2026-07-20T12:00:00+05:00",
        monthlyExpenseType: "electricity",
      }),
      expense({
        id: "aug",
        amount: 50,
        date: "2026-08-01T00:00:00+05:00",
        monthlyExpenseType: "water",
      }),
    ];
    const rows = listExpenseRows(expenses, { year: 2026, month: 7 });
    assert.equal(rows.length, 3);
    assert.ok(rows.some((r) => r.cadence === "one_time"));
    assert.ok(rows.some((r) => r.cadence === "monthly"));
    const july = sumRealExpenses(expenses, { year: 2026, month: 7 });
    assert.equal(july.total, 340);
  });

  it("shows planned unpaid in list but not in cash outflow", () => {
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
    const rows = listExpenseRows(expenses, { year: 2026, month: 7 });
    assert.equal(rows.length, 2);
    const planned = rows.find((r) => r.id === "planned");
    assert.ok(planned);
    assert.equal(planned!.paymentStatus, "planned");
    assert.equal(planned!.countsTowardCashOutflow, false);
    const july = sumRealExpenses(expenses, { year: 2026, month: 7 });
    assert.equal(july.total, 150);
    assert.equal(july.count, 1);
  });

  it("does not double-count same expense id", () => {
    const same = expense({
      id: "exp-once",
      amount: 80,
      date: "2026-07-12T12:00:00+05:00",
      monthlyExpenseType: "water",
    });
    const rows = listExpenseRows([same, same], { year: 2026, month: 7 });
    assert.equal(rows.length, 1);
    const july = sumRealExpenses([same, same], { year: 2026, month: 7 });
    assert.equal(july.total, 80);
  });

  it("filters by category and search without changing global totals", () => {
    const expenses = [
      expense({
        id: "w",
        amount: 100,
        date: "2026-07-08T12:00:00+05:00",
        monthlyExpenseType: "water",
      }),
      expense({
        id: "e",
        amount: 200,
        date: "2026-07-08T12:00:00+05:00",
        monthlyExpenseType: "electricity",
        note: "transformator",
      }),
      expense({
        id: "s",
        amount: 50,
        date: "2026-07-08T12:00:00+05:00",
        category: "salary",
        employeeName: "Ali",
      }),
    ];
    const rows = listExpenseRows(expenses, { year: 2026, month: 7 });
    assert.equal(rows.length, 3);
    const waterOnly = filterExpenseRows(rows, { filter: "monthly:water" });
    assert.equal(waterOnly.length, 1);
    assert.equal(waterOnly[0]!.amount, 100);
    const search = filterExpenseRows(rows, { search: "transformator" });
    assert.equal(search.length, 1);
    assert.equal(search[0]!.id, "e");
    // Pagination must not affect full-list totals
    const page1 = paginateRows(rows, 1, 2);
    assert.equal(page1.items.length, 2);
    assert.equal(page1.total, 3);
    const fullSum = rows.reduce((s, r) => s + r.amount, 0);
    const pageSum = page1.items.reduce((s, r) => s + r.amount, 0);
    assert.notEqual(pageSum, fullSum);
    assert.equal(fullSum, 350);
  });
});

describe("monthly-comparison: net, percent, zero base", () => {
  it("computes net = income - paid expense (not planned)", () => {
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
        expense({
          id: "plan",
          amount: 999,
          date: "2026-08-10T12:00:00+05:00",
          monthlyExpenseType: "office",
          note: "[reja] kechikkan",
        }),
      ],
      baseMonth: { year: 2026, month: 7 },
      compareMonth: { year: 2026, month: 8 },
    });
    assert.equal(result.base.net, 700);
    assert.equal(result.compare.net, 800);
    assert.equal(result.compare.plannedExpense, 999);
    assert.equal(result.compare.expense, 400);
    assert.equal(result.compareExpenses.length, 2);
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
    assert.equal(result.compare.plannedExpense, 999);
    assert.ok(result.compare.expense < 999);
    assert.equal(result.baseIncomes.length, 1);
    assert.equal(result.compareExpenses.length, 4);

    const el = result.categories.find((c) => c.key === "monthly:electricity");
    assert.ok(el);
    assert.equal(el!.status, "high_increase");
    assert.match(el!.recommendation, /25% oshgan/i);

    const su = result.categories.find((c) => c.key === "monthly:water");
    assert.ok(su);
    assert.equal(su!.status, "saving");

    const office = result.categories.find((c) => c.key === "monthly:office");
    assert.ok(office);
    assert.equal(office!.status, "new_expense");

    assert.equal(result.estimatedSavingsOpportunity, 25 + 50);
    assert.equal(result.sameMonth, false);
  });
});
