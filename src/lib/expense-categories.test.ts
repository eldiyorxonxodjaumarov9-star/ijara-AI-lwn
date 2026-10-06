import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAPPERS } from "@/lib/api/mappers";
import {
  EXPENSE_CATEGORY_GROUPS,
  EXPENSE_CATEGORY_MAP,
  SELF_DESCRIBING_EXPENSE_CATEGORIES,
} from "@/lib/constants";
import { EXPENSE_CATEGORY_API_KEYS, parseExpenseCategory } from "@/lib/expense-categories";
import { monthlyTypeRequired, resolveExpenseCategory } from "@/lib/expense-category-form";
import {
  expenseFilterOptions,
  filterExpenseRows,
  listExpenseRows,
  sumRealExpenses,
} from "@/lib/monthly-comparison";
import { expenseSchema } from "@/lib/validations";
import type { Expense, ExpenseCategory } from "@/types";

const NEW = {
  waste_service: "Maishiy chiqindi ta’minoti",
  electricity: "Elektr ta’minoti",
  water: "Suv ta’minoti",
  gas: "Gaz ta’minoti",
  internet: "Internet ta’minoti",
  tax: "Soliq",
} as const satisfies Partial<Record<ExpenseCategory, string>>;
const OLD: ExpenseCategory[] = ["utilities", "salary", "tax", "repair", "marketing", "advance", "other"];
const ALL = Object.keys(EXPENSE_CATEGORY_MAP) as ExpenseCategory[];

const mapper = MAPPERS.expenses!;
const expense = (id: string, category: ExpenseCategory, amount: number, extra: Partial<Expense> = {}): Expense => ({
  id,
  category,
  amount,
  date: "2026-07-15T10:00:00+05:00",
  createdAt: "2026-07-15T10:00:00+05:00",
  ...extra,
});

describe("expense categories: catalogue", () => {
  it("6 utility/tax categories have Uzbek Latin labels", () => {
    for (const [key, label] of Object.entries(NEW)) {
      assert.equal(EXPENSE_CATEGORY_MAP[key as ExpenseCategory], label, key);
    }
  });

  it("existing categories keep their keys and labels; TAX is reused, not duplicated", () => {
    assert.deepEqual(
      Object.fromEntries(OLD.map((k) => [k, EXPENSE_CATEGORY_MAP[k]])),
      { utilities: "Kommunal", salary: "Maosh", tax: "Soliq", repair: "Ta'mirlash", marketing: "Marketing", advance: "Avans", other: "Boshqa" }
    );
    assert.equal(EXPENSE_CATEGORY_API_KEYS.filter((k) => k === "TAX").length, 1);
    assert.equal(new Set(EXPENSE_CATEGORY_API_KEYS).size, EXPENSE_CATEGORY_API_KEYS.length);
    assert.equal(ALL.length, 12);
  });

  it("groups: Kommunal xizmatlar / Majburiy to‘lovlar / Boshqa — every category exactly once", () => {
    assert.deepEqual(EXPENSE_CATEGORY_GROUPS.map((g) => g.label), ["Kommunal xizmatlar", "Majburiy to‘lovlar", "Boshqa xarajatlar"]);
    assert.deepEqual(EXPENSE_CATEGORY_GROUPS[0].categories.slice(0, 5), ["waste_service", "electricity", "water", "gas", "internet"]);
    assert.deepEqual(EXPENSE_CATEGORY_GROUPS[1].categories, ["tax"]);
    const grouped = EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.categories);
    assert.equal(grouped.length, ALL.length);
    assert.deepEqual([...grouped].sort(), [...ALL].sort());
  });

  it("client ↔ API mapping round-trips every category; unknown API value falls back to Boshqa", () => {
    for (const key of ALL) {
      const api = mapper.toCreate({ category: key, amount: 1, date: "2026-07-01" }).category as string;
      assert.equal(api, key.toUpperCase());
      assert.ok((EXPENSE_CATEGORY_API_KEYS as readonly string[]).includes(api));
      assert.equal((mapper.fromApi({ id: "x", category: api, amount: 1 }) as Expense).category, key);
    }
    assert.equal((mapper.fromApi({ id: "x", category: "LEGACY_THING", amount: 1 }) as Expense).category, "other");
  });

  it("server parser accepts known keys in either case and rejects unknown", () => {
    assert.equal(parseExpenseCategory("gas"), "GAS");
    assert.equal(parseExpenseCategory("WASTE_SERVICE"), "WASTE_SERVICE");
    assert.equal(parseExpenseCategory("UTILITIES"), "UTILITIES");
    assert.equal(parseExpenseCategory("electric"), null);
    assert.equal(parseExpenseCategory(42), null);
  });

  it("form schema accepts all 12 categories", () => {
    for (const category of ALL) {
      assert.ok(expenseSchema.safeParse({ category, amount: 1000, date: "2026-07-01", employeeId: "emp-1" }).success, category);
    }
  });
});

