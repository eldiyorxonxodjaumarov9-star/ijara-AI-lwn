import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAPPERS } from "@/lib/api/mappers";
import {
  EXPENSE_CATEGORY_MAP,
  MONTHLY_EXPENSE_TYPE_CATEGORY,
  MONTHLY_EXPENSE_TYPE_GROUPS,
  MONTHLY_EXPENSE_TYPE_MAP,
} from "@/lib/constants";
import {
  MONTHLY_EXPENSE_TYPE_API_KEYS,
  parseExpenseCategory,
  parseMonthlyExpenseType,
} from "@/lib/expense-categories";
import { monthlyTypeRequired, resolveExpenseCategory } from "@/lib/expense-category-form";
import {
  expenseFilterOptions,
  filterExpenseRows,
  listExpenseRows,
  sumRealExpenses,
} from "@/lib/monthly-comparison";
import { isMonthlyExpenseType } from "@/lib/monthly-expense-type";
import { expenseSchema } from "@/lib/validations";
import type { Expense, ExpenseCategory, MonthlyExpenseType } from "@/types";

const NEW = {
  waste_service: "Maishiy chiqindi ta’minoti",
  electricity: "Elektr ta’minoti",
  water: "Suv ta’minoti",
  gas: "Gaz ta’minoti",
  internet: "Internet ta’minoti",
  tax: "Soliq",
} as const satisfies Partial<Record<MonthlyExpenseType, string>>;
const ALL_TYPES = Object.keys(MONTHLY_EXPENSE_TYPE_MAP) as MonthlyExpenseType[];

const mapper = MAPPERS.expenses!;
const expense = (id: string, monthlyExpenseType: MonthlyExpenseType | undefined, amount: number, category: ExpenseCategory = "utilities"): Expense => ({
  id,
  category,
  amount,
  monthlyExpenseType,
  date: "2026-07-15T10:00:00+05:00",
  createdAt: "2026-07-15T10:00:00+05:00",
});

describe("monthly expense types: catalogue", () => {
  it("6 utility/tax types have Uzbek Latin labels; WATER/ELECTRICITY keys are reused", () => {
    for (const [key, label] of Object.entries(NEW)) {
      assert.equal(MONTHLY_EXPENSE_TYPE_MAP[key as MonthlyExpenseType], label, key);
    }
    assert.equal(MONTHLY_EXPENSE_TYPE_API_KEYS.filter((k) => k === "WATER").length, 1);
    assert.equal(MONTHLY_EXPENSE_TYPE_API_KEYS.filter((k) => k === "ELECTRICITY").length, 1);
    assert.equal(new Set(MONTHLY_EXPENSE_TYPE_API_KEYS).size, MONTHLY_EXPENSE_TYPE_API_KEYS.length);
    assert.equal(MONTHLY_EXPENSE_TYPE_MAP.office, "Ofis jihozlari");
    assert.equal(MONTHLY_EXPENSE_TYPE_MAP.custom, "Boshqa");
  });

  it("expense categories are unchanged — the new types are not categories", () => {
    assert.deepEqual(EXPENSE_CATEGORY_MAP, {
      utilities: "Kommunal", salary: "Maosh", tax: "Soliq", repair: "Ta'mirlash",
      marketing: "Marketing", advance: "Avans", other: "Boshqa",
    });
    assert.equal(parseExpenseCategory("GAS"), null);
    assert.equal(parseExpenseCategory("utilities"), "UTILITIES");
  });

  it("groups: Kommunal xizmatlar / Majburiy to‘lovlar / Boshqa — every type exactly once", () => {
    assert.deepEqual(MONTHLY_EXPENSE_TYPE_GROUPS.map((g) => g.label), ["Kommunal xizmatlar", "Majburiy to‘lovlar", "Boshqa"]);
    assert.deepEqual(MONTHLY_EXPENSE_TYPE_GROUPS[0].types, ["waste_service", "electricity", "water", "gas", "internet"]);
    assert.deepEqual(MONTHLY_EXPENSE_TYPE_GROUPS[1].types, ["tax"]);
    const grouped = MONTHLY_EXPENSE_TYPE_GROUPS.flatMap((g) => g.types);
    assert.deepEqual([...grouped].sort(), [...ALL_TYPES].sort());
  });

  it("utilities map to Kommunal, Soliq maps to the existing TAX category", () => {
    for (const t of ["waste_service", "electricity", "water", "gas", "internet"] as const) {
      assert.equal(MONTHLY_EXPENSE_TYPE_CATEGORY[t], "utilities", t);
    }
    assert.equal(MONTHLY_EXPENSE_TYPE_CATEGORY.tax, "tax");
    assert.equal(MONTHLY_EXPENSE_TYPE_CATEGORY.office, "other");
    assert.equal(MONTHLY_EXPENSE_TYPE_CATEGORY.custom, "other");
  });

  it("client ↔ API mapping round-trips every monthly type", () => {
    for (const type of ALL_TYPES) {
      const api = mapper.toCreate({ category: "utilities", amount: 1, date: "2026-07-01", monthlyExpenseType: type }).monthlyType as string;
      assert.equal(api, type.toUpperCase());
      assert.ok((MONTHLY_EXPENSE_TYPE_API_KEYS as readonly string[]).includes(api));
      assert.equal((mapper.fromApi({ id: "x", category: "UTILITIES", amount: 1, monthlyType: api }) as Expense).monthlyExpenseType, type);
      assert.ok(isMonthlyExpenseType(type));
    }
  });

  it("server parser and form schema accept all 8 types and reject unknown", () => {
    assert.equal(parseMonthlyExpenseType("gas"), "GAS");
    assert.equal(parseMonthlyExpenseType("TAX"), "TAX");
    assert.equal(parseMonthlyExpenseType("sewage"), null);
    for (const monthlyExpenseType of ALL_TYPES) {
      const res = expenseSchema.safeParse({
        category: "utilities", amount: 1000, date: "2026-07-01", monthlyExpenseType,
        monthlyExpenseCustomName: monthlyExpenseType === "custom" ? "X" : "",
      });
      assert.ok(res.success, monthlyExpenseType);
    }
  });
});

