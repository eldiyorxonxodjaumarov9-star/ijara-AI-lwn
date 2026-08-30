import {
  formatTashkentDate,
  getTashkentDateParts,
  type TashkentDateParts,
} from "@/lib/payment-due-schedule";

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Oylikni shu oy kunlariga bo‘lib kunlik hisoblaydi */
export function calcDailySalary(
  monthlySalary: number,
  now = new Date()
): number {
  if (!monthlySalary || monthlySalary <= 0) return 0;
  const today = getTashkentDateParts(now);
  const days = daysInMonth(today.year, today.month);
  return Math.round((monthlySalary / days) * 100) / 100;
}

export function clampSalaryPayDay(
  day: number | null | undefined
): number | null {
  if (day == null || !Number.isFinite(day)) return null;
  const n = Math.floor(Number(day));
  if (n < 1 || n > 31) return null;
  return n;
}

export function nextSalaryDueDate(
  salaryPayDay: number,
  now = new Date()
): TashkentDateParts {
  const today = getTashkentDateParts(now);
  const dueThisMonth = Math.min(
    salaryPayDay,
    daysInMonth(today.year, today.month)
  );
  if (today.day <= dueThisMonth) {
    return { year: today.year, month: today.month, day: dueThisMonth };
  }
  let y = today.year;
  let m = today.month + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return {
    year: y,
    month: m,
    day: Math.min(salaryPayDay, daysInMonth(y, m)),
  };
}

export function daysUntilSalaryPay(
  salaryPayDay: number,
  now = new Date()
): number {
  const today = getTashkentDateParts(now);
  const next = nextSalaryDueDate(salaryPayDay, now);
  const start = Date.UTC(today.year, today.month - 1, today.day);
  const end = Date.UTC(next.year, next.month - 1, next.day);
  return Math.round((end - start) / (24 * 3600 * 1000));
}

export function formatStartedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatTashkentDate(getTashkentDateParts(d));
}
