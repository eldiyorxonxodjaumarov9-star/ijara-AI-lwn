const TASHKENT_TZ = "Asia/Tashkent";

export type TashkentDateParts = { year: number; month: number; day: number };

export type TashkentDateTimeParts = TashkentDateParts & {
  hour: number;
  minute: number;
  second: number;
};

export function getTashkentDateParts(date: string | Date = new Date()): TashkentDateParts {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TASHKENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const raw = formatter.format(d);
  const [year, month, day] = raw.split("-").map(Number);
  return { year, month, day };
}

export function formatTashkentDate(parts: TashkentDateParts) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getTashkentDateTimeParts(date = new Date()): TashkentDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TASHKENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function msUntilTashkentMidnight(from = new Date()) {
  const p = getTashkentDateTimeParts(from);
  const elapsed =
    (p.hour * 3600 + p.minute * 60 + p.second) * 1000;
  return 24 * 3600 * 1000 - elapsed;
}

export function formatTashkentDateTime(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: TASHKENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatter.format(date);
}

export function formatTashkentClock(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: TASHKENT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Bazadagi sana maydonidan oyning to'lov kuni (1–31), Toshkent bo'yicha */
export function getPaymentDayOfMonth(paymentDueDate: Date | string) {
  const d =
    typeof paymentDueDate === "string"
      ? new Date(paymentDueDate)
      : paymentDueDate;
  return getTashkentDateParts(d).day;
}

export function isSameMonthTashkent(
  value: string | Date,
  year: number,
  month: number
) {
  const p = getTashkentDateParts(value);
  return p.year === year && p.month === month;
}

/** Toshkent vaqtida shu oyning to'lov muddati o'tganmi (haqiqiy bugungi sana) */
export function isPaymentMonthOverdue(
  year: number,
  month: number,
  paymentDay: number,
  now = new Date()
): boolean {
  const today = getTashkentDateParts(now);
  if (year < today.year || (year === today.year && month < today.month)) {
    return true;
  }
  if (year === today.year && month === today.month) {
    const dueDay = Math.min(paymentDay, daysInMonth(year, month));
    return today.day > dueDay;
  }
  return false;
}

export type PaymentSchedule = {
  paymentDayOfMonth: number;
  daysLeft: number;
  overdueDays: number;
  nextDueDate: string;
  isDueSoon: boolean;
};

const DUE_SOON_WINDOW = 7;

/**
 * Har oyning shu kuni to'lov muddati (Toshkent vaqti).
 * daysLeft — keyingi/yoki shu oydagi to'lovga qolgan kun (0 = bugun).
 * overdueDays — shu oy to'lov kuni o'tgan bo'lsa, necha kun o'tgan.
 */
export function getPaymentSchedule(
  paymentDueDate: Date | null | undefined,
  now = new Date()
): PaymentSchedule | null {
  if (!paymentDueDate) return null;

  const today = getTashkentDateParts(now);
  const paymentDay = getPaymentDayOfMonth(paymentDueDate);
  const dueDayThisMonth = Math.min(paymentDay, daysInMonth(today.year, today.month));

  if (today.day <= dueDayThisMonth) {
    const daysLeft = dueDayThisMonth - today.day;
    return {
      paymentDayOfMonth: paymentDay,
      daysLeft,
      overdueDays: 0,
      nextDueDate: formatTashkentDate({
        year: today.year,
        month: today.month,
        day: dueDayThisMonth,
      }),
      isDueSoon: daysLeft <= DUE_SOON_WINDOW,
    };
  }

  const overdueDays = today.day - dueDayThisMonth;
  let nextMonth = today.month + 1;
  let nextYear = today.year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const dueDayNextMonth = Math.min(paymentDay, daysInMonth(nextYear, nextMonth));
  const daysLeft = dueDayNextMonth + (daysInMonth(today.year, today.month) - today.day);

  return {
    paymentDayOfMonth: paymentDay,
    daysLeft,
    overdueDays,
    nextDueDate: formatTashkentDate({
      year: nextYear,
      month: nextMonth,
      day: dueDayNextMonth,
    }),
    isDueSoon: overdueDays <= DUE_SOON_WINDOW,
  };
}

export function formatScheduleStatus(schedule: PaymentSchedule) {
  if (schedule.overdueDays > 0) {
    return `Muddati o'tgan (${schedule.overdueDays} kun)`;
  }
  if (schedule.daysLeft === 0) return "Bugun to'lov kuni";
  return `To'lovga ${schedule.daysLeft} kun qoldi`;
}

export { DUE_SOON_WINDOW };
