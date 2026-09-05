import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExpenseHeadline,
  buildMonthlyComparison,
  computeDiffMetric,
  expenseOutcomeLabels,
  filterExpenseRows,
  formatSignedCount,
  formatSignedCurrency,
  formatSignedPercent,
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

describe("monthly-comparison: signed diffs and formats", () => {
  it("formats positive/negative UZS and percent with 2 decimals", () => {
    assert.equal(formatSignedCurrency(4150), "+4 150 UZS");
    assert.equal(formatSignedCurrency(-733), "\u2212733 UZS");
    assert.equal(formatSignedCurrency(0), "0 UZS");
    assert.equal(formatSignedPercent(4.617), "+4.62%");
    assert.equal(formatSignedPercent(-16.311), "\u221216.31%");
    assert.equal(formatSignedCount(5), "+5 ta");
  });

  it("handles zero base without Infinity/NaN", () => {
    const zero = computeDiffMetric(0, 0, "currency");
    assert.equal(zero.statusLabel, "O'zgarmadi");
    assert.equal(zero.percentLabel, "O'zgarish yo'q");
    assert.equal(zero.percent, 0);

    const neu = computeDiffMetric(0, 100, "currency");
    assert.equal(neu.direction, "new");
    assert.equal(neu.statusLabel, "Yangi");
    assert.equal(neu.percent, null);
    assert.equal(neu.percentLabel, "Yangi");
  });

  it("matches July→August income example numbers", () => {
    const total = computeDiffMetric(89880, 94030, "currency");
    assert.equal(total.diff, 4150);
    assert.equal(total.diffLabel, "+4 150 UZS");
    assert.equal(total.statusLabel, "O'sdi");
    assert.equal(total.percentLabel, "+4.62%");

    const count = computeDiffMetric(20, 25, "count");
    assert.equal(count.diffLabel, "+5 ta");
    assert.equal(count.percentLabel, "+25.00%");

    const avg = computeDiffMetric(4494, 3761, "currency");
    assert.equal(avg.diff, -733);
    assert.equal(avg.diffLabel, "\u2212733 UZS");
    assert.equal(avg.statusLabel, "Kamaydi");
    assert.equal(avg.percentLabel, "\u221216.31%");
  });

  it("marks expense increase as up (red in UI)", () => {
    const exp = computeDiffMetric(1000000, 1200000, "currency");
    assert.equal(exp.direction, "up");
    assert.equal(exp.diffLabel, "+200 000 UZS");
    assert.equal(exp.percentLabel, "+20.00%");
  });

  it("builds incomeDiffs on full totals not page slice", () => {
    const payments = Array.from({ length: 30 }, (_, i) =>
      payment({
        id: `p${i}`,
        amount: i < 20 ? 1000 : 2000,
        periodYear: 2026,
        periodMonth: i < 20 ? 7 : 8,
      })
    );
    // July: 20 * 1000 = 20000; Aug: 10 * 2000 = 20000
    const result = buildMonthlyComparison({
      payments,
      expenses: [],
      baseMonth: { year: 2026, month: 7 },
      compareMonth: { year: 2026, month: 8 },
    });
    assert.equal(result.incomeDiffs.paymentCount.base, 20);
    assert.equal(result.incomeDiffs.paymentCount.compare, 10);
    assert.equal(result.baseIncomes.length, 20);
    const page = paginateRows(result.baseIncomes, 1, 25);
    assert.equal(page.items.length, 20);
    assert.equal(result.incomeDiffs.totalIncome.base, 20000);
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
    assert.equal(p.label, "Yangi");

    const p2 = percentChange(0, 500);
    assert.equal(p2.kind, "no_base");
    assert.equal(p2.percent, null);
    assert.equal(p2.label, "Yangi");

    const p3 = percentChange(100, 125);
    assert.equal(p3.kind, "ok");
    assert.equal(p3.percent, 25);
    assert.equal(p3.label, "+25.00%");
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
    assert.match(el!.recommendation, /25\.00%ga oshgan/i);
    assert.equal(el!.statusLabel, "Ko'proq");
    assert.equal(el!.diffLabel, "+25 UZS");

    const su = result.categories.find((c) => c.key === "monthly:water");
    assert.ok(su);
    assert.equal(su!.status, "saving");
    assert.equal(su!.statusLabel, "Kamroq");

    const office = result.categories.find((c) => c.key === "monthly:office");
    assert.ok(office);
    assert.equal(office!.status, "new_expense");
    assert.equal(office!.statusLabel, "Yangi");

    assert.equal(result.estimatedSavingsOpportunity, 25 + 50);
    assert.equal(result.sameMonth, false);
    assert.ok(result.incomeDiffs);
    assert.ok(result.expenseDiffs);
    assert.ok(result.overviewDiffs);
    assert.ok(result.expenseExplanation);
    assert.match(
      result.expenseExplanation.title,
      /Avgust 2026 xarajatlari Iyul 2026ga nisbatan/
    );
  });
});

