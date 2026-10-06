/** `ExpenseCategory` values the app writes (the DB enum also holds unused legacy values). */
export const EXPENSE_CATEGORY_API_KEYS = [
  "UTILITIES",
  "SALARY",
  "TAX",
  "REPAIR",
  "MARKETING",
  "ADVANCE",
  "OTHER",
] as const;
export type ExpenseCategoryApiKey = (typeof EXPENSE_CATEGORY_API_KEYS)[number];

/** DB values of `MonthlyExpenseType`. */
export const MONTHLY_EXPENSE_TYPE_API_KEYS = [
  "WATER",
  "ELECTRICITY",
  "OFFICE",
  "CUSTOM",
  "WASTE_SERVICE",
  "GAS",
  "INTERNET",
  "TAX",
] as const;
export type MonthlyExpenseTypeApiKey = (typeof MONTHLY_EXPENSE_TYPE_API_KEYS)[number];

function parseKey<T extends string>(keys: readonly T[], value: unknown): T | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toUpperCase();
  return (keys as readonly string[]).includes(key) ? (key as T) : null;
}

/** Accepts the API (UPPER) or client (lower) form; returns the DB key or null when unknown. */
export function parseExpenseCategory(value: unknown): ExpenseCategoryApiKey | null {
  return parseKey(EXPENSE_CATEGORY_API_KEYS, value);
}

export function parseMonthlyExpenseType(value: unknown): MonthlyExpenseTypeApiKey | null {
  return parseKey(MONTHLY_EXPENSE_TYPE_API_KEYS, value);
}
