/**
 * Xodimlar moduli — unit/filter helper testlari.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPLOYEE_POSITIONS,
  EMPLOYEE_UNIT,
  isLwnCompanyName,
  isSunnurCompanyName,
  matchEmployeeUnit,
  normalizeEmployeePhone,
  positionLabel,
} from "./employee-units";
import { calcDailySalary, clampSalaryPayDay } from "./employee-salary";
import { employeeSchema, expenseSchema } from "./validations";

describe("employee units", () => {
  it("Sunnur/LWN company name match", () => {
    assert.equal(isSunnurCompanyName("Sunnur"), true);
    assert.equal(isLwnCompanyName("LWN"), true);
    assert.equal(isLwnCompanyName("Live Work Network"), true);
    assert.equal(matchEmployeeUnit("Sunnur"), EMPLOYEE_UNIT.SUNNUR);
    assert.equal(matchEmployeeUnit("LWN"), EMPLOYEE_UNIT.LWN);
    assert.equal(matchEmployeeUnit("ABC"), null);
  });

  it("phone normalize", () => {
    assert.equal(normalizeEmployeePhone("+998 90 123 45 67"), "998901234567");
    assert.equal(normalizeEmployeePhone("901234567"), "998901234567");
    assert.equal(normalizeEmployeePhone(""), null);
  });

  it("positions list includes Farrosh", () => {
    assert.ok(EMPLOYEE_POSITIONS.includes("Farrosh"));
    assert.equal(positionLabel("Farrosh"), "Farrosh");
  });
});

describe("employee salary helpers", () => {
  it("daily salary and pay day clamp", () => {
    assert.ok(calcDailySalary(3_100_000) > 0);
    assert.equal(clampSalaryPayDay(0), null);
    assert.equal(clampSalaryPayDay(15), 15);
    assert.equal(clampSalaryPayDay(40), null);
  });
});

describe("employee/expense validation", () => {
  it("employee requires company and position", () => {
    const bad = employeeSchema.safeParse({
      fullName: "Ali",
      companyId: "",
      position: "",
    });
    assert.equal(bad.success, false);

    const ok = employeeSchema.safeParse({
      fullName: "Ali Valiyev",
      companyId: "c1",
      position: "Farrosh",
      monthlySalary: 0,
    });
    assert.equal(ok.success, true);
  });

  it("salary expense requires employeeId", () => {
    const bad = expenseSchema.safeParse({
      category: "salary",
      amount: 1000,
      date: "2026-08-30",
    });
    assert.equal(bad.success, false);

    const ok = expenseSchema.safeParse({
      category: "salary",
      amount: 1000,
      date: "2026-08-30",
      employeeId: "e1",
    });
    assert.equal(ok.success, true);
  });

  it("utilities does not require employee", () => {
    const ok = expenseSchema.safeParse({
      category: "utilities",
      amount: 1000,
      date: "2026-08-30",
      monthlyExpenseType: "water",
    });
    assert.equal(ok.success, true);
  });
});
