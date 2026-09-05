/**
 * Oylarni solishtirish — sof hisob-kitob (UI/API umumiy).
 * Kirim: faqat haqiqiy Payment yozuvlari (qarz/sintetik emas).
 * Xarajat: barcha Expense yozuvlari ro'yxatda; reja/to'lanmagan chiqimga qo'shilmaydi.
 * Sana chegaralari: Asia/Tashkent (oy boshi inclusive, keyingi oy exclusive).
 */

import { MONTHS_UZ_FULL } from "@/lib/analytics";
import {
  EXPENSE_CATEGORY_MAP,
  MONTHLY_EXPENSE_TYPE_MAP,
  PAYMENT_METHOD_MAP,
} from "@/lib/constants";
import { paymentBillingPeriod } from "@/lib/debt-calculator";
import { resolveMonthlyExpenseLabel } from "@/lib/monthly-expense-type";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import type {
  Expense,
  ExpenseCategory,
  MonthlyExpenseType,
  Payment,
  PaymentMethod,
} from "@/types";

export type YearMonth = { year: number; month: number };

export type PercentChangeKind =
  | "ok"
  | "zero_base"
  | "new_expense"
  | "no_base";

export type PercentChange = {
  kind: PercentChangeKind;
  percent: number | null;
  label: string;
};

/** O'sish / kamayish yo'nalishi */
export type DiffDirection = "up" | "down" | "same" | "new";

export type DiffUnit = "currency" | "count" | "percent_points";

/**
 * farq = compare − base
 * foiz = (farq / base) × 100  (2 kasr)
 */
export type DiffMetric = {
  base: number;
  compare: number;
  diff: number;
  percent: number | null;
  direction: DiffDirection;
  /** O'sdi | Kamaydi | O'zgarmadi | Yangi */
  statusLabel: string;
  /** ↑ +… | ↓ −… | → */
  arrow: "↑" | "↓" | "→";
  /** Masalan: +4 150 UZS yoki +5 ta */
  diffLabel: string;
  /** Masalan: +4.62% yoki Yangi */
  percentLabel: string;
};

export type ExpensePaymentStatus = "paid" | "planned" | "unpaid";

export type IncomeDetailRow = {
  id: string;
  date: string;
  tenantName: string;
  propertyName: string;
  periodLabel: string;
  periodYear: number;
  periodMonth: number;
  method: PaymentMethod;
  methodLabel: string;
  note: string;
  amount: number;
};

export type ExpenseDetailRow = {
  id: string;
  date: string;
  name: string;
  category: ExpenseCategory;
  categoryLabel: string;
  typeKey: string;
  typeLabel: string;
  cadence: "one_time" | "monthly";
  cadenceLabel: string;
  paymentStatus: ExpensePaymentStatus;
  paymentStatusLabel: string;
  countsTowardCashOutflow: boolean;
  methodLabel: string;
  note: string;
  amount: number;
  searchText: string;
};

export type MonthTotals = {
  year: number;
  month: number;
  label: string;
  /** Haqiqiy kirim */
  income: number;
  /** Haqiqiy to'langan chiqim */
  expense: number;
  /** Rejalashtirilgan / to'lanmagan (chiqimga kirmaydi) */
  plannedExpense: number;
  /** Ro'yxatdagi barcha xarajatlar summasi (paid + planned) */
  listedExpenseTotal: number;
  /** Sof natija = haqiqiy kirim − haqiqiy chiqim */
  net: number;
  expenseToIncomeRatioPercent: number | null;
  paymentCount: number;
  averagePayment: number;
  /** Ro'yxatdagi barcha xarajatlar soni */
  expenseCount: number;
  paidExpenseCount: number;
  plannedExpenseCount: number;
  /** O'rtacha xarajat (barcha ro'yxatdagi) */
  averageExpense: number;
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
  /** Holat: O'sdi / Kamaydi / … */
  statusLabel: string;
  diffLabel: string;
  percentLabel: string;
  direction: DiffDirection;
};

export type MetricDelta = {
  base: number;
  compare: number;
  diff: number;
  percent: PercentChange;
  improved: boolean | null;
  metric: DiffMetric;
};

export type IncomeDiffPanel = {
  totalIncome: DiffMetric;
  paymentCount: DiffMetric;
  averagePayment: DiffMetric;
};

