import { MONTHLY_EXPENSE_TYPE_CATEGORY } from "@/lib/constants";
import type { ExpenseCategory, MonthlyExpenseType } from "@/types";

/** Final category + monthly type: outside worker pay the monthly type decides the category. */
export function resolveExpenseCategory(input: {
  category: ExpenseCategory;
  monthlyExpenseType: MonthlyExpenseType | null | undefined;
  isWorkerPay: boolean;
}): { category: ExpenseCategory; monthlyExpenseType: MonthlyExpenseType | null } {
  const monthly = input.monthlyExpenseType || null;
  if (input.isWorkerPay) return { category: input.category, monthlyExpenseType: null };
  return {
    category: (monthly && MONTHLY_EXPENSE_TYPE_CATEGORY[monthly]) || input.category,
    monthlyExpenseType: monthly,
  };
}

/** New non-salary expenses must pick a monthly type; old records may be edited without one. */
export function monthlyTypeRequired(input: { isNew: boolean; isWorkerPay: boolean }) {
  return input.isNew && !input.isWorkerPay;
}