describe("monthly-comparison: expense change explanation", () => {
  it("matches July→August expense headline numbers", () => {
    const total = computeDiffMetric(23285, 25925, "currency");
    assert.equal(total.diff, 2640);
    assert.equal(total.diffLabel, "+2 640 UZS");
    assert.equal(total.percentLabel, "+11.34%");

    const count = computeDiffMetric(61, 71, "count");
    assert.equal(count.diffLabel, "+10 ta");
    assert.equal(count.percentLabel, "+16.39%");

    // Aniq o'rtacha: 23285/61 va 25925/71 — foiz yaxlitlashsiz o'rtachadan
    const avgExact = computeDiffMetric(23285 / 61, 25925 / 71, "currency");
    assert.ok(Math.abs(avgExact.diff - -16.58) < 0.02);
    assert.match(avgExact.percentLabel, /\u22124\.34%/);

    const avgRounded = computeDiffMetric(382, 365, "currency");
    assert.equal(avgRounded.diff, -17);
    assert.equal(avgRounded.diffLabel, "\u221217 UZS");

    const headline = buildExpenseHeadline(
      "Iyul 2026",
      "Avgust 2026",
      total
    );
    assert.match(headline, /2 640 UZS/);
    assert.match(headline, /11\.34%/);
    assert.match(headline, /ko'proq xarajat qilingan/);

    const outcome = expenseOutcomeLabels(total);
    assert.equal(outcome.word, "Ko'proq");
    assert.equal(outcome.phrase, "11.34% ko'proq");
  });

  it("explains increase/decrease/new/gone by category and name", () => {
    const result = buildMonthlyComparison({
      payments: [],
      expenses: [
        expense({
          id: "j-maosh",
          amount: 10000,
          date: "2026-07-10T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "Maosh",
        }),
        expense({
          id: "j-gone",
          amount: 2360,
          date: "2026-07-11T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "Eski",
        }),
        expense({
          id: "a-maosh",
          amount: 12676,
          date: "2026-08-10T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "Maosh",
        }),
        expense({
          id: "a-mahalla",
          amount: 1000,
          date: "2026-08-12T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "Mahalla",
        }),
      ],
      baseMonth: { year: 2026, month: 7 },
      compareMonth: { year: 2026, month: 8 },
    });

    const expl = result.expenseExplanation;
    assert.equal(expl.totalIncrease, 2676 + 1000);
    assert.equal(expl.totalDecrease, 2360);
    assert.equal(expl.netDiff, 2676 + 1000 - 2360);
    assert.equal(expl.netDiff, result.expenseDiffs.listedTotal.diff);
    assert.equal(expl.netDiffLabel, formatSignedCurrency(expl.netDiff));

    const maosh = expl.risingCategories.find((c) =>
      c.label.toLowerCase().includes("maosh")
    );
    assert.ok(maosh);
    assert.equal(maosh!.diff, 2676);
    assert.ok(maosh!.shareOfIncreasePercent != null);

    const mahalla = result.categories.find((c) =>
      c.label.toLowerCase().includes("mahalla")
    );
    assert.ok(mahalla);
    assert.equal(mahalla!.direction, "new");
    assert.equal(mahalla!.percentLabel, "Yangi xarajat");
    assert.equal(mahalla!.statusLabel, "Yangi");

    const eski = result.categories.find((c) =>
      c.label.toLowerCase().includes("eski")
    );
    assert.ok(eski);
    assert.equal(eski!.compareAmount, 0);
    assert.equal(eski!.percentLabel, "To'liq kamaygan");
    assert.equal(eski!.statusLabel, "To'liq kamaygan");

    assert.ok(expl.risingNames.length >= 1);
    assert.ok(expl.fallingNames.length >= 1);
    assert.match(expl.narrative, /oshgan|yangi/i);
    assert.doesNotMatch(expl.narrative, /Infinity|NaN/);
  });

  it("does not invent narrative when expenses did not rise", () => {
    const result = buildMonthlyComparison({
      payments: [],
      expenses: [
        expense({
          id: "j1",
          amount: 5000,
          date: "2026-07-05T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "A",
        }),
        expense({
          id: "a1",
          amount: 4000,
          date: "2026-08-05T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "A",
        }),
      ],
      baseMonth: { year: 2026, month: 7 },
      compareMonth: { year: 2026, month: 8 },
    });
    assert.equal(result.expenseDiffs.listedTotal.diff, -1000);
    assert.match(
      result.expenseExplanation.narrative,
      /oshishi aniqlanmadi/
    );
  });

  it("aggregates same name+category and ignores pagination slice", () => {
    const expenses = [
      ...Array.from({ length: 30 }, (_, i) =>
        expense({
          id: `j-${i}`,
          amount: 100,
          date: "2026-07-15T12:00:00+05:00",
          monthlyExpenseType: "custom",
          monthlyExpenseCustomName: "Takror",
        })
      ),
      expense({
        id: "a-1",
        amount: 5000,
        date: "2026-08-15T12:00:00+05:00",
        monthlyExpenseType: "custom",
        monthlyExpenseCustomName: "Takror",
      }),
    ];
    const result = buildMonthlyComparison({
      payments: [],
      expenses,
      baseMonth: { year: 2026, month: 7 },
      compareMonth: { year: 2026, month: 8 },
    });
    assert.equal(result.expenseDiffs.listedTotal.base, 3000);
    assert.equal(result.expenseDiffs.expenseCount.base, 30);
    const page = paginateRows(result.baseExpenses, 1, 25);
    assert.equal(page.items.length, 25);
    const name = result.expenseExplanation.risingNames.find(
      (n) => n.name === "Takror"
    );
    assert.ok(name);
    assert.equal(name!.baseAmount, 3000);
    assert.equal(name!.compareAmount, 5000);
    assert.equal(name!.diff, 2000);
  });
});