export type ExpenseDiffPanel = {
  listedTotal: DiffMetric;
  paidOutflow: DiffMetric;
  planned: DiffMetric;
  expenseCount: DiffMetric;
  averageExpense: DiffMetric;
};

export type OverviewDiffPanel = {
  income: DiffMetric;
  paidExpense: DiffMetric;
  net: DiffMetric;
  expenseToIncomeRatio: DiffMetric;
  estimatedSavings: DiffMetric;
};

export type MonthlyComparisonResult = {
  base: MonthTotals;
  compare: MonthTotals;
  sameMonth: boolean;
  income: MetricDelta;
  expense: MetricDelta;
  plannedExpense: MetricDelta;
  net: MetricDelta;
  estimatedSavingsOpportunity: number;
  incomeDiffs: IncomeDiffPanel;
  expenseDiffs: ExpenseDiffPanel;
  overviewDiffs: OverviewDiffPanel;
  categories: CategoryComparisonRow[];
  topIncreases: CategoryComparisonRow[];
  topDecreases: CategoryComparisonRow[];
  chart: Array<{
    metric: string;
    base: number;
    compare: number;
  }>;
  /** Barcha haqiqiy kirimlar (oy bo'yicha) — cheklovsiz */
  baseIncomes: IncomeDetailRow[];
  compareIncomes: IncomeDetailRow[];
  /** Barcha xarajatlar (paid + planned) — cheklovsiz */
  baseExpenses: ExpenseDetailRow[];
  compareExpenses: ExpenseDetailRow[];
};

/** Unicode minus (−), ASCII hyphen emas */
const MINUS = "\u2212";

/** Raqamni bo'shliqli format: 4150 → "4 150" (oddiy space) */
export function formatAmountSpaces(value: number): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  const abs = Math.abs(n);
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 })
    .format(abs)
    .replace(/[\u00a0\u202f]/g, " ");
}

/** Absolut summa: 1 000 000 UZS */
export function formatAbsCurrency(value: number): string {
  return `${formatAmountSpaces(value)} UZS`;
}

/** +4 150 UZS | −733 UZS | 0 UZS */
export function formatSignedCurrency(diff: number): string {
  if (!Number.isFinite(diff) || diff === 0) return `0 UZS`;
  const sign = diff > 0 ? "+" : MINUS;
  return `${sign}${formatAmountSpaces(diff)} UZS`;
}

/** +5 ta | −3 ta | 0 ta */
export function formatSignedCount(diff: number): string {
  if (!Number.isFinite(diff) || diff === 0) return `0 ta`;
  const sign = diff > 0 ? "+" : MINUS;
  return `${sign}${formatAmountSpaces(diff)} ta`;
}

/** +4.62% | −16.31% | 0.00% */
export function formatSignedPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "O'zgarish yo'q";
  if (percent === 0) return "0.00%";
  const sign = percent > 0 ? "+" : MINUS;
  return `${sign}${Math.abs(percent).toFixed(2)}%`;
}

/**
 * farq = compare − base
 * foiz = (farq / base) × 100
 */
export function computeDiffMetric(
  base: number,
  compare: number,
  unit: DiffUnit = "currency"
): DiffMetric {
  const b = Number.isFinite(base) ? base : 0;
  const c = Number.isFinite(compare) ? compare : 0;
  const diff = c - b;

  let percent: number | null;
  let direction: DiffDirection;
  let statusLabel: string;
  let percentLabel: string;

  if (b === 0 && c === 0) {
    percent = 0;
    direction = "same";
    statusLabel = "O'zgarmadi";
    percentLabel = "O'zgarish yo'q";
  } else if (b === 0 && c !== 0) {
    percent = null;
    direction = "new";
    statusLabel = "Yangi";
    percentLabel = "Yangi";
  } else {
    percent = (diff / Math.abs(b)) * 100;
    // Floating noise → 0
    if (Math.abs(percent) < 0.005) percent = 0;
    if (diff === 0 || percent === 0) {
      direction = "same";
      statusLabel = "O'zgarmadi";
      percentLabel = formatSignedPercent(0);
    } else if (diff > 0) {
      direction = "up";
      statusLabel = "O'sdi";
      percentLabel = formatSignedPercent(percent);
    } else {
      direction = "down";
      statusLabel = "Kamaydi";
      percentLabel = formatSignedPercent(percent);
    }
  }

  const arrow: DiffMetric["arrow"] =
    direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

  let diffLabel: string;
  if (unit === "count") {
    diffLabel = formatSignedCount(diff);
  } else if (unit === "percent_points") {
    if (diff === 0) diffLabel = "0.00 p.p.";
    else {
      const sign = diff > 0 ? "+" : MINUS;
      diffLabel = `${sign}${Math.abs(diff).toFixed(2)} p.p.`;
    }
  } else {
    diffLabel = formatSignedCurrency(diff);
  }

  return {
    base: b,
    compare: c,
    diff,
    percent,
    direction,
    statusLabel,
    arrow,
    diffLabel,
    percentLabel,
  };
}

