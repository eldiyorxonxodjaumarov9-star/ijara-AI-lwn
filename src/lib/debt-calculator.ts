import type { Contract, Payment, Tenant } from "@/types";
import {
  getPaymentDayOfMonth,
  getTashkentDateParts,
  type TashkentDateParts,
} from "@/lib/payment-due-schedule";

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toTashkentParts(value: string | Date): TashkentDateParts {
  const d = typeof value === "string" ? new Date(value) : value;
  return getTashkentDateParts(d);
}

/** Arendator to'lov kuni (1–31), yo'q bo'lsa shartnoma boshlanish kuni */
export function resolvePaymentDay(
  tenant: Tenant | undefined,
  contract: Contract
): number {
  if (tenant?.paymentDueDate) {
    const due = new Date(tenant.paymentDueDate);
    if (!Number.isNaN(due.getTime())) {
      return getPaymentDayOfMonth(due);
    }
  }
  if (contract.startDate) {
    return toTashkentParts(contract.startDate).day;
  }
  return 1;
}

/**
 * Toshkent vaqtida qancha oy uchun to'lov muddati o'tgan.
 * Joriy oy faqat to'lov kuni o'tgandan keyin hisobga olinadi.
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
  let y = start.year;
  let m = start.month;

  while (y < untilYear || (y === untilYear && m <= untilMonth)) {
    const dueDay = Math.min(paymentDay, daysInMonth(y, m));
    const isPastMonth =
      y < today.year || (y === today.year && m < today.month);
    const isCurrentMonth = y === today.year && m === today.month;
    const isStartMonth = y === start.year && m === start.month;

    if (isPastMonth) {
      if (!isStartMonth || today.day >= start.day) {
        count++;
      }
    } else if (isCurrentMonth) {
      const contractStarted =
        y > start.year ||
        (y === start.year && m > start.month) ||
        (isStartMonth && today.day >= start.day);
      if (contractStarted && today.day > dueDay) {
        count++;
      }
    }

    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
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
  const monthsDue = countDueMonthsTashkent(
    contract.startDate,
    contract.endDate,
    paymentDay,
    now
  );

  const paid = payments
    .filter((p) => p.contractId === contract.id)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  if (monthsDue <= 0) {
    return { monthsDue: 0, expected: 0, paid, debt: 0, overdueDays: 0 };
  }

  const expected = monthsDue * (contract.monthlyPayment || 0);
  const debt = Math.max(0, expected - paid);

  const today = getTashkentDateParts(now);
  const dueDayThisMonth = Math.min(
    paymentDay,
    daysInMonth(today.year, today.month)
  );
  const overdueDays =
    debt > 0 && today.day > dueDayThisMonth
      ? today.day - dueDayThisMonth
      : 0;

  return { monthsDue, expected, paid, debt, overdueDays };
}
