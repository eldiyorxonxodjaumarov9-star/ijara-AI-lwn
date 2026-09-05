/**
 * Oylarni solishtirish — sof hisob-kitob (UI/API umumiy).
 * Kirim: faqat haqiqiy Payment yozuvlari.
 * Xarajat: faqat haqiqiy Expense yozuvlari (reja/takroriy shablon qo'shilmaydi).
 * Sana chegaralari: Asia/Tashkent (oy boshi inclusive, keyingi oy exclusive).
 */

import { MONTHS_UZ_FULL } from "@/lib/analytics";
import {
  EXPENSE_CATEGORY_MAP,
  MONTHLY_EXPENSE_TYPE_MAP,
} from "@/lib/constants";
import { paymentBillingPeriod } from "@/lib/debt-calculator";
import {
  resolveMonthlyExpenseLabel,
} from "@/lib/monthly-expense-type";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import type { Expense, ExpenseCategory, Payment } from "@/types";

export type YearMonth = { year: number; month: number };

export type PercentChangeKind =
  | "ok"
  | "zero_base"
  | "new_expense"
  | "no_base";

export type PercentChange = {
  kind: PercentChangeKind;
  /** Foiz qiymati; kind !== "ok" bo'lsa null */
  percent: number | null;
  label: string;
};

export type MonthTotals = {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
  net: number;
  expenseToIncomeRatioPercent: number | null;
  paymentCount: number;
  expenseCount: number;
};

export type CategoryStatus =
  | "high_increase"
  | "increase"
  | "stable"
  | "saving"
  | "new_expense"
  | "unchanged";

export type CategoryComparisonRow = {
  key: string;
  label: string;
  baseAmount: number;
  compareAmount: number;
  diff: number;
  percent: PercentChange;
  status: CategoryStatus;
  recommendation: string;
};

export type MetricDelta = {
  base: number;
  compare: number;
  diff: number;
  percent: PercentChange;
  /** Sof natija uchun: musbat = yaxshilanish */
  improved: boolean | null;
};

export type MonthlyComparisonResult = {
  base: MonthTotals;
  compare: MonthTotals;
  sameMonth: boolean;
  income: MetricDelta;
  expense: MetricDelta;
  net: MetricDelta;
  /** Taxminiy tejash imkoniyati — oshgan toifalar farqlari yig'indisi */
  estimatedSavingsOpportunity: number;
  categories: CategoryComparisonRow[];
  topIncreases: CategoryComparisonRow[];
  topDecreases: CategoryComparisonRow[];
  chart: Array<{
    metric: string;
    base: number;
    compare: number;
  }>;
};

const PLANNED_NOTE_RE = /^\[reja\]/i;