export const COMPARISON_PAGE_SIZE = 25;

const PLANNED_NOTE_RE = /^\[reja\]/i;
const UNPAID_NOTE_RE = /^\[to'?lanmagan\]/i;

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

export function percentChange(
  base: number,
  compare: number,
  opts?: { asExpenseCategory?: boolean }
): PercentChange {
  if (base === 0 && compare === 0) {
    return { kind: "ok", percent: 0, label: "O'zgarish yo'q" };
  }
  if (base === 0 && compare !== 0) {
    return {
      kind: opts?.asExpenseCategory ? "new_expense" : "no_base",
      percent: null,
      label: "Yangi",
    };
  }
  let percent = ((compare - base) / Math.abs(base)) * 100;
  if (Math.abs(percent) < 0.005) percent = 0;
  return {
    kind: "ok",
    percent,
    label: formatSignedPercent(percent),
  };
}

export function isSyntheticOrDebtPayment(p: Payment): boolean {
  const note = (p.note ?? "").toLowerCase();
  if (note.includes("[qarzga]") || note.includes("[qarz]")) return true;
  if (note.includes("[sintetik]") || note.includes("[synthetic]")) return true;
  if (note.includes("[debt]")) return true;
  return false;
}

/** Reja / to'lanmagan — ro'yxatda ko'rinadi, chiqimga kirmaydi */
export function isPlannedUnpaidExpense(e: Expense): boolean {
  const note = (e.note ?? "").trim();
  if (PLANNED_NOTE_RE.test(note)) return true;
  if (UNPAID_NOTE_RE.test(note)) return true;
  const extra = e as Expense & { planned?: boolean; status?: string };
  if (extra.planned === true) return true;
  if (typeof extra.status === "string") {
    const s = extra.status.toLowerCase();
    if (s === "planned" || s === "scheduled" || s === "unpaid") return true;
  }
  return false;
}

export function resolveExpensePaymentStatus(
  e: Expense
): ExpensePaymentStatus {
  if (!isPlannedUnpaidExpense(e)) return "paid";
  const note = (e.note ?? "").trim();
  if (UNPAID_NOTE_RE.test(note)) return "unpaid";
  const extra = e as Expense & { status?: string };
  if (typeof extra.status === "string" && extra.status.toLowerCase() === "unpaid") {
    return "unpaid";
  }
  return "planned";
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

export function expenseDisplayName(e: Expense): string {
  const typeLabel = expenseCategoryLabel(e);
  const note = (e.note ?? "").replace(PLANNED_NOTE_RE, "").replace(UNPAID_NOTE_RE, "").trim();
  if (e.employeeName?.trim()) {
    return note && note !== e.employeeName.trim()
      ? `${e.employeeName.trim()} · ${note}`
      : e.employeeName.trim();
  }
  if (typeLabel && typeLabel !== "Boshqa") return typeLabel;
  if (note) return note;
  return EXPENSE_CATEGORY_MAP[e.category] ?? "Xarajat";
}

export function labelForCategoryKey(
  key: string,
  sampleLabel?: string
): string {
  if (sampleLabel) return sampleLabel;
  if (key.startsWith("monthly:")) {
    const t = key.slice("monthly:".length) as MonthlyExpenseType;
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

/** Filtr kalitlari: monthly types + asosiy kategoriyalar */
export type ExpenseFilterOption = { value: string; label: string };

export function expenseFilterOptions(): ExpenseFilterOption[] {
  return [
    { value: "all", label: "Barchasi" },
    { value: "monthly:water", label: MONTHLY_EXPENSE_TYPE_MAP.water },
    {
      value: "monthly:electricity",
      label: MONTHLY_EXPENSE_TYPE_MAP.electricity,
    },
    { value: "monthly:office", label: MONTHLY_EXPENSE_TYPE_MAP.office },
    { value: "monthly:custom", label: MONTHLY_EXPENSE_TYPE_MAP.custom },
    ...Object.entries(EXPENSE_CATEGORY_MAP).map(([value, label]) => ({
      value: `cat:${value}`,
      label,
    })),
  ];
}

export function matchesExpenseFilter(
  row: ExpenseDetailRow,
  filter: string
): boolean {
  if (!filter || filter === "all") return true;
  if (filter.startsWith("monthly:")) {
    if (filter === "monthly:custom") {
      return row.typeKey.startsWith("custom:") || row.typeKey === "monthly:custom";
    }
    return row.typeKey === filter;
  }
  if (filter.startsWith("cat:")) {
    return `cat:${row.category}` === filter;
  }
  return true;
}

export function filterExpenseRows(
  rows: ExpenseDetailRow[],
  opts: { filter?: string; search?: string }
): ExpenseDetailRow[] {
  const filter = opts.filter ?? "all";
  const term = (opts.search ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (!matchesExpenseFilter(row, filter)) return false;
    if (!term) return true;
    return row.searchText.includes(term);
  });
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize = COMPARISON_PAGE_SIZE
): { page: number; totalPages: number; total: number; items: T[] } {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    total,
    items: rows.slice(start, start + pageSize),
  };
}

/** Haqiqiy kirim — faqat Payment; qarz/sintetik yo'q */
export function sumRealIncome(
  payments: Payment[],
  ym: YearMonth
): { total: number; count: number } {
  const rows = listIncomeRows(payments, ym);
  return {
    total: rows.reduce((s, r) => s + r.amount, 0),
    count: rows.length,
  };
}

export function listIncomeRows(
  payments: Payment[],
  ym: YearMonth
): IncomeDetailRow[] {
  const seen = new Set<string>();
  const rows: IncomeDetailRow[] = [];

  for (const p of payments) {
    if (!p?.id || seen.has(p.id)) continue;
    if (isSyntheticOrDebtPayment(p)) continue;
    const amount = Number(p.amount) || 0;
    if (amount <= 0) continue;

    const period = paymentBillingPeriod(p);
    if (period.year !== ym.year || period.month !== ym.month) continue;

    seen.add(p.id);
    rows.push({
      id: p.id,
      date: p.date,
      tenantName: p.tenantName?.trim() || "Noma'lum",
      propertyName: p.propertyName?.trim() || "—",
      periodLabel: yearMonthLabel({
        year: period.year,
        month: period.month,
      }),
      periodYear: period.year,
      periodMonth: period.month,
      method: p.method,
      methodLabel: PAYMENT_METHOD_MAP[p.method] ?? p.method,
      note: p.note?.trim() || "—",
      amount,
    });
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return rows;
}

/**
 * Haqiqiy (to'langan) xarajatlar yig'indisi.
 * Reja/to'lanmagan chiqarib tashlanadi; id bo'yicha dedupe.
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

/** Barcha xarajatlar (paid + planned), dedupe, oy bo'yicha */
export function listExpenseRows(
  expenses: Expense[],
  ym: YearMonth
): ExpenseDetailRow[] {
  const seen = new Set<string>();
  const rows: ExpenseDetailRow[] = [];

  for (const e of expenses) {
    if (!e?.id || seen.has(e.id)) continue;
    const amount = Number(e.amount) || 0;
    if (amount <= 0) continue;
    if (!isInTashkentMonth(e.date, ym)) continue;

    seen.add(e.id);
    const status = resolveExpensePaymentStatus(e);
    const typeKey = expenseCategoryKey(e);
    const typeLabel = expenseCategoryLabel(e);
    const name = expenseDisplayName(e);
    const note = (e.note ?? "").trim() || "—";
    const cadence: "one_time" | "monthly" = e.monthlyExpenseType
      ? "monthly"
      : "one_time";

    rows.push({
      id: e.id,
      date: e.date,
      name,
      category: e.category,
      categoryLabel: EXPENSE_CATEGORY_MAP[e.category] ?? "Boshqa",
      typeKey,
      typeLabel,
      cadence,
      cadenceLabel: cadence === "monthly" ? "Oylik" : "Bir martalik",
      paymentStatus: status,
      paymentStatusLabel:
        status === "paid"
          ? "To'langan"
          : status === "unpaid"
            ? "To'lanmagan"
            : "Rejalashtirilgan",
      countsTowardCashOutflow: status === "paid",
      methodLabel: "—",
      note,
      amount,
      searchText: [name, note, typeLabel, e.employeeName, e.companyName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    });
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return rows;
}

export function classifyCategoryChange(
  base: number,
  compare: number
): { status: CategoryStatus; recommendation: string; percent: PercentChange } {
  const percent = percentChange(base, compare, { asExpenseCategory: true });
  const diff = compare - base;
  const metric = computeDiffMetric(base, compare, "currency");

  if (percent.kind === "new_expense" || metric.direction === "new") {
    return {
      status: "new_expense",
      recommendation: `Yangi xarajat: ${formatSignedCurrency(compare).replace(/^\+/, "")}`,
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
    return {
      status: "saving",
      recommendation: `Xarajat ${formatAbsCurrency(Math.abs(diff))}ga yoki ${formatSignedPercent(pct)}ga kamaygan`,
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
      recommendation: `Xarajat ${formatAbsCurrency(Math.abs(diff))}ga yoki ${formatSignedPercent(pct)}ga oshgan — sarfni tekshiring`,
      percent,
    };
  }

  return {
    status: "increase",
    recommendation: `Xarajat ${formatAbsCurrency(Math.abs(diff))}ga yoki ${formatSignedPercent(pct)}ga oshgan — sarfni tekshiring`,
    percent,
  };
}

function refineRecommendation(
  label: string,
  status: CategoryStatus,
  percent: PercentChange,
  diff: number
): string {
  const pct = percent.percent;
  const absAmt = formatAbsCurrency(Math.abs(diff));

  switch (status) {
    case "new_expense":
      return "Yangi xarajat paydo bo'lgan";
    case "saving":
      return pct != null
        ? `${label} xarajati ${absAmt}ga yoki ${formatSignedPercent(pct)}ga kamaygan`
        : `${label} xarajati kamaygan`;
    case "high_increase":
    case "increase":
      return pct != null
        ? `${label} xarajati ${absAmt}ga yoki ${formatSignedPercent(pct)}ga oshgan`
        : `${label} xarajati oshgan`;
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
): MonthTotals & {
  byCategory: Map<string, number>;
  labels: Map<string, string>;
  incomes: IncomeDetailRow[];
  expenseRows: ExpenseDetailRow[];
} {
  const incomes = listIncomeRows(payments, ym);
  const expenseRows = listExpenseRows(expenses, ym);
  const paid = expenseRows.filter((r) => r.countsTowardCashOutflow);
  const planned = expenseRows.filter((r) => !r.countsTowardCashOutflow);

  const incomeTotal = incomes.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = paid.reduce((s, r) => s + r.amount, 0);
  const plannedTotal = planned.reduce((s, r) => s + r.amount, 0);
  const listedTotal = expenseRows.reduce((s, r) => s + r.amount, 0);
  const net = incomeTotal - expenseTotal;
  const ratio =
    incomeTotal > 0
      ? (expenseTotal / incomeTotal) * 100
      : incomeTotal === 0 && expenseTotal === 0
        ? 0
        : null;

  const byCategory = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const r of paid) {
    byCategory.set(r.typeKey, (byCategory.get(r.typeKey) ?? 0) + r.amount);
    labels.set(r.typeKey, r.typeLabel);
  }

  return {
    year: ym.year,
    month: ym.month,
    label: yearMonthLabel(ym),
    income: incomeTotal,
    expense: expenseTotal,
    plannedExpense: plannedTotal,
    listedExpenseTotal: listedTotal,
    net,
    expenseToIncomeRatioPercent: ratio,
    paymentCount: incomes.length,
    averagePayment:
      incomes.length > 0 ? incomeTotal / incomes.length : 0,
    expenseCount: expenseRows.length,
    paidExpenseCount: paid.length,
    plannedExpenseCount: planned.length,
    averageExpense:
      expenseRows.length > 0 ? listedTotal / expenseRows.length : 0,
    byCategory,
    labels,
    incomes,
    expenseRows,
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
    const metric = computeDiffMetric(baseAmount, compareAmount, "currency");
    const diff = compareAmount - baseAmount;
    categories.push({
      key,
      label,
      baseAmount,
      compareAmount,
      diff,
      percent: classified.percent,
      status: classified.status,
      recommendation: refineRecommendation(
        label,
        classified.status,
        classified.percent,
        diff
      ),
      statusLabel: metric.statusLabel,
      diffLabel: metric.diffLabel,
      percentLabel: metric.percentLabel,
      direction: metric.direction,
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
  const plannedPct = percentChange(base.plannedExpense, compare.plannedExpense);
  const netPct = percentChange(base.net, compare.net);
  const netDiff = compare.net - base.net;

  const incomeDiffs: IncomeDiffPanel = {
    totalIncome: computeDiffMetric(base.income, compare.income, "currency"),
    paymentCount: computeDiffMetric(
      base.paymentCount,
      compare.paymentCount,
      "count"
    ),
    averagePayment: computeDiffMetric(
      base.averagePayment,
      compare.averagePayment,
      "currency"
    ),
  };

  const expenseDiffs: ExpenseDiffPanel = {
    listedTotal: computeDiffMetric(
      base.listedExpenseTotal,
      compare.listedExpenseTotal,
      "currency"
    ),
    paidOutflow: computeDiffMetric(base.expense, compare.expense, "currency"),
    planned: computeDiffMetric(
      base.plannedExpense,
      compare.plannedExpense,
      "currency"
    ),
    expenseCount: computeDiffMetric(
      base.expenseCount,
      compare.expenseCount,
      "count"
    ),
    averageExpense: computeDiffMetric(
      base.averageExpense,
      compare.averageExpense,
      "currency"
    ),
  };

  const baseRatio = base.expenseToIncomeRatioPercent ?? 0;
  const compareRatio = compare.expenseToIncomeRatioPercent ?? 0;
  const overviewDiffs: OverviewDiffPanel = {
    income: incomeDiffs.totalIncome,
    paidExpense: expenseDiffs.paidOutflow,
    net: computeDiffMetric(base.net, compare.net, "currency"),
    expenseToIncomeRatio: computeDiffMetric(
      baseRatio,
      compareRatio,
      "percent_points"
    ),
    estimatedSavings: computeDiffMetric(
      0,
      estimatedSavingsOpportunity,
      "currency"
    ),
  };

  function toMetricDelta(
    b: number,
    c: number,
    pct: PercentChange,
    unit: DiffUnit,
    improved: boolean | null
  ): MetricDelta {
    const metric = computeDiffMetric(b, c, unit);
    return {
      base: b,
      compare: c,
      diff: c - b,
      percent: pct,
      improved,
      metric,
    };
  }

  const toPublic = (m: typeof base): MonthTotals => ({
    year: m.year,
    month: m.month,
    label: m.label,
    income: m.income,
    expense: m.expense,
    plannedExpense: m.plannedExpense,
    listedExpenseTotal: m.listedExpenseTotal,
    net: m.net,
    expenseToIncomeRatioPercent: m.expenseToIncomeRatioPercent,
    paymentCount: m.paymentCount,
    averagePayment: m.averagePayment,
    expenseCount: m.expenseCount,
    paidExpenseCount: m.paidExpenseCount,
    plannedExpenseCount: m.plannedExpenseCount,
    averageExpense: m.averageExpense,
  });

  return {
    base: toPublic(base),
    compare: toPublic(compare),
    sameMonth,
    income: toMetricDelta(
      base.income,
      compare.income,
      incomePct,
      "currency",
      compare.income === base.income ? null : compare.income > base.income
    ),
    expense: toMetricDelta(
      base.expense,
      compare.expense,
      expensePct,
      "currency",
      compare.expense === base.expense ? null : compare.expense < base.expense
    ),
    plannedExpense: toMetricDelta(
      base.plannedExpense,
      compare.plannedExpense,
      plannedPct,
      "currency",
      null
    ),
    net: toMetricDelta(
      base.net,
      compare.net,
      netPct,
      "currency",
      netDiff === 0 ? null : netDiff > 0
    ),
    estimatedSavingsOpportunity,
    incomeDiffs,
    expenseDiffs,
    overviewDiffs,
    categories,
    topIncreases,
    topDecreases,
    chart: [
      { metric: "Kirim", base: base.income, compare: compare.income },
      {
        metric: "Haqiqiy chiqim",
        base: base.expense,
        compare: compare.expense,
      },
      {
        metric: "Rejalashtirilgan",
        base: base.plannedExpense,
        compare: compare.plannedExpense,
      },
      { metric: "Sof natija", base: base.net, compare: compare.net },
    ],
    baseIncomes: base.incomes,
    compareIncomes: compare.incomes,
    baseExpenses: base.expenseRows,
    compareExpenses: compare.expenseRows,
  };
}