describe("monthly expense types: form resolution", () => {
  it("choosing a new type sets the right category", () => {
    assert.deepEqual(resolveExpenseCategory({ category: "repair", monthlyExpenseType: "gas", isWorkerPay: false }), { category: "utilities", monthlyExpenseType: "gas" });
    assert.deepEqual(resolveExpenseCategory({ category: "utilities", monthlyExpenseType: "tax", isWorkerPay: false }), { category: "tax", monthlyExpenseType: "tax" });
  });

  it("old behaviour is unchanged", () => {
    assert.equal(monthlyTypeRequired({ isNew: true, isWorkerPay: false }), true);
    assert.equal(monthlyTypeRequired({ isNew: false, isWorkerPay: false }), false);
    assert.equal(monthlyTypeRequired({ isNew: true, isWorkerPay: true }), false);
    assert.deepEqual(resolveExpenseCategory({ category: "utilities", monthlyExpenseType: "water", isWorkerPay: false }), { category: "utilities", monthlyExpenseType: "water" });
    assert.deepEqual(resolveExpenseCategory({ category: "repair", monthlyExpenseType: "custom", isWorkerPay: false }), { category: "other", monthlyExpenseType: "custom" });
    assert.deepEqual(resolveExpenseCategory({ category: "salary", monthlyExpenseType: "water", isWorkerPay: true }), { category: "salary", monthlyExpenseType: null });
  });
});

describe("monthly expense types: reports and filters", () => {
  const ym = { year: 2026, month: 7 };
  const rows = [
    expense("e1", "electricity", 300_000),
    expense("e2", "electricity", 200_000),
    expense("e3", "water", 150_000),
    expense("e4", "gas", 90_000),
    expense("e5", "internet", 120_000),
    expense("e6", "waste_service", 40_000),
    expense("e7", "tax", 1_000_000, "tax"),
    expense("e8", undefined, 700_000, "utilities"),
    expense("e9", undefined, 50_000, "repair"),
  ];

  it("aggregation sums per monthly type; old rows without a type keep their category bucket", () => {
    const { total, count, byCategory } = sumRealExpenses(rows, ym);
    assert.equal(count, 9);
    assert.equal(total, 2_650_000);
    assert.equal(byCategory.get("monthly:electricity"), 500_000);
    assert.equal(byCategory.get("monthly:water"), 150_000);
    assert.equal(byCategory.get("monthly:gas"), 90_000);
    assert.equal(byCategory.get("monthly:internet"), 120_000);
    assert.equal(byCategory.get("monthly:waste_service"), 40_000);
    assert.equal(byCategory.get("monthly:tax"), 1_000_000);
    assert.equal(byCategory.get("cat:utilities"), 700_000);
    assert.equal(byCategory.get("cat:repair"), 50_000);
  });

  it("report rows carry the Uzbek type label", () => {
    const list = listExpenseRows(rows, ym);
    const label = (id: string) => list.find((r) => r.id === id)?.typeLabel;
    assert.equal(label("e1"), "Elektr ta’minoti");
    assert.equal(label("e4"), "Gaz ta’minoti");
    assert.equal(label("e6"), "Maishiy chiqindi ta’minoti");
    assert.equal(label("e7"), "Soliq");
    assert.equal(label("e8"), "Kommunal");
  });

  it("filter options list every type and filter rows by it", () => {
    const options = expenseFilterOptions();
    for (const [key, label] of Object.entries(NEW)) {
      assert.ok(options.some((o) => o.value === `monthly:${key}` && o.label === label), key);
    }
    assert.ok(!options.some((o) => o.value === "cat:gas"));
    const list = listExpenseRows(rows, ym);
    assert.deepEqual(filterExpenseRows(list, { filter: "monthly:electricity" }).map((r) => r.id).sort(), ["e1", "e2"]);
    assert.deepEqual(filterExpenseRows(list, { filter: "monthly:tax" }).map((r) => r.id), ["e7"]);
    assert.deepEqual(filterExpenseRows(list, { filter: "cat:tax" }).map((r) => r.id), ["e7"]);
    assert.deepEqual(filterExpenseRows(list, { filter: "cat:repair" }).map((r) => r.id), ["e9"]);
  });
});
