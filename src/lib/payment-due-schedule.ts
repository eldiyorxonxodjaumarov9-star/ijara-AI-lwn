const TASHKENT_TZ = "Asia/Tashkent";

export type TashkentDateParts = { year: number; month: number; day: number };

export function getTashkentDateParts(date = new Date()): TashkentDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TASHKENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const raw = formatter.format(date);
  const [year, month, day] = raw.split("-").map(Number);
  return { year, month, day };
}

export function formatTashkentDate(parts: TashkentDateParts) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
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

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Bazadagi sana maydonidan oyning to'lov kuni (1–31) */
export function getPaymentDayOfMonth(paymentDueDate: Date) {
  return paymentDueDate.getUTCDate();
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
