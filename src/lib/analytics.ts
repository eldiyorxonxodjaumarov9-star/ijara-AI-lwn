import type {
  Contract,
  Expense,
  Payment,
  Property,
  Tenant,
} from "@/types";
import { computeContractDebt } from "@/lib/debt-calculator";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";

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

function computeOccupancy(
  properties: Property[],
  contracts: Contract[],
  tenants: Tenant[]
) {
  const totalRooms = properties.reduce((sum, p) => sum + (p.rooms || 0), 0);
  if (totalRooms > 0) {
    const occupiedFromContracts = contracts.filter(
      (c) => c.status === "active"
    ).length;
    const occupiedFromTenants = tenants.filter((t) => (t.rentAmount || 0) > 0)
      .length;
    const occupied = occupiedFromContracts || occupiedFromTenants;
    return Math.min(100, Math.round((occupied / totalRooms) * 100));
  }

  const rented = properties.filter((p) => p.status === "rented").length;
  return properties.length > 0
    ? Math.round((rented / properties.length) * 100)
    : 0;
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

  const overdueContracts = contracts.filter((c) => {
    const end = new Date(c.endDate);
    return c.status === "expired" || (c.status === "active" && end < now);
  }).length;

  const netIncome = monthlyIncome - monthlyExpenses;
  const occupancyRate = computeOccupancy(properties, contracts, tenants);

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

export interface DebtRow {
  contractId: string;
  propertyName: string;
  tenantName: string;
  monthsDue: number;
  expected: number;
  paid: number;
  debt: number;
  endDate: string;
  overdueDays: number;
}

export function computeDebts(
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[] = [],
  now = new Date()
): DebtRow[] {
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return contracts
    .filter((c) => c.status === "active" || c.status === "expired")
    .map((c) => {
      const tenant = tenantById.get(c.tenantId);
      const result = computeContractDebt(c, payments, tenant, now);
      return {
        contractId: c.id,
        propertyName: c.propertyName ?? "—",
        tenantName: c.tenantName ?? tenant?.fullName ?? "—",
        monthsDue: result.monthsDue,
        expected: result.expected,
        paid: result.paid,
        debt: result.debt,
        endDate: c.endDate,
        overdueDays: result.overdueDays,
      };
    })
    .filter((row) => row.debt > 0)
    .sort((a, b) => b.debt - a.debt);
}

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
  const ref = new Date(year, month, 1);

  const resolveName = (p: Payment) => {
    if (p.tenantName?.trim()) return p.tenantName.trim();
    const tenant = tenants.find((t) => t.id === p.tenantId);
    return tenant?.fullName?.trim() || "Noma'lum";
  };

  return payments
    .filter((p) => isSameMonth(new Date(p.date), ref))
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

export function getOverdueContracts(contracts: Contract[], now = new Date()) {
  const today = getTashkentDateParts(now);
  return contracts.filter((c) => {
    if (c.status === "expired") return true;
    if (c.status !== "active") return false;
    const end = getTashkentDateParts(new Date(c.endDate));
    if (end.year < today.year) return true;
    if (end.year > today.year) return false;
    if (end.month < today.month) return true;
    if (end.month > today.month) return false;
    return end.day < today.day;
  });
}