describe("expense categories: form resolution", () => {
  it("self-describing categories are kept and skip the monthly-type step", () => {
    for (const category of Object.keys(NEW) as ExpenseCategory[]) {
      assert.ok(SELF_DESCRIBING_EXPENSE_CATEGORIES.has(category));
      assert.equal(monthlyTypeRequired({ isNew: true, isWorkerPay: false, category }), false);
      assert.deepEqual(
        resolveExpenseCategory({ category, monthlyExpenseType: "custom", isWorkerPay: false }),
        { category, monthlyExpenseType: null }
      );
    }
  });

  it("edit keeps an old record's monthly type when its category is unchanged", () => {
    assert.deepEqual(
      resolveExpenseCategory({ category: "tax", monthlyExpenseType: "custom", isWorkerPay: false, originalCategory: "tax" }),
      { category: "tax", monthlyExpenseType: "custom" }
    );
    assert.deepEqual(
      resolveExpenseCategory({ category: "gas", monthlyExpenseType: "water", isWorkerPay: false, originalCategory: "utilities" }),
      { category: "gas", monthlyExpenseType: null }
    );
  });

  it("old categories behave exactly as before", () => {
    assert.equal(monthlyTypeRequired({ isNew: true, isWorkerPay: false, category: "utilities" }), true);
    assert.equal(monthlyTypeRequired({ isNew: false, isWorkerPay: false, category: "utilities" }), false);
    assert.equal(monthlyTypeRequired({ isNew: true, isWorkerPay: true, category: "salary" }), false);
    assert.deepEqual(resolveExpenseCategory({ category: "utilities", monthlyExpenseType: "water", isWorkerPay: false }), { category: "utilities", monthlyExpenseType: "water" });
    assert.deepEqual(resolveExpenseCategory({ category: "repair", monthlyExpenseType: "custom", isWorkerPay: false }), { category: "other", monthlyExpenseType: "custom" });
    assert.deepEqual(resolveExpenseCategory({ category: "salary", monthlyExpenseType: "water", isWorkerPay: true }), { category: "salary", monthlyExpenseType: null });
  });
});

describe("expense categories: reports and filters", () => {
  const ym = { year: 2026, month: 7 };
  const rows = [
    expense("e1", "electricity", 300_000),
    expense("e2", "electricity", 200_000),
    expense("e3", "water", 150_000),
    expense("e4", "gas", 90_000),
    expense("e5", "internet", 120_000),
    expense("e6", "waste_service", 40_000),
    expense("e7", "tax", 1_000_000),
    expense("e8", "utilities", 700_000, { monthlyExpenseType: "water" }),
    expense("e9", "repair", 50_000),
  ];

  it("aggregation sums per new category; old monthly-typed rows keep their own bucket", () => {
    const { total, count, byCategory } = sumRealExpenses(rows, ym);
    assert.equal(count, 9);
    assert.equal(total, 2_650_000);
    assert.equal(byCategory.get("cat:electricity"), 500_000);
    assert.equal(byCategory.get("cat:water"), 150_000);
    assert.equal(byCategory.get("cat:gas"), 90_000);
    assert.equal(byCategory.get("cat:internet"), 120_000);
    assert.equal(byCategory.get("cat:waste_service"), 40_000);
    assert.equal(byCategory.get("cat:tax"), 1_000_000);
    assert.equal(byCategory.get("monthly:water"), 700_000);
    assert.equal(byCategory.get("cat:repair"), 50_000);
  });

  it("report rows carry the Uzbek category label", () => {
    const list = listExpenseRows(rows, ym);
    const label = (id: string) => list.find((r) => r.id === id)?.categoryLabel;
    assert.equal(label("e1"), "Elektr ta’minoti");
    assert.equal(label("e4"), "Gaz ta’minoti");
    assert.equal(label("e6"), "Maishiy chiqindi ta’minoti");
    assert.equal(label("e7"), "Soliq");
    assert.equal(label("e8"), "Kommunal");
    assert.equal(list.find((r) => r.id === "e5")?.typeLabel, "Internet ta’minoti");
  });

  it("filter options list every category and filter rows by it", () => {
    const options = expenseFilterOptions();
    for (const [key, label] of Object.entries(NEW)) {
      assert.ok(options.some((o) => o.value === `cat:${key}` && o.label === label), key);
    }
    const list = listExpenseRows(rows, ym);
    assert.deepEqual(filterExpenseRows(list, { filter: "cat:electricity" }).map((r) => r.id).sort(), ["e1", "e2"]);
    assert.deepEqual(filterExpenseRows(list, { filter: "cat:tax" }).map((r) => r.id), ["e7"]);
    assert.deepEqual(filterExpenseRows(list, { filter: "monthly:water" }).map((r) => r.id), ["e8"]);
    assert.deepEqual(filterExpenseRows(list, { filter: "cat:utilities" }).map((r) => r.id), ["e8"]);
  });
});
