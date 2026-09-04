/**
 * Oylik ijara hisoblari — bitta shartnoma + bitta oy = bitta qator.
 * Unique kalit: contractId + billingYear-month (Asia/Tashkent).
 */
import type { Contract, Payment, PaymentMethod, Tenant } from "@/types";
import { contractHasOpenDebtMarker } from "@/lib/open-debt-marker";
import {
  paymentBillingPeriod,
  resolvePaymentDay,
} from "@/lib/debt-calculator";
import {
  formatTashkentDate,
  getTashkentDateParts,
  isPaymentMonthOverdue,
  type TashkentDateParts,
} from "@/lib/payment-due-schedule";

export type BillingInvoiceStatus =
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "UPCOMING";

export interface MonthlyBillingInvoice {
  /** Unique: `${contractId}:${yyyy-mm}` */
  id: string;
  contractId: string;
  tenantId?: string;
  tenantName: string;
  propertyName: string;
  billingYear: number;
  billingMonth: number;
  billingMonthLabel: string;
  dueDate: string;
  invoiceAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: BillingInvoiceStatus;
  /** Haqiqiy to'lov usullari; qarzdorlik emas */
  paymentMethods: PaymentMethod[];
  paymentIds: string[];
}

const MONTHS_UZ_FULL = [
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

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function invoiceId(contractId: string, year: number, month: number) {
  return `${contractId}:${monthKey(year, month)}`;
}

function* eachMonth(
  from: TashkentDateParts,
  until: TashkentDateParts
): Generator<{ year: number; month: number }> {
  let y = from.year;
  let m = from.month;
  while (y < until.year || (y === until.year && m <= until.month)) {
    yield { year: y, month: m };
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

function contractActiveInMonth(
  start: TashkentDateParts,
  end: TashkentDateParts,
  year: number,
  month: number,
  today: TashkentDateParts
): boolean {
  if (year < start.year || (year === start.year && month < start.month)) {
    return false;
  }
  if (year > end.year || (year === end.year && month > end.month)) {
    return false;
  }
  if (year === start.year && month === start.month && today.day < start.day) {
    return false;
  }
  return true;
}

function monthIsBillable(
  year: number,
  month: number,
  paymentDay: number,
  now: Date,
  forceOpenDebt: boolean,
  start: TashkentDateParts,
  today: TashkentDateParts
): boolean {
  if (isPaymentMonthOverdue(year, month, paymentDay, now)) return true;
  if (!forceOpenDebt) return false;
  if (year < today.year || (year === today.year && month < today.month)) {
    return true;
  }
  if (year === today.year && month === today.month) {
    return today.day >= start.day;
  }
  return false;
}

function resolveStatus(input: {
  remaining: number;
  paid: number;
  overdue: boolean;
}): BillingInvoiceStatus {
  if (input.remaining <= 0) return "PAID";
  if (input.overdue) {
    return input.paid > 0 ? "PARTIALLY_PAID" : "OVERDUE";
  }
  if (input.paid > 0) return "PARTIALLY_PAID";
  return "UPCOMING";
}

/**
 * Bitta shartnoma uchun oylik hisoblar (unique contractId+billingMonth).
 * To'lovlar oyiga birikadi; qisman to'lov yangi qarzdorlik yaratmaydi.
 */
export function buildContractMonthlyInvoices(
  contract: Contract,
  payments: Payment[],
  tenant: Tenant | undefined,
  now = new Date()
): MonthlyBillingInvoice[] {
  const paymentDay = resolvePaymentDay(tenant, contract);
  const start = getTashkentDateParts(contract.startDate);
  const end = getTashkentDateParts(contract.endDate);
  const today = getTashkentDateParts(now);
  const monthly = contract.monthlyPayment || 0;
  const forceOpenDebt = contractHasOpenDebtMarker(contract.notes);

  if (monthly <= 0) return [];

  let untilYear = today.year;
  let untilMonth = today.month;
  if (
    end.year < today.year ||
    (end.year === today.year && end.month < today.month)
  ) {
    untilYear = end.year;
    untilMonth = end.month;
  }

  const months: { year: number; month: number }[] = [];
  const seen = new Set<string>();
  for (const { year, month } of eachMonth(start, {
    year: untilYear,
    month: untilMonth,
    day: 1,
  })) {
    if (!contractActiveInMonth(start, end, year, month, today)) continue;
    const key = monthKey(year, month);
    if (seen.has(key)) continue;
    seen.add(key);
    months.push({ year, month });
  }

  // To'lovlari bor, lekin yuqoridagi oralikdan tashqari oylar ham (tarix)
  const contractPayments = payments
    .filter((p) => p.contractId === contract.id && (p.amount || 0) > 0)
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const payment of contractPayments) {
    const period = paymentBillingPeriod(payment);
    const key = monthKey(period.year, period.month);
    if (seen.has(key)) continue;
    if (!contractActiveInMonth(start, end, period.year, period.month, today)) {
      // Shartnoma oralig'idagi tarixiy to'lov oylari
      if (
        period.year < start.year ||
        (period.year === start.year && period.month < start.month)
      ) {
        continue;
      }
    }
    seen.add(key);
    months.push({ year: period.year, month: period.month });
  }

  months.sort((a, b) => a.year - b.year || a.month - b.month);

  const remainingByMonth = new Map<string, number>();
  const paidByMonth = new Map<string, number>();
  const methodsByMonth = new Map<string, PaymentMethod[]>();
  const paymentIdsByMonth = new Map<string, string[]>();

  for (const m of months) {
    remainingByMonth.set(monthKey(m.year, m.month), monthly);
    paidByMonth.set(monthKey(m.year, m.month), 0);
    methodsByMonth.set(monthKey(m.year, m.month), []);
    paymentIdsByMonth.set(monthKey(m.year, m.month), []);
  }

  let pool = 0;
  for (const payment of contractPayments) {
    let left = payment.amount || 0;
    const period = paymentBillingPeriod(payment);
    const key = monthKey(period.year, period.month);
    const need = remainingByMonth.get(key);
    if (need != null && need > 0 && left > 0) {
      const apply = Math.min(left, need);
      remainingByMonth.set(key, need - apply);
      paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + apply);
      left -= apply;
      const methods = methodsByMonth.get(key)!;
      if (!methods.includes(payment.method)) methods.push(payment.method);
      paymentIdsByMonth.get(key)!.push(payment.id);
    }
    if (left > 0) pool += left;
  }

  // FIFO leftover → eski oylar
  for (const m of months) {
    if (pool <= 0) break;
    const key = monthKey(m.year, m.month);
    const need = remainingByMonth.get(key) ?? 0;
    if (need <= 0) continue;
    const apply = Math.min(pool, need);
    remainingByMonth.set(key, need - apply);
    paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + apply);
    pool -= apply;
  }

  const rows: MonthlyBillingInvoice[] = [];
  for (const m of months) {
    const key = monthKey(m.year, m.month);
    const overdue = monthIsBillable(
      m.year,
      m.month,
      paymentDay,
      now,
      forceOpenDebt,
      start,
      today
    );
    // Faqat muddati kelgan/o'tgan yoki to'lov bo'lgan oylar
    const paidAmount = paidByMonth.get(key) ?? 0;
    if (!overdue && paidAmount <= 0) {
      // Joriy oy — muddat kelmagan bo'lsa ham UPCOMING ko'rsatiladi
      if (!(m.year === today.year && m.month === today.month)) continue;
    }

    const remainingAmount = Math.max(0, remainingByMonth.get(key) ?? monthly);
    const dueDay = Math.min(paymentDay, daysInMonth(m.year, m.month));
    const dueDate = formatTashkentDate({
      year: m.year,
      month: m.month,
      day: dueDay,
    });

    rows.push({
      id: invoiceId(contract.id, m.year, m.month),
      contractId: contract.id,
      tenantId: contract.tenantId,
      tenantName: contract.tenantName ?? tenant?.fullName ?? "—",
      propertyName: contract.propertyName ?? "—",
      billingYear: m.year,
      billingMonth: m.month,
      billingMonthLabel: `${MONTHS_UZ_FULL[m.month - 1]} ${m.year}`,
      dueDate,
      invoiceAmount: monthly,
      paidAmount,
      remainingAmount,
      status: resolveStatus({
        remaining: remainingAmount,
        paid: paidAmount,
        overdue,
      }),
      paymentMethods: methodsByMonth.get(key) ?? [],
      paymentIds: paymentIdsByMonth.get(key) ?? [],
    });
  }

  // Unique kafolat: bir xil id ikki marta chiqmasin
  const unique = new Map<string, MonthlyBillingInvoice>();
  for (const row of rows) {
    unique.set(row.id, row);
  }
  return [...unique.values()];
}

