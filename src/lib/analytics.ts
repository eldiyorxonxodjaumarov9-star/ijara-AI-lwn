import type {
  Contract,
  Expense,
  Payment,
  Property,
} from "@/types";

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

export interface DashboardMetrics {
  totalProperties: number;
  monthlyIncome: number;
  overdueContracts: number;
  netIncome: number;
  occupancyRate: number;
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
}: {
  properties: Property[];
  contracts: Contract[];
  payments: Payment[];
  expenses: Expense[];
}): DashboardMetrics {
  const now = new Date();

  const monthlyIncome = payments
    .filter((p) => isSameMonth(new Date(p.date), now))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const monthlyExpenses = expenses
    .filter((e) => isSameMonth(new Date(e.date), now))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const overdueContracts = contracts.filter((c) => {
    const end = new Date(c.endDate);
    return c.status === "expired" || (c.status === "active" && end < now);
  }).length;

  const netIncome = monthlyIncome - monthlyExpenses;

  const rented = properties.filter((p) => p.status === "rented").length;
  const occupancyRate =
    properties.length > 0 ? Math.round((rented / properties.length) * 100) : 0;

  return {
    totalProperties: properties.length,
    monthlyIncome,
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
  months = 6,
}: {
  payments: Payment[];
  expenses: Expense[];
  months?: number;
}): RevenuePoint[] {
  const now = new Date();
  const series: RevenuePoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const daromad = payments
      .filter((p) => isSameMonth(new Date(p.date), ref))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
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
}

function monthsBetween(from: Date, to: Date) {
  if (to < from) return 0;
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export function computeDebts(
  contracts: Contract[],
  payments: Payment[]
): DebtRow[] {
  const now = new Date();
  return contracts
    .filter((c) => c.status === "active" || c.status === "expired")
    .map((c) => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      const until = now < end ? now : end;
      const monthsDue = Math.max(1, monthsBetween(start, until) + 1);
      const expected = monthsDue * c.monthlyPayment;
      const paid = payments
        .filter((p) => p.contractId === c.id)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const debt = expected - paid;
      return {
        contractId: c.id,
        propertyName: c.propertyName ?? "—",
        tenantName: c.tenantName ?? "—",
        monthsDue,
        expected,
        paid,
        debt,
        endDate: c.endDate,
      };
    })
    .filter((row) => row.debt > 0)
    .sort((a, b) => b.debt - a.debt);
}

export function getOverdueContracts(contracts: Contract[]) {
  const now = new Date();
  return contracts.filter((c) => {
    const end = new Date(c.endDate);
    return c.status === "expired" || (c.status === "active" && end < now);
  });
}
