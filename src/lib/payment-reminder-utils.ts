export interface DebtReminderInput {
  contractId: string;
  tenantId?: string;
  tenantName: string;
  propertyName: string;
  debt: number;
  overdueDays?: number;
  monthsDue?: number;
  /** Qoldig'i > 0 bo'lgan oylar soni */
  unpaidMonths?: number;
  /** Eng eski yopilmagan oy to'lov sanasi (YYYY-MM-DD) */
  oldestUnpaidDueDate?: string | null;
}

/** Kunlik eslatma vaqti (Toshkent) */
export type ReminderTimeSlot = "morning" | "lunch" | "evening";

const SLOT_GREETING: Record<ReminderTimeSlot, string> = {
  morning: "🌅 Xayrli tong!",
  lunch: "☀️ Xayrli kun!",
  evening: "🌙 Xayrli kech!",
};

export const MONTHS_UZ = [
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

export function formatUzs(amount: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(amount)) + " UZS";
}

/** "1 600 000 so‘m" — oddiy bo'shliq bilan */
export function formatSom(amount: number) {
  const n = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n} so‘m`;
}

/** "2026-08-05" → "Avgust 2026" */
export function formatPeriodLabel(dueDate: string) {
  const [y, m] = dueDate.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return dueDate;
  return `${MONTHS_UZ[m - 1]} ${y}`;
}

export function buildPaymentReminderMessage(
  d: {
    tenantName: string;
    propertyName: string;
    debt: number;
    propertyCount?: number;
    unpaidMonths?: number;
    oldestUnpaidDueDate?: string | null;
    overdueDays?: number;
  },
  slot?: ReminderTimeSlot
) {
  const place =
    d.propertyCount && d.propertyCount > 1
      ? `${d.propertyCount} ta shartnoma bo'yicha`
      : `${d.propertyName} bo'yicha`;
  const greeting = slot ? `${SLOT_GREETING[slot]} ` : "";
  const months =
    d.unpaidMonths && d.unpaidMonths > 0 ? `${d.unpaidMonths} oy bo‘yicha ` : "";
  let details = "";
  if (d.oldestUnpaidDueDate) {
    details = ` Eng eski qarz: ${formatPeriodLabel(d.oldestUnpaidDueDate)}`;
    if (d.overdueDays && d.overdueDays > 0) {
      details += ` (${d.overdueDays} kun kechikkan)`;
    }
    details += ".";
  }
  return (
    `${greeting}Assalomu alaykum, ${d.tenantName}! ${place} sizda ${months}${formatSom(d.debt)} qarzdorlik mavjud.${details} ` +
    `Iltimos, admin bilan bog'laning. Qarzdorlikni o'z vaqtida to'lang va keyingi oylarda ham o'z vaqtida to'lab boring. — Ijara AI`
  );
}

/** Har bir ijarachiga bitta xabar (bir nechta shartnoma bo'lsa qarz yig'indisi) */
export function groupDebtsByTenant(debts: DebtReminderInput[]) {
  const byTenant = new Map<
    string,
    DebtReminderInput & { propertyCount: number }
  >();

  for (const d of debts) {
    if (d.debt <= 0) continue;
    const key = d.tenantId ?? d.tenantName;
    const existing = byTenant.get(key);
    if (existing) {
      existing.debt += d.debt;
      existing.propertyCount += 1;
      existing.unpaidMonths = (existing.unpaidMonths ?? 0) + (d.unpaidMonths ?? 0);
      existing.overdueDays = Math.max(existing.overdueDays ?? 0, d.overdueDays ?? 0);
      if (
        d.oldestUnpaidDueDate &&
        (!existing.oldestUnpaidDueDate ||
          d.oldestUnpaidDueDate < existing.oldestUnpaidDueDate)
      ) {
        existing.oldestUnpaidDueDate = d.oldestUnpaidDueDate;
      }
    } else {
      byTenant.set(key, { ...d, propertyCount: 1 });
    }
  }

  return [...byTenant.values()];
}