export function buildMonthlyBillingLedger(
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[] = [],
  now = new Date()
): MonthlyBillingInvoice[] {
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const rows: MonthlyBillingInvoice[] = [];
  const seen = new Set<string>();

  for (const contract of contracts) {
    if (contract.status !== "active" && contract.status !== "expired") continue;
    const tenant = tenantById.get(contract.tenantId);
    if (tenant?.leftAt) continue;

    for (const invoice of buildContractMonthlyInvoices(
      contract,
      payments,
      tenant,
      now
    )) {
      if (seen.has(invoice.id)) continue;
      seen.add(invoice.id);
      rows.push(invoice);
    }
  }

  const statusOrder: Record<BillingInvoiceStatus, number> = {
    OVERDUE: 0,
    PARTIALLY_PAID: 1,
    UPCOMING: 2,
    PAID: 3,
  };

  return rows.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status];
    if (so !== 0) return so;
    return b.dueDate.localeCompare(a.dueDate);
  });
}

export function summarizeBillingLedger(rows: MonthlyBillingInvoice[]) {
  const debtorTenantIds = new Set<string>();
  let totalDebt = 0;
  for (const row of rows) {
    if (row.remainingAmount > 0 && row.status !== "UPCOMING") {
      totalDebt += row.remainingAmount;
      if (row.tenantId) debtorTenantIds.add(row.tenantId);
      else debtorTenantIds.add(row.tenantName);
    }
  }
  return {
    uniqueDebtorCount: debtorTenantIds.size,
    totalDebtAmount: totalDebt,
  };
}

export const BILLING_STATUS_LABEL: Record<BillingInvoiceStatus, string> = {
  PAID: "To'langan",
  PARTIALLY_PAID: "Qisman to'langan",
  OVERDUE: "Qarzdor",
  UPCOMING: "To'lov muddati kelmagan",
};
