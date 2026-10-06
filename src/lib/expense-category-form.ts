import { MONTHLY_EXPENSE_TYPE_CATEGORY, SELF_DESCRIBING_EXPENSE_CATEGORIES } from "@/lib/constants";
import type { ExpenseCategory, MonthlyExpenseType } from "@/types";

export function isSelfDescribingCategory(category: ExpenseCategory) {
  return SELF_DESCRIBING_EXPENSE_CATEGORIES.has(category);
}

/**
 * Final category + monthly type for the expense form.
 * Self-describing categories (Elektr/Suv/Gaz/Internet/Maishiy chiqindi/Soliq) are kept as chosen
 * and never overwritten by the monthly type; an edited record that keeps its category keeps its
 * old monthly type untouched.
 */
export function resolveExpenseCategory(input: {
  category: ExpenseCategory;
  monthlyExpenseType: MonthlyExpenseType | null | undefined;
  isWorkerPay: boolean;
  originalCategory?: ExpenseCategory;
}): { category: ExpenseCategory; monthlyExpenseType: MonthlyExpenseType | null } {
  const monthly = input.monthlyExpenseType || null;
  if (input.isWorkerPay) return { category: input.category, monthlyExpenseType: null };
  if (isSelfDescribingCategory(input.category)) {
    const unchanged = input.originalCategory === input.category;
    return { category: input.category, monthlyExpenseType: unchanged ? monthly : null };
  }
  return {
    category: (monthly && MONTHLY_EXPENSE_TYPE_CATEGORY[monthly]) || input.category,
    monthlyExpenseType: monthly,
  };
}

/** New non-salary expenses must pick a monthly type unless the category already names the expense. */
export function monthlyTypeRequired(input: {
  isNew: boolean;
  isWorkerPay: boolean;
  category: ExpenseCategory;
}) {
  return input.isNew && !input.isWorkerPay && !isSelfDescribingCategory(input.category);
}
