import { MONTHLY_EXPENSE_TYPE_MAP } from "@/lib/constants";
import type { Expense, MonthlyExpenseType } from "@/types";

const MONTHLY_TYPES = new Set<MonthlyExpenseType>([
  "water",
  "electricity",
  "office",
  "custom",
]);

export function isMonthlyExpenseType(v: unknown): v is MonthlyExpenseType {
  return typeof v === "string" && MONTHLY_TYPES.has(v as MonthlyExpenseType);
}

export function resolveMonthlyExpenseLabel(
  type?: MonthlyExpenseType | null,
  customName?: string | null
): string | undefined {
  if (!type) return undefined;
  if (type === "custom") {
    const name = customName?.trim();
    return name || undefined;
  }
  return MONTHLY_EXPENSE_TYPE_MAP[type];
}

/** Jadval / PDF uchun: ishchi · oylik tur · izoh */
export function formatExpenseDetail(expense: Expense): string {
  const parts: string[] = [];
  const employee = expense.employeeName?.trim();
  const typeLabel =
    expense.monthlyExpenseLabel?.trim() ||
    resolveMonthlyExpenseLabel(
      expense.monthlyExpenseType,
      expense.monthlyExpenseCustomName
    );
  const note = expense.note?.trim();

  if (employee) parts.push(employee);
  if (typeLabel) parts.push(typeLabel);
  if (note && note !== employee && note !== typeLabel) {
    parts.push(note);
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}
