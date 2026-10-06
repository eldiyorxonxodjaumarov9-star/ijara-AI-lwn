import { formatSom, type ReminderTimeSlot } from "@/lib/payment-reminder-utils";
import { UZ_LOCAL_DIGITS, toUzCanonical, uzLocalDigits } from "@/lib/uz-phone";
import { dayIndex } from "@/lib/vehicle-rentals";

export const MANUAL_DEBT_STATUSES = ["OPEN", "PARTIAL", "PAID", "CANCELLED"] as const;
export type ManualDebtStatus = (typeof MANUAL_DEBT_STATUSES)[number];

export const MANUAL_DEBT_STATUS_LABEL: Record<ManualDebtStatus, string> = {
  OPEN: "Ochiq",
  PARTIAL: "Qisman to‘langan",
  PAID: "To‘langan",
  CANCELLED: "Bekor qilingan",
};

export const OCCUPATION_SUGGESTIONS = [
  "IT firma",
  "Dizayner",
  "Logistika",
  "Advokat",
  "Marketing",
  "Boshqa",
];

export const AMOUNT_BELOW_PAID_MESSAGE = "Qarz summasi to‘langan summadan kam bo‘lishi mumkin emas";

/** Server RBAC "payments" siyosatiga mos: EMPLOYEE faqat ko'radi (frontend rollari mapApiRole bo'yicha). */
export function canManageManualDebts(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

export interface ManualDebtPaymentView {
  id: string;
  amount: number;
  paymentDate: string;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface ManualDebtView {
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  debtorName: string;
  debtorPhone: string | null;
  debtorOccupation: string | null;
  description: string | null;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  /** YYYY-MM-DD (Toshkent) */
  debtDate: string;
  status: ManualDebtStatus;
  telegramLinked: boolean;
  createdById: string | null;
  createdAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  payments?: ManualDebtPaymentView[];
}

export type ManualDebtInput = {
  propertyId: string | null;
  debtorName: string;
  debtorPhone: string | null;
  debtorOccupation: string | null;
  description: string | null;
  originalAmount: number;
  debtDate: string;
};
export type ManualDebtUpdateInput = Partial<ManualDebtInput>;
export type ManualDebtPaymentInput = { amount: number; paymentDate: string; notes: string | null };

type Parsed<T> = { data: T; error?: undefined } | { error: string; data?: undefined };

const MAX_AMOUNT = 1e12;

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseAmount(value: unknown, label: string): number | string {
  const n = typeof value === "string" ? Number(value.replace(/\s/g, "")) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return `${label} 0 dan katta bo‘lishi kerak`;
  if (n > MAX_AMOUNT) return `${label} juda katta`;
  return roundMoney(n);
}

function optionalText(value: unknown, max: number): string | null | { error: string } {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return { error: "Matn noto‘g‘ri" };
  const t = value.trim();
  if (t.length > max) return { error: `Matn ${max} belgidan oshmasin` };
  return t || null;
}

/** "+998901234567" yoki null. Noto'g'ri raqam — xato. */
export function normalizeDebtorPhone(value: unknown): string | null | { error: string } {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return { error: "Telefon noto‘g‘ri" };
  if (!value.trim()) return null;
  const digits = uzLocalDigits(value, { pasted: true });
  if (digits.length !== UZ_LOCAL_DIGITS) return { error: "Telefon formati: +998 90 123 45 67" };
  return toUzCanonical(digits);
}

function parseFields(b: Record<string, unknown>, partial: boolean): Parsed<ManualDebtUpdateInput> {
  const out: ManualDebtUpdateInput = {};

  if (!partial || b.debtorName !== undefined) {
    const name = typeof b.debtorName === "string" ? b.debtorName.trim() : "";
    if (!name) return { error: "Qarzdor nomi kiritilishi shart" };
    if (name.length > 200) return { error: "Qarzdor nomi 200 belgidan oshmasin" };
    out.debtorName = name;
  }
  if (!partial || b.originalAmount !== undefined) {
    const amount = parseAmount(b.originalAmount, "Qarzdorlik summasi");
    if (typeof amount === "string") return { error: amount };
    out.originalAmount = amount;
  }
  if (!partial || b.debtDate !== undefined) {
    if (dayIndex(b.debtDate) === null) return { error: "Qarzdorlik sanasi noto‘g‘ri (YYYY-MM-DD)" };
    out.debtDate = String(b.debtDate).trim();
  }
  if (!partial || b.propertyId !== undefined) {
    if (b.propertyId !== undefined && b.propertyId !== null && typeof b.propertyId !== "string") {
      return { error: "Xona noto‘g‘ri" };
    }
    out.propertyId = typeof b.propertyId === "string" && b.propertyId.trim() ? b.propertyId.trim() : null;
  }
  if (!partial || b.debtorPhone !== undefined) {
    const phone = normalizeDebtorPhone(b.debtorPhone);
    if (phone && typeof phone === "object") return { error: phone.error };
    out.debtorPhone = phone;
  }
  for (const [key, max] of [["debtorOccupation", 120], ["description", 2000]] as const) {
    if (!partial || b[key] !== undefined) {
      const text = optionalText(b[key], max);
      if (text && typeof text === "object") return { error: text.error };
      out[key] = text;
    }
  }
  return { data: out };
}

export function parseManualDebtCreate(body: unknown): Parsed<ManualDebtInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const parsed = parseFields(body as Record<string, unknown>, false);
  return parsed.error !== undefined ? parsed : { data: parsed.data as ManualDebtInput };
}

export function parseManualDebtUpdate(body: unknown): Parsed<ManualDebtUpdateInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  return parseFields(body as Record<string, unknown>, true);
}

