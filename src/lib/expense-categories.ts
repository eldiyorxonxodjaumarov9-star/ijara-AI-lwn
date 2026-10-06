/** DB enum values of `ExpenseCategory` (server/prisma/schema.prisma). */
export const EXPENSE_CATEGORY_API_KEYS = [
  "UTILITIES",
  "SALARY",
  "TAX",
  "REPAIR",
  "MARKETING",
  "ADVANCE",
  "OTHER",
  "WASTE_SERVICE",
  "ELECTRICITY",
  "WATER",
  "GAS",
  "INTERNET",
] as const;
export type ExpenseCategoryApiKey = (typeof EXPENSE_CATEGORY_API_KEYS)[number];

const API_KEYS = new Set<string>(EXPENSE_CATEGORY_API_KEYS);

/** Accepts the API (UPPER) or client (lower) form; returns the DB key or null when unknown. */
export function parseExpenseCategory(value: unknown): ExpenseCategoryApiKey | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toUpperCase();
  return API_KEYS.has(key) ? (key as ExpenseCategoryApiKey) : null;
}
