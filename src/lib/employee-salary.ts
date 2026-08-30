import {
  formatTashkentDate,
  getTashkentDateParts,
  type TashkentDateParts,
} from "@/lib/payment-due-schedule";
import { formatUzs } from "@/lib/payment-reminder-utils";

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

export function clampSalaryPayDay(day: number | null | undefined): number | null {
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

export type EmployeeSalaryRow = {
  id: string;
  fullName: string;
  phone?: string | null;
  position?: string | null;
  companyName?: string | null;
  monthlySalary: number;
  salaryPayDay: number;
  dailySalary: number;
  daysLeft: number;
  nextDueDate: string;
  isToday: boolean;
};

export function mapEmployeeSalaryRow(
  emp: {
    id: string;
    fullName: string;
    phone?: string | null;
    position?: string | null;
    monthlySalary: number;
    salaryPayDay?: number | null;
  },
  now = new Date()
): EmployeeSalaryRow | null {
  const day = clampSalaryPayDay(emp.salaryPayDay);
  if (!day) return null;
  const daysLeft = daysUntilSalaryPay(day, now);
  const next = nextSalaryDueDate(day, now);
  return {
    id: emp.id,
    fullName: emp.fullName,
    phone: emp.phone,
    position: emp.position,
    monthlySalary: emp.monthlySalary,
    salaryPayDay: day,
    dailySalary: calcDailySalary(emp.monthlySalary, now),
    daysLeft,
    nextDueDate: formatTashkentDate(next),
    isToday: daysLeft === 0,
  };
}

/** Bugun yoki keyingi `withinDays` kun ichida oylik beriladiganlar */
export function filterSalaryDueSoon(
  rows: EmployeeSalaryRow[],
  withinDays = 3
) {
  return rows
    .filter((r) => r.daysLeft >= 0 && r.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.fullName.localeCompare(b.fullName));
}

export function buildSalaryRemindersMessage(rows: EmployeeSalaryRow[]) {
  const today = formatTashkentDate(getTashkentDateParts());
  if (rows.length === 0) {
    return (
      `💰 <b>Ishchilar oyligi</b>\n` +
      `🕐 Toshkent: ${today}\n\n` +
      `Oylik kuni belgilangan faol ishchi yo'q.\n` +
      `Ishchilar bo'limida oylik va beriladigan kunni kiriting.`
    );
  }

  const dueToday = rows.filter((r) => r.isToday);
  const lines = [
    `💰 <b>Ishchilar oyligi</b> (${rows.length} ta)`,
    `🕐 Toshkent: ${today}`,
  ];
  if (dueToday.length > 0) {
    lines.push(
      `🚨 <b>Bugun oylik:</b> ${dueToday.map((r) => r.fullName).join(", ")}`
    );
  }
  lines.push("");

  rows.forEach((r, i) => {
    const when =
      r.daysLeft === 0
        ? "🚨 Bugun beriladi"
        : r.daysLeft === 1
          ? "Ertaga"
          : `${r.daysLeft} kun qoldi`;
    const company = r.companyName ? ` [${r.companyName}]` : "";
    lines.push(
      `${i + 1}. <b>${r.fullName}</b>${company}${r.position ? ` — ${r.position}` : ""}`,
      `   💵 Oylik: <b>${formatUzs(r.monthlySalary)}</b>`,
      `   📅 Kunlik: <b>${formatUzs(r.dailySalary)}</b>`,
      `   📆 Har oyning <b>${r.salaryPayDay}</b>-kuni → <b>${r.nextDueDate}</b>`,
      `   ⏰ ${when}`,
      ""
    );
  });

  return lines.join("\n").trim();
}
