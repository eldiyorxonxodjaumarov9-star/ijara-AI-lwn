import type { Contract, Payment, Tenant } from "@/types";
import {
  getPaymentDayOfMonth,
  getTashkentDateParts,
  isPaymentMonthOverdue,
  type TashkentDateParts,
} from "@/lib/payment-due-schedule";

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toTashkentParts(value: string | Date): TashkentDateParts {
  return getTashkentDateParts(value);
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
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

/**
 * To'lov qaysi oyga tegishli.
 * periodYear/periodMonth bo'lsa — shu oy; aks holda to'lov sanasi oyi.
 */
export function paymentBillingPeriod(payment: Payment): {
  year: number;
  month: number;
} {
  if (
    payment.periodYear &&
    payment.periodMonth &&
    payment.periodMonth >= 1 &&
    payment.periodMonth <= 12
  ) {
    return { year: payment.periodYear, month: payment.periodMonth };
  }
  const p = getTashkentDateParts(payment.date);
  return { year: p.year, month: p.month };
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

/**
 * Qarzdorlik: har bir muddati o'tgan oy uchun oylik summa.
 * To'lovlar avval o'z oyiga (period) birikadi, qolgani eski oylardan
 * boshlab FIFO bilan taqsimlanadi — bir marta to'langan oy doim to'langan
 * qoladi, yangi oy alohida hisoblanadi.
 */
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

  const overdueMonths: { year: number; month: number }[] = [];
  for (const { year, month } of eachMonth(start, {
    year: untilYear,
    month: untilMonth,
    day: 1,
  })) {
    if (!contractActiveInMonth(start, end, year, month, today)) continue;
    if (!isPaymentMonthOverdue(year, month, paymentDay, now)) continue;
    overdueMonths.push({ year, month });
  }

  const monthsDue = overdueMonths.length;
  const expected = monthsDue * monthly;

  if (monthly <= 0 || monthsDue === 0) {
    return { monthsDue, expected: 0, paid: 0, debt: 0, overdueDays: 0 };
  }

  const contractPayments = payments
    .filter((p) => p.contractId === contract.id && (p.amount || 0) > 0)
    .slice()
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  const remainingByMonth = new Map<string, number>();
  for (const m of overdueMonths) {
    remainingByMonth.set(monthKey(m.year, m.month), monthly);
  }

  let pool = 0;

  for (const payment of contractPayments) {
    let left = payment.amount || 0;
    const period = paymentBillingPeriod(payment);
    const key = monthKey(period.year, period.month);
    const need = remainingByMonth.get(key);
    if (need != null && need > 0) {
      const apply = Math.min(left, need);
      remainingByMonth.set(key, need - apply);
      left -= apply;
    }
    if (left > 0) pool += left;
  }

  for (const m of overdueMonths) {
    if (pool <= 0) break;
    const key = monthKey(m.year, m.month);
    const need = remainingByMonth.get(key) ?? 0;
    if (need <= 0) continue;
    const apply = Math.min(pool, need);
    remainingByMonth.set(key, need - apply);
    pool -= apply;
  }

  let debt = 0;
  for (const m of overdueMonths) {
    debt += remainingByMonth.get(monthKey(m.year, m.month)) ?? 0;
  }
  const paidApplied = Math.max(0, expected - debt);

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