/** YYYY-MM → { year, month: 1–12 } */
export function parseYearMonth(raw: string): YearMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function formatYearMonth(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

export function yearMonthLabel(ym: YearMonth): string {
  return `${MONTHS_UZ_FULL[ym.month - 1]} ${ym.year}`;
}

/** Joriy va oldingi oy (Asia/Tashkent) */
export function defaultComparisonMonths(now = new Date()): {
  base: YearMonth;
  compare: YearMonth;
} {
  const t = getTashkentDateParts(now);
  const compare: YearMonth = { year: t.year, month: t.month };
  let by = t.year;
  let bm = t.month - 1;
  if (bm < 1) {
    bm = 12;
    by -= 1;
  }
  return { base: { year: by, month: bm }, compare };
}

/**
 * Toshkent oy chegaralari (UTC+5, DST yo'q).
 * start inclusive, end exclusive — ISO string.
 */
export function tashkentMonthBounds(ym: YearMonth): {
  startInclusive: string;
  endExclusive: string;
} {
  const pad = (n: number) => String(n).padStart(2, "0");
  const startInclusive = `${ym.year}-${pad(ym.month)}-01T00:00:00+05:00`;
  let ny = ym.year;
  let nm = ym.month + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const endExclusive = `${ny}-${pad(nm)}-01T00:00:00+05:00`;
  return { startInclusive, endExclusive };
}

export function isInTashkentMonth(
  date: string | Date,
  ym: YearMonth
): boolean {
  const p = getTashkentDateParts(date);
  return p.year === ym.year && p.month === ym.month;
}

/**
 * Foiz o'zgarishi. base=0 bo'lsa Infinity/NaN qaytarmaydi.
 */
export function percentChange(
  base: number,
  compare: number,
  opts?: { asExpenseCategory?: boolean }
): PercentChange {
  if (base === 0 && compare === 0) {
    return { kind: "ok", percent: 0, label: "O'zgarish yo'q" };
  }
  if (base === 0 && compare !== 0) {
    if (opts?.asExpenseCategory) {
      return {
        kind: "new_expense",
        percent: null,
        label: "Yangi xarajat",
      };
    }
    return {
      kind: "no_base",
      percent: null,
      label: "Taqqoslash uchun baza yo'q",
    };
  }
  const percent = ((compare - base) / Math.abs(base)) * 100;
  return {
    kind: "ok",
    percent,
    label: `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`,
  };
}

/** Haqiqiy kirim — faqat Payment; qarz/sintetik yozuvlar yo'q */
export function sumRealIncome(
  payments: Payment[],
  ym: YearMonth
): { total: number; count: number } {
  let total = 0;
  let count = 0;
  const seen = new Set<string>();

  for (const p of payments) {
    if (!p?.id || seen.has(p.id)) continue;
    // Sintetik / qarzga yozuvlar (agar kelib qolsa) — kirim emas
    if (isSyntheticOrDebtPayment(p)) continue;
    const amount = Number(p.amount) || 0;
    if (amount <= 0) continue;

    const period = paymentBillingPeriod(p);
    if (period.year !== ym.year || period.month !== ym.month) continue;

    seen.add(p.id);
    total += amount;
    count += 1;
  }

  return { total, count };
}

function isSyntheticOrDebtPayment(p: Payment): boolean {
  const note = (p.note ?? "").toLowerCase();
  if (note.includes("[qarzga]") || note.includes("[qarz]")) return true;
  if (note.includes("[sintetik]") || note.includes("[synthetic]")) return true;
  if (note.includes("[debt]")) return true;
  return false;
}

/**
 * Haqiqiy xarajatlar. Rejalashtirilgan (to'lanmagan) yozuvlar chiqarib tashlanadi.
 * Har bir expense id bir marta — takroriy shablon + real expense ikki marta hisoblanmaydi.
 */
export function sumRealExpenses(
  expenses: Expense[],
  ym: YearMonth
): { total: number; count: number; byCategory: Map<string, number> } {
  let total = 0;
  let count = 0;
  const byCategory = new Map<string, number>();
  const seen = new Set<string>();

  for (const e of expenses) {
    if (!e?.id || seen.has(e.id)) continue;
    if (isPlannedUnpaidExpense(e)) continue;
    const amount = Number(e.amount) || 0;
    if (amount <= 0) continue;
    if (!isInTashkentMonth(e.date, ym)) continue;

    seen.add(e.id);
    total += amount;
    count += 1;
    const key = expenseCategoryKey(e);
    byCategory.set(key, (byCategory.get(key) ?? 0) + amount);
  }

  return { total, count, byCategory };
}

/** Reja / to'lanmagan takroriy — pul chiqimiga kirmaydi */
export function isPlannedUnpaidExpense(e: Expense): boolean {
  const note = (e.note ?? "").trim();
  if (PLANNED_NOTE_RE.test(note)) return true;
  // Kelajakdagi maydonlar uchun xavfsiz tekshiruv
  const extra = e as Expense & { planned?: boolean; status?: string };
  if (extra.planned === true) return true;
  if (typeof extra.status === "string") {
    const s = extra.status.toLowerCase();
    if (s === "planned" || s === "scheduled" || s === "unpaid") return true;
  }
  return false;
}

export function expenseCategoryKey(e: Expense): string {
  if (e.monthlyExpenseType === "custom") {
    const custom =
      e.monthlyExpenseCustomName?.trim() ||
      e.monthlyExpenseLabel?.trim() ||
      "Boshqa";
    return `custom:${custom.toLowerCase()}`;
  }
  if (e.monthlyExpenseType) {
    return `monthly:${e.monthlyExpenseType}`;
  }
  return `cat:${e.category}`;
}

export function expenseCategoryLabel(e: Expense): string {
  if (e.monthlyExpenseType) {
    return (
      resolveMonthlyExpenseLabel(
        e.monthlyExpenseType,
        e.monthlyExpenseCustomName
      ) ||
      e.monthlyExpenseLabel?.trim() ||
      MONTHLY_EXPENSE_TYPE_MAP[e.monthlyExpenseType] ||
      "Boshqa"
    );
  }
  return EXPENSE_CATEGORY_MAP[e.category as ExpenseCategory] ?? "Boshqa";
}

export function labelForCategoryKey(
  key: string,
  sampleLabel?: string
): string {
  if (sampleLabel) return sampleLabel;
  if (key.startsWith("monthly:")) {
    const t = key.slice("monthly:".length) as keyof typeof MONTHLY_EXPENSE_TYPE_MAP;
    return MONTHLY_EXPENSE_TYPE_MAP[t] ?? key;
  }
  if (key.startsWith("custom:")) {
    const name = key.slice("custom:".length);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Boshqa";
  }
  if (key.startsWith("cat:")) {
    const c = key.slice("cat:".length) as ExpenseCategory;
    return EXPENSE_CATEGORY_MAP[c] ?? "Boshqa";
  }
  return key;
}

export function classifyCategoryChange(
  base: number,
  compare: number
): { status: CategoryStatus; recommendation: string; percent: PercentChange } {
  const percent = percentChange(base, compare, { asExpenseCategory: true });

  if (percent.kind === "new_expense") {
    return {
      status: "new_expense",
      recommendation: "Yangi xarajat paydo bo'lgan",
      percent,
    };
  }

  if (base === 0 && compare === 0) {
    return {
      status: "unchanged",
      recommendation: "O'zgarish aniqlanmadi",
      percent,
    };
  }

  const pct = percent.percent ?? 0;

  if (pct <= -0.01) {
    const abs = Math.abs(pct).toFixed(0);
    return {
      status: "saving",
      recommendation: `Xarajat ${abs}% kamaygan`,
      percent,
    };
  }

  if (Math.abs(pct) < 5) {
    return {
      status: "stable",
      recommendation: "O'zgarish aniqlanmadi",
      percent,
    };
  }

  if (pct >= 20) {
    return {
      status: "high_increase",
      recommendation: `Xarajat ${pct.toFixed(0)}% oshgan — sarfni tekshiring`,
      percent,
    };
  }

  // 5–19.99%
  return {
    status: "increase",
    recommendation: `Xarajat ${pct.toFixed(0)}% oshgan — sarfni tekshiring`,
    percent,
  };
}

function refineRecommendation(
  label: string,
  status: CategoryStatus,
  percent: PercentChange
): string {
  const pct =
    percent.percent != null ? Math.abs(percent.percent).toFixed(0) : null;

  switch (status) {
    case "new_expense":
      return "Yangi xarajat paydo bo'lgan";
    case "saving":
      return pct
        ? `${label} xarajati ${pct}% kamaygan`
        : `${label} xarajati kamaygan`;
    case "high_increase":
    case "increase":
      return pct
        ? `${label} xarajati ${pct}% oshgan — sarfni tekshiring`
        : `${label} xarajati oshgan — sarfni tekshiring`;
    case "stable":
    case "unchanged":
    default:
      return "O'zgarish aniqlanmadi";
  }
}

function buildMonthTotals(
  payments: Payment[],
  expenses: Expense[],
  ym: YearMonth
): MonthTotals & { byCategory: Map<string, number>; labels: Map<string, string> } {
  const income = sumRealIncome(payments, ym);
  const expense = sumRealExpenses(expenses, ym);
  const net = income.total - expense.total;
  const ratio =
    income.total > 0
      ? (expense.total / income.total) * 100
      : income.total === 0 && expense.total === 0
        ? 0
        : null;

  const labels = new Map<string, string>();
  for (const e of expenses) {
    if (isPlannedUnpaidExpense(e)) continue;
    if (!isInTashkentMonth(e.date, ym)) continue;
    labels.set(expenseCategoryKey(e), expenseCategoryLabel(e));
  }

  return {
    year: ym.year,
    month: ym.month,
    label: yearMonthLabel(ym),
    income: income.total,
    expense: expense.total,
    net,
    expenseToIncomeRatioPercent: ratio,
    paymentCount: income.count,
    expenseCount: expense.count,
    byCategory: expense.byCategory,
    labels,
  };
}

export function buildMonthlyComparison(input: {
  payments: Payment[];
  expenses: Expense[];
  baseMonth: YearMonth;
  compareMonth: YearMonth;
}): MonthlyComparisonResult {
  const { payments, expenses, baseMonth, compareMonth } = input;
  const sameMonth =
    baseMonth.year === compareMonth.year &&
    baseMonth.month === compareMonth.month;

  const base = buildMonthTotals(payments, expenses, baseMonth);
  const compare = buildMonthTotals(payments, expenses, compareMonth);

  const allKeys = new Set<string>([
    ...base.byCategory.keys(),
    ...compare.byCategory.keys(),
  ]);

  const categories: CategoryComparisonRow[] = [];
  for (const key of allKeys) {
    const baseAmount = base.byCategory.get(key) ?? 0;
    const compareAmount = compare.byCategory.get(key) ?? 0;
    if (baseAmount === 0 && compareAmount === 0) continue;

    const label =
      base.labels.get(key) ||
      compare.labels.get(key) ||
      labelForCategoryKey(key);

    const classified = classifyCategoryChange(baseAmount, compareAmount);
    categories.push({
      key,
      label,
      baseAmount,
      compareAmount,
      diff: compareAmount - baseAmount,
      percent: classified.percent,
      status: classified.status,
      recommendation: refineRecommendation(
        label,
        classified.status,
        classified.percent
      ),
    });
  }

  categories.sort((a, b) => b.diff - a.diff);

  const estimatedSavingsOpportunity = categories
    .filter((c) => c.diff > 0)
    .reduce((s, c) => s + c.diff, 0);

  const topIncreases = [...categories]
    .filter((c) => c.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);

  const topDecreases = [...categories]
    .filter((c) => c.diff < 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3);

  const incomePct = percentChange(base.income, compare.income);
  const expensePct = percentChange(base.expense, compare.expense);
  const netPct = percentChange(base.net, compare.net);
  const netDiff = compare.net - base.net;

  return {
    base: {
      year: base.year,
      month: base.month,
      label: base.label,
      income: base.income,
      expense: base.expense,
      net: base.net,
      expenseToIncomeRatioPercent: base.expenseToIncomeRatioPercent,
      paymentCount: base.paymentCount,
      expenseCount: base.expenseCount,
    },
    compare: {
      year: compare.year,
      month: compare.month,
      label: compare.label,
      income: compare.income,
      expense: compare.expense,
      net: compare.net,
      expenseToIncomeRatioPercent: compare.expenseToIncomeRatioPercent,
      paymentCount: compare.paymentCount,
      expenseCount: compare.expenseCount,
    },
    sameMonth,
    income: {
      base: base.income,
      compare: compare.income,
      diff: compare.income - base.income,
      percent: incomePct,
      improved: compare.income === base.income ? null : compare.income > base.income,
    },
    expense: {
      base: base.expense,
      compare: compare.expense,
      diff: compare.expense - base.expense,
      percent: expensePct,
      improved:
        compare.expense === base.expense ? null : compare.expense < base.expense,
    },
    net: {
      base: base.net,
      compare: compare.net,
      diff: netDiff,
      percent: netPct,
      improved: netDiff === 0 ? null : netDiff > 0,
    },
    estimatedSavingsOpportunity,
    categories,
    topIncreases,
    topDecreases,
    chart: [
      { metric: "Kirim", base: base.income, compare: compare.income },
      { metric: "Xarajat", base: base.expense, compare: compare.expense },
      { metric: "Sof natija", base: base.net, compare: compare.net },
    ],
  };
}
