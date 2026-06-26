export interface DebtReminderInput {
  contractId: string;
  tenantId?: string;
  tenantName: string;
  propertyName: string;
  debt: number;
}

/** Kunlik eslatma vaqti (Toshkent) */
export type ReminderTimeSlot = "morning" | "lunch" | "evening";

const SLOT_GREETING: Record<ReminderTimeSlot, string> = {
  morning: "🌅 Xayrli tong!",
  lunch: "☀️ Xayrli kun!",
  evening: "🌙 Xayrli kech!",
};

export function formatUzs(amount: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(amount)) + " UZS";
}

export function buildPaymentReminderMessage(
  d: {
    tenantName: string;
    propertyName: string;
    debt: number;
    propertyCount?: number;
  },
  slot?: ReminderTimeSlot
) {
  const place =
    d.propertyCount && d.propertyCount > 1
      ? `${d.propertyCount} ta shartnoma bo'yicha`
      : `${d.propertyName} bo'yicha`;
  const greeting = slot ? `${SLOT_GREETING[slot]} ` : "";
  return (
    `${greeting}Assalomu alaykum, ${d.tenantName}! ${place} qarzdorlik mavjud. ` +
    `Iltimos, admin bilan bog'laning. Qarzdorlikni o'z vaqtida to'lang va keyingi oylarda ham o'z vaqtida to'lab boring. — ArendaAi`
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
    } else {
      byTenant.set(key, { ...d, propertyCount: 1 });
    }
  }

  return [...byTenant.values()];
}
