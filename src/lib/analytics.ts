import type {
  Contract,
  Expense,
  Payment,
  Property,
  Tenant,
} from "@/types";
import { countOverdueContracts } from "@/lib/contracts/contract-overdue";
import { paymentBillingPeriod } from "@/lib/debt-calculator";
import {
  computeDebts,
  selectCanonicalDebts,
  summarizeCanonicalDebts,
  type CanonicalDebtRow,
} from "@/lib/debts/canonical-debts";
import { computeDashboardOccupancyRate } from "@/lib/occupancy";
import { REPORT_PERIOD_LABELS } from "@/lib/report-periods";

const MONTHS_UZ = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyun",
  "Iyul",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

export const MONTHS_UZ_FULL = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

export interface DashboardMetrics {
  totalProperties: number;
  monthlyIncome: number;
  monthlyIncomeActual: number;
  monthlyIncomeExpected: number;
  incomeSource: "actual" | "expected";
  overdueContracts: number;
  netIncome: number;
  occupancyRate: number;
}

function sumActiveContractRent(contracts: Contract[]) {
  return contracts
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (c.monthlyPayment || 0), 0);
}

function sumTenantRent(tenants: Tenant[]) {
  return tenants.reduce((sum, t) => sum + (t.rentAmount || 0), 0);
}

export function getExpectedMonthlyIncome(
  contracts: Contract[],
  tenants: Tenant[]
) {
  const fromContracts = sumActiveContractRent(contracts);
  if (fromContracts > 0) return fromContracts;
  return sumTenantRent(tenants);
}

function isSameMonth(date: Date, ref: Date) {
  return (
    date.getMonth() === ref.getMonth() &&
    date.getFullYear() === ref.getFullYear()
  );
}

export function computeMetrics({
  properties,
  contracts,
  payments,
  expenses,
  tenants = [],
}: {
  properties: Property[];
  contracts: Contract[];
  payments: Payment[];
  expenses: Expense[];
  tenants?: Tenant[];
}): DashboardMetrics {
  const now = new Date();

  const monthlyIncomeActual = payments
    .filter((p) => isSameMonth(new Date(p.date), now))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const monthlyIncomeExpected = getExpectedMonthlyIncome(contracts, tenants);
  const incomeSource =
    monthlyIncomeActual > 0 ? ("actual" as const) : ("expected" as const);
  const monthlyIncome =
    monthlyIncomeActual > 0 ? monthlyIncomeActual : monthlyIncomeExpected;

  const monthlyExpenses = expenses
    .filter((e) => isSameMonth(new Date(e.date), now))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const overdueContracts = countOverdueContracts(contracts, now);

  const netIncome = monthlyIncome - monthlyExpenses;
  const occupancyRate = computeDashboardOccupancyRate(
    properties,
    contracts,
    tenants
  );

  return {
    totalProperties: properties.length,
    monthlyIncome,
    monthlyIncomeActual,
    monthlyIncomeExpected,
    incomeSource,
    overdueContracts,
    netIncome,
    occupancyRate,
  };
}

export interface RevenuePoint {
  month: string;
  daromad: number;
  xarajat: number;
}

/** Cash-flow: groups by payment.date (see report-periods.ts). */
export function buildRevenueSeries({
  payments,
  expenses,
  contracts = [],
  tenants = [],
  months = 6,
  year,
  month,
}: {
  payments: Payment[];
  expenses: Expense[];
  contracts?: Contract[];
  tenants?: Tenant[];
  months?: number;
  year?: number;
  /** 0 = Yanvar … 11 = Dekabr */
  month?: number;
}): RevenuePoint[] {
  const now = new Date();
  const expectedMonthly = getExpectedMonthlyIncome(contracts, tenants);
  const series: RevenuePoint[] = [];

  if (year !== undefined && month !== undefined) {
    const ref = new Date(year, month, 1);
    let daromad = payments
      .filter((p) => isSameMonth(new Date(p.date), ref))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    if (daromad === 0 && isSameMonth(ref, now) && expectedMonthly > 0) {
      daromad = expectedMonthly;
    }
    const xarajat = expenses
      .filter((e) => isSameMonth(new Date(e.date), ref))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    return [{ month: MONTHS_UZ[month], daromad, xarajat }];
  }

  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let daromad = payments
      .filter((p) => isSameMonth(new Date(p.date), ref))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    if (daromad === 0 && isSameMonth(ref, now) && expectedMonthly > 0) {
      daromad = expectedMonthly;
    }
    const xarajat = expenses
      .filter((e) => isSameMonth(new Date(e.date), ref))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    series.push({ month: MONTHS_UZ[ref.getMonth()], daromad, xarajat });
  }

  return series;
}

export function buildPropertyStatusSeries(properties: Property[]) {
  const map: Record<string, number> = {};
  properties.forEach((p) => {
    map[p.status] = (map[p.status] || 0) + 1;
  });
  return map;
}

export type DebtRow = CanonicalDebtRow;

export {
  computeDebts,
  selectCanonicalDebts,
  summarizeCanonicalDebts,
};

/** Rental performance: periodMonth (see report-periods.ts). */
export function buildPaymentReportRows({
  payments,
  tenants = [],
  year,
  month,
}: {
  payments: Payment[];
  tenants?: Tenant[];
  year: number;
  /** 0 = Yanvar … 11 = Dekabr */
  month: number;
}) {
  const resolveName = (p: Payment) => {
    if (p.tenantName?.trim()) return p.tenantName.trim();
    const tenant = tenants.find((t) => t.id === p.tenantId);
    return tenant?.fullName?.trim() || "Noma'lum";
  };

  return payments
    .filter((p) => {
      const period = paymentBillingPeriod(p);
      // month arg: 0 = Yanvar … 11 = Dekabr
      return period.year === year && period.month === month + 1;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((p, index) => ({
      index: index + 1,
      tenantName: resolveName(p),
      propertyName: p.propertyName?.trim() || "—",
      date: p.date,
      amount: p.amount || 0,
      method: p.method,
      note: p.note?.trim() || "—",
    }));
}

export { getOverdueContracts } from "@/lib/contracts/contract-overdue";

/** @internal Documented in report-periods.ts */
export const REVENUE_SERIES_PERIOD_HINT = REPORT_PERIOD_LABELS.cash_flow;
