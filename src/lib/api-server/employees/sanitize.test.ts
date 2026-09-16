import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  sanitizeEmployeeForRole,
  sanitizeEmployeesForRole,
} from "./sanitize";

const sample = {
  id: "e1",
  fullName: "Ali",
  position: "Manager",
  monthlySalary: 5_000_000,
  salaryPayDay: 10,
  notes: "private",
  phone: "+998901234567",
};

describe("sanitizeEmployeeForRole", () => {
  it("manager/admin keep salary fields", () => {
    assert.deepEqual(sanitizeEmployeeForRole(sample, "MANAGER"), sample);
    assert.deepEqual(sanitizeEmployeeForRole(sample, "ADMIN"), sample);
  });

  it("EMPLOYEE strips salary and private fields", () => {
    const out = sanitizeEmployeeForRole(sample, "EMPLOYEE");
    assert.equal(out.fullName, "Ali");
    assert.equal("monthlySalary" in out, false);
    assert.equal("salaryPayDay" in out, false);
    assert.equal("notes" in out, false);
    assert.equal("phone" in out, false);
  });

  it("sanitizeEmployeesForRole maps list", () => {
    const list = sanitizeEmployeesForRole([sample], "EMPLOYEE");
    assert.equal(list.length, 1);
    assert.equal("monthlySalary" in list[0], false);
  });
});
