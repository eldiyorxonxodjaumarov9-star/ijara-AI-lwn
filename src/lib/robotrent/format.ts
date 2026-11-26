import { EMPTY_VALUE_LABEL } from "@/lib/robotrent/constants";

export function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EMPTY_VALUE_LABEL;
}

export function displayNumber(
  value: { toString(): string } | number | null | undefined,
  suffix = ""
) {
  if (value === null || value === undefined) return EMPTY_VALUE_LABEL;
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) return EMPTY_VALUE_LABEL;
  return `${n.toLocaleString("uz-UZ")}${suffix}`;
}

export function displayDate(value: Date | string | null | undefined) {
  if (!value) return EMPTY_VALUE_LABEL;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY_VALUE_LABEL;
  return d.toLocaleDateString("uz-UZ");
}