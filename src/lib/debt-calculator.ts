import type { Contract, Payment, Tenant } from "@/types";
import {
  formatTashkentDate,
  getPaymentDayOfMonth,
  getPaymentSchedule,
  getTashkentDateParts,
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
  from: Pick<TashkentDateParts, "year" | "month">,
  until: Pick<TashkentDateParts, "year" | "month">
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

function compareParts(a: TashkentDateParts, b: TashkentDateParts) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function daysBetween(from: TashkentDateParts, to: TashkentDateParts) {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Oyning to'lov sanasi. Boshlanish oyida to'lov kuni shartnoma boshlanishidan
 * oldin bo'lsa — boshlanish kuni.
 */
function billingDueDate(
  start: TashkentDateParts,
  year: number,
  month: number,
  paymentDay: number
): TashkentDateParts {
  let day = Math.min(paymentDay, daysInMonth(year, month));
  if (year === start.year && month === start.month) {
    day = Math.max(day, start.day);
  }
  return { year, month, day };
}

/**
 * Muddati o'tgan billing oylar: to'lov sanasi bugun yoki undan oldin va
 * shartnoma tugash sanasidan qat'iy oldin (tugash kuni yangi oy boshlanmaydi).
 */
function overdueBillingPeriods(
  start: TashkentDateParts,
  end: TashkentDateParts,
  paymentDay: number,
  today: TashkentDateParts
): { year: number; month: number; due: TashkentDateParts }[] {
  const until = compareParts(end, today) < 0 ? end : today;
  const out: { year: number; month: number; due: TashkentDateParts }[] = [];
  for (const { year, month } of eachMonth(start, until)) {
    const due = billingDueDate(start, year, month, paymentDay);
    if (compareParts(due, today) > 0) continue;
    if (compareParts(due, end) >= 0) continue;
    out.push({ year, month, due });
  }
  return out;
}

/** Shartnoma amalda tugagan sana: endDate yoki arendator chiqib ketgan sana (qaysi biri oldin). */
function effectiveEnd(contract: Contract, tenant: Tenant | undefined) {
  const end = toTashkentParts(contract.endDate);
  if (!tenant?.leftAt) return end;
  const left = new Date(tenant.leftAt);
  if (Number.isNaN(left.getTime())) return end;
  const leftParts = toTashkentParts(left);
  return compareParts(leftParts, end) < 0 ? leftParts : end;
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
  return overdueBillingPeriods(
    toTashkentParts(startDate),
    toTashkentParts(endDate),
    paymentDay,
    getTashkentDateParts(now)
  ).length;
}

export interface DebtPeriod {
  year: number;
  month: number;
  /** To'lov sanasi (YYYY-MM-DD, Toshkent) */
  dueDate: string;
  expected: number;
  paid: number;
  remaining: number;
}

export interface ContractDebtResult {
  /** Muddati o'tgan barcha oylar (to'langanlari ham). */
  monthsDue: number;
  expected: number;
  /** Faqat haqiqiy to'lovlar bilan yopilgan summa. */
  paid: number;
  /** Hisobdan chiqarilgan (write-off) summa — to'lov emas. */
  writtenOff: number;
  debt: number;
  /** Eng eski yopilmagan oy to'lov sanasidan bugungacha kunlar. */
  overdueDays: number;
  /** Qarz bo'lsa eng eski ochiq oyning to'lov sanasi (YYYY-MM-DD, Toshkent) */
  oldestUnpaidDueDate: string | null;
  /** Qoldig'i > 0 bo'lgan oylar soni. */
  unpaidMonths: number;
  /** Qoldig'i > 0 bo'lgan oylar, eskidan yangiga. */
  unpaidPeriods: DebtPeriod[];
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
  const end = effectiveEnd(contract, tenant);
  const today = getTashkentDateParts(now);
  const monthly = contract.monthlyPayment || 0;

  const overdueMonths = overdueBillingPeriods(start, end, paymentDay, today);

  const monthsDue = overdueMonths.length;
  const expected = monthsDue * monthly;

  if (monthly <= 0 || monthsDue === 0) {
    return {
      monthsDue,
      expected: 0,
      paid: 0,
      writtenOff: 0,
      debt: 0,
      overdueDays: 0,
      oldestUnpaidDueDate: null,
      unpaidMonths: 0,
      unpaidPeriods: [],
    };
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

  let unpaidAfterPayments = 0;
  for (const value of remainingByMonth.values()) unpaidAfterPayments += value;
  const paidApplied = Math.max(0, expected - unpaidAfterPayments);
  const remainingAfterPayments = new Map(remainingByMonth);

  let writeOffPool = Math.max(0, contract.writtenOffAmount ?? 0);
  let writtenOff = 0;
  for (const m of overdueMonths) {
    if (writeOffPool <= 0) break;
    const key = monthKey(m.year, m.month);
    const need = remainingByMonth.get(key) ?? 0;
    if (need <= 0) continue;
    const apply = Math.min(writeOffPool, need);
    remainingByMonth.set(key, need - apply);
    writeOffPool -= apply;
    writtenOff += apply;
  }

  let debt = 0;
  const unpaidPeriods: DebtPeriod[] = [];
  for (const m of overdueMonths) {
    const remaining = remainingByMonth.get(monthKey(m.year, m.month)) ?? 0;
    debt += remaining;
    if (remaining > 0) {
      unpaidPeriods.push({
        year: m.year,
        month: m.month,
        dueDate: formatTashkentDate(m.due),
        expected: monthly,
        paid: monthly - (remainingAfterPayments.get(monthKey(m.year, m.month)) ?? 0),
        remaining,
      });
    }
  }

  const oldest = overdueMonths.find(
    (m) => (remainingByMonth.get(monthKey(m.year, m.month)) ?? 0) > 0
  );
  const overdueDays = oldest ? Math.max(0, daysBetween(oldest.due, today)) : 0;

  return {
    monthsDue,
    expected,
    paid: paidApplied,
    writtenOff,
    debt,
    overdueDays,
    oldestUnpaidDueDate: unpaidPeriods[0]?.dueDate ?? null,
    unpaidMonths: unpaidPeriods.length,
    unpaidPeriods,
  };
}

/**
 * SMS / jadval ko'rinishi uchun shartnoma bo'yicha keyingi to'lov muddati.
 * Qarz bo'lsa — eng eski ochiq muddat; aks holda — getPaymentSchedule nextDueDate.
 */
export function getContractDisplayPaymentDueDate(
  contract: Contract,
  payments: Payment[],
  tenant: Tenant | undefined,
  now = new Date()
): string | null {
  const result = computeContractDebt(contract, payments, tenant, now);

  if (result.debt > 0) {
    return result.oldestUnpaidDueDate;
  }

  if (contract.status === "expired") {
    return null;
  }

  const scheduleSource = tenant?.paymentDueDate ?? contract.startDate;
  if (!scheduleSource) {
    return null;
  }

  return getPaymentSchedule(scheduleSource, now)?.nextDueDate ?? null;
}
