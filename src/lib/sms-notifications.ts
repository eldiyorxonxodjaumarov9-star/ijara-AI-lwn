import type { SmsNotificationSettings } from "@/types/sms-notifications";

export const SMS_KIND_LABELS: Record<keyof SmsNotificationSettings, string> = {
  dueSoon: "To'lov muddati yaqinlashishi",
  debtReminder: "Qarzdorlik eslatmasi",
  paymentReceived: "To'lov qabul qilinganligi",
  general: "Umumiy xabarlar",
};

export const DEFAULT_SMS_SETTINGS: SmsNotificationSettings = {
  dueSoon: true,
  debtReminder: true,
  paymentReceived: false,
  general: false,
};

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateTenantPhone(phone: string): {
  valid: boolean;
  reason?: string;
} {
  const raw = phone?.trim() ?? "";
  if (!raw) {
    return { valid: false, reason: "Telefon raqami kiritilmagan" };
  }
  const digits = normalizePhoneDigits(raw);
  if (digits.length < 9) {
    return { valid: false, reason: "Telefon raqami juda qisqa" };
  }
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (local.length !== 9) {
    return { valid: false, reason: "Format noto'g'ri (9 raqamli mobil raqam)" };
  }
  if (!local.startsWith("9")) {
    return { valid: false, reason: "Mobil raqam 9 bilan boshlanishi kerak" };
  }
  return { valid: true };
}

export function formatPhoneDisplay(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (local.length === 9) {
    return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  }
  return phone.trim() || "—";
}

export function enabledSmsKindLabels(settings: SmsNotificationSettings): string[] {
  return (Object.keys(SMS_KIND_LABELS) as (keyof SmsNotificationSettings)[])
    .filter((key) => settings[key])
    .map((key) => SMS_KIND_LABELS[key]);
}

export function smsPreviewText(message: string, tenantName?: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Matn kiritilmagan…";
  if (tenantName) {
    return `[${tenantName}] ${trimmed}`;
  }
  return trimmed;
}
