/**
 * Xodimlar moduli — Sunnur/LWN kompaniya ajratish va lavozimlar.
 * Canonical: PartnerCompany.name orqali (companyId FK).
 */

export const EMPLOYEE_UNIT = {
  SUNNUR: "Sunnur",
  LWN: "LWN",
} as const;

export type EmployeeUnitKey = keyof typeof EMPLOYEE_UNIT;
export type EmployeeUnitName =
  (typeof EMPLOYEE_UNIT)[EmployeeUnitKey];

export const EMPLOYEE_POSITIONS = [
  "Farrosh",
  "Menejer",
  "Oshpaz",
  "Resepsion",
  "Xona xizmati",
  "Qo‘riqlash",
  "Bog‘bon",
  "Texnik xodim",
  "Boshqa",
] as const;

export type EmployeePosition = (typeof EMPLOYEE_POSITIONS)[number];

export function normalizeEmployeePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 9 && digits.startsWith("9")) return `998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return digits;
  if (digits.length >= 9) return digits;
  return null;
}

export function isSunnurCompanyName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return n === "sunnur" || n.includes("sunnur");
}

export function isLwnCompanyName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return n === "lwn" || n.includes("lwn") || n.includes("live work");
}

export function matchEmployeeUnit(
  companyName: string | null | undefined
): EmployeeUnitName | null {
  if (isSunnurCompanyName(companyName)) return EMPLOYEE_UNIT.SUNNUR;
  if (isLwnCompanyName(companyName)) return EMPLOYEE_UNIT.LWN;
  return null;
}

export function positionLabel(position: string | null | undefined): string {
  const p = (position ?? "").trim();
  if (!p) return "—";
  const found = EMPLOYEE_POSITIONS.find(
    (x) => x.toLowerCase() === p.toLowerCase()
  );
  return found ?? p;
}
