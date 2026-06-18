import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Raqamni kiritishda har 3 xonada bo'shliq bilan formatlaydi: 3000000 → "3 000 000" */
export function formatDigitsWithSpaces(value: string | number): string {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Formatlangan matndan raqam oladi: "3 000 000" → 3000000 */
export function parseDigits(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function formatCurrency(value: number, currency = "UZS") {
  const formatted = new Intl.NumberFormat("uz-UZ", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
  return `${formatted} ${currency}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(
    Number.isFinite(value) ? value : 0
  );
}

export function formatDate(value?: string | number | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** @username yoki t.me havolasini Telegram URL ga aylantiradi */
export function toTelegramUrl(handle: string): string | null {
  const trimmed = handle.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^t\.me\//i.test(trimmed)) return `https://${trimmed}`;
  const user = trimmed.replace(/^@/, "");
  if (!user) return null;
  return `https://t.me/${user}`;
}

export function getInitials(name?: string | null) {
  if (!name) return "AH";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