export function parseManualDebtPayment(body: unknown, today: string): Parsed<ManualDebtPaymentInput> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const amount = parseAmount(b.amount, "To‘lov summasi");
  if (typeof amount === "string") return { error: amount };
  const paymentDate = b.paymentDate === undefined || b.paymentDate === "" ? today : String(b.paymentDate).trim();
  if (dayIndex(paymentDate) === null) return { error: "To‘lov sanasi noto‘g‘ri (YYYY-MM-DD)" };
  const notes = optionalText(b.notes, 1000);
  if (notes && typeof notes === "object") return { error: notes.error };
  return { data: { amount, paymentDate, notes } };
}

/** To'langan summaga ko'ra qoldiq va holat. */
export function deriveManualDebtState(originalAmount: number, paidAmount: number) {
  const remainingAmount = Math.max(0, roundMoney(originalAmount - paidAmount));
  const status: ManualDebtStatus =
    remainingAmount <= 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "OPEN";
  return { remainingAmount, status };
}

/** Faol (eslatma va /debts uchun): OPEN/PARTIAL va qoldiq > 0. */
export function isActiveManualDebt(d: Pick<ManualDebtView, "status" | "remainingAmount">) {
  return (d.status === "OPEN" || d.status === "PARTIAL") && d.remainingAmount > 0;
}

/** KPI: shartnoma qarzlari + faol qo'lda qarzlar (har yozuv bir marta). */
export function summarizeAllDebts(
  contractSummary: { totalDebtAmount: number; debtorContractCount: number },
  manualDebts: Pick<ManualDebtView, "id" | "status" | "remainingAmount">[]
) {
  const active = new Map(
    manualDebts.filter(isActiveManualDebt).map((d) => [d.id, d.remainingAmount])
  );
  let manualTotal = 0;
  for (const amount of active.values()) manualTotal += amount;
  return {
    totalDebtAmount: contractSummary.totalDebtAmount + manualTotal,
    debtRecordCount: contractSummary.debtorContractCount + active.size,
    manualDebtCount: active.size,
    manualDebtAmount: manualTotal,
  };
}

export type ManualDebtReminder = {
  manualDebtId: string;
  workspaceId: string;
  debtorName: string;
  propertyName: string | null;
  debtorOccupation: string | null;
  debtDate: string;
  remainingAmount: number;
};

const SLOT_GREETING: Record<ReminderTimeSlot, string> = {
  morning: "🌅 Xayrli tong!",
  lunch: "☀️ Xayrli kun!",
  evening: "🌙 Xayrli kech!",
};

function manualDebtLines(d: ManualDebtReminder, withAmount: boolean) {
  const lines: string[] = [];
  if (withAmount) lines.push(`• ${formatSom(d.remainingAmount)}`);
  if (d.propertyName) lines.push(`Xona: ${d.propertyName}`);
  if (d.debtorOccupation) lines.push(`Faoliyat: ${d.debtorOccupation}`);
  lines.push(`Qarzdorlik sanasi: ${d.debtDate}`);
  return lines.join("\n");
}

/** Faqat qo'lda kiritilgan qarz(lar) uchun eslatma. */
export function buildManualDebtReminderMessage(debts: ManualDebtReminder[], slot?: ReminderTimeSlot) {
  const total = debts.reduce((s, d) => s + d.remainingAmount, 0);
  const greeting = slot ? `${SLOT_GREETING[slot]} ` : "";
  const many = debts.length > 1;
  return [
    `${greeting}Assalomu alaykum, ${debts[0]!.debtorName}!`,
    `Sizda ${formatSom(total)} qarzdorlik mavjud.`,
    ...debts.map((d) => manualDebtLines(d, many)),
    "Iltimos, admin bilan bog'laning. — Ijara AI",
  ].join("\n");
}

/** Shartnoma eslatmasi + qo'lda qarzlar — bitta chat uchun bitta umumiy xabar. */
export function appendManualDebtsToReminder(
  contractMessage: string,
  contractDebt: number,
  debts: ManualDebtReminder[]
) {
  const total = contractDebt + debts.reduce((s, d) => s + d.remainingAmount, 0);
  return [
    contractMessage,
    "",
    "Qo‘shimcha qarzdorlik:",
    ...debts.map((d) => manualDebtLines(d, true)),
    `Jami qarzdorlik: ${formatSom(total)}.`,
  ].join("\n");
}
