import type { Contract, Payment, Tenant } from "@/types";
import {
  getPaymentDayOfMonth,
  getTashkentDateParts,
  isPaymentMonthOverdue,
  isSameMonthTashkent,
  type TashkentDateParts,
} from "@/lib/payment-due-schedule";

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toTashkentParts(value: string | Date): TashkentDateParts {
  return getTashkentDateParts(value);
}

/** Arendator to'lov kuni (1–31), yo'q bo'lsa shartnoma boshlanish kuni */
export function resolvePaymentDay(
  tenant: Tenant | undefined,
  contract: Contract
): number {
  if (tenant?.paymentDueDate) {
    const due = new Date(tenant.paymentDueDate);
    if (!Number.isNaN(due.getTime())) {
      return getPaymentDayOfMonth(tenant.paymentDueDate);
    }
  }
  if (contract.startDate) {
    return toTashkentParts(contract.startDate).day;
  }
  return 1;
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

function paidInMonth(
  payments: Payment[],
  contractId: string,
  year: number,
  month: number
) {
  return payments
    .filter(
      (p) =>
        p.contractId === contractId &&
        isSameMonthTashkent(p.date, year, month)
    )
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}

/**
 * Toshkent vaqtida qancha oy uchun to'lov muddati o'tgan.
 * Har bir oy haqiqiy sanalar bo'yicha tekshiriladi.
 */
export function countDueMonthsTashkent(
  startDate: string | Date,
  endDate: string | Date,
  paymentDay: number,
  now = new Date()
): number {
  const start = toTashkentParts(startDate);
  const end = toTashkentParts(endDate);
  const today = getTashkentDateParts(now);

  let untilYear = today.year;
  let untilMonth = today.month;
  if (
    end.year < today.year ||
    (end.year === today.year && end.month < today.month)
  ) {
    untilYear = end.year;
    untilMonth = end.month;
  }

  let count = 0;
  for (const { year, month } of eachMonth(start, {
    year: untilYear,
    month: untilMonth,
    day: 1,
  })) {
    if (!contractActiveInMonth(start, end, year, month, today)) continue;
    if (isPaymentMonthOverdue(year, month, paymentDay, now)) {
      count += 1;
    }
  }
  return count;
}

export interface ContractDebtResult {
  monthsDue: number;
  expected: number;
  paid: number;
  debt: number;
  overdueDays: number;
}

export function computeContractDebt(
  contract: Contract,
  payments: Payment[],
  tenant: Tenant | undefined,
  now = new Date()
): ContractDebtResult {
  const paymentDay = resolvePaymentDay(tenant, contract);
  const start = toTashkentParts(contract.startDate);
  const end = toTashkentParts(contract.endDate);
  const today = getTashkentDateParts(now);
  const monthly = contract.monthlyPayment || 0;

  let untilYear = today.year;
  let untilMonth = today.month;
  if (
    end.year < today.year ||
    (end.year === today.year && end.month < today.month)
  ) {
    untilYear = end.year;
    untilMonth = end.month;
  }

  let monthsDue = 0;
  let expected = 0;
  let paidApplied = 0;
  let debt = 0;

  for (const { year, month } of eachMonth(start, {
    year: untilYear,
    month: untilMonth,
    day: 1,
  })) {
    if (!contractActiveInMonth(start, end, year, month, today)) continue;
    if (!isPaymentMonthOverdue(year, month, paymentDay, now)) continue;

    monthsDue += 1;
    expected += monthly;
    const paidThisMonth = paidInMonth(payments, contract.id, year, month);
    paidApplied += Math.min(paidThisMonth, monthly);
    const shortfall = monthly - paidThisMonth;
    if (shortfall > 0) {
      debt += shortfall;
    }
  }

  const dueDayThisMonth = Math.min(
    paymentDay,
    daysInMonth(today.year, today.month)
  );
  const overdueDays =
    debt > 0 && today.day > dueDayThisMonth
      ? today.day - dueDayThisMonth
      : 0;

  return {
    monthsDue,
    expected,
    paid: paidApplied,
    debt,
    overdueDays,
  };
}
