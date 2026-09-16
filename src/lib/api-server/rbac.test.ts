/**
 * RBAC role × resource matrix assertions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  ADMIN_ROLES,
  STAFF_ROLES,
  canAccessResource,
  isAdminRole,
  isStaffRole,
} from "./rbac";

describe("rbac role helpers", () => {
  it("STAFF_ROLES / ADMIN_ROLES membership", () => {
    assert.deepEqual([...STAFF_ROLES], ["SUPER_ADMIN", "ADMIN", "MANAGER"]);
    assert.deepEqual([...ADMIN_ROLES], ["SUPER_ADMIN", "ADMIN"]);
    assert.equal(isStaffRole("MANAGER"), true);
    assert.equal(isStaffRole("EMPLOYEE"), false);
    assert.equal(isAdminRole("ADMIN"), true);
    assert.equal(isAdminRole("MANAGER"), false);
  });
});

describe("canAccessResource matrix", () => {
  it("EMPLOYEE cannot POST payments", () => {
    assert.equal(canAccessResource("EMPLOYEE", "payments", "POST"), false);
  });

  it("ADMIN can POST payments", () => {
    assert.equal(canAccessResource("ADMIN", "payments", "POST"), true);
  });

  it("MANAGER can GET employees", () => {
    assert.equal(canAccessResource("MANAGER", "employees", "GET"), true);
  });

  it("EMPLOYEE cannot access employees at all", () => {
    assert.equal(canAccessResource("EMPLOYEE", "employees", "GET"), false);
    assert.equal(canAccessResource("EMPLOYEE", "employees", "POST"), false);
    assert.equal(canAccessResource("EMPLOYEE", "employees", "PATCH"), false);
    assert.equal(canAccessResource("EMPLOYEE", "employees", "PUT"), false);
    assert.equal(canAccessResource("EMPLOYEE", "employees", "DELETE"), false);
  });

  it("EMPLOYEE can GET payments but not mutate finance", () => {
    assert.equal(canAccessResource("EMPLOYEE", "payments", "GET"), true);
    assert.equal(canAccessResource("EMPLOYEE", "expenses", "GET"), true);
    assert.equal(canAccessResource("EMPLOYEE", "expenses", "POST"), false);
    assert.equal(canAccessResource("EMPLOYEE", "payments", "PATCH"), false);
    assert.equal(canAccessResource("EMPLOYEE", "payments", "PUT"), false);
    assert.equal(canAccessResource("EMPLOYEE", "expenses", "DELETE"), false);
    assert.equal(canAccessResource("EMPLOYEE", "payments", "DELETE"), false);
  });

  it("EMPLOYEE tasks GET only; MANAGER can manage tasks", () => {
    assert.equal(canAccessResource("EMPLOYEE", "tasks", "GET"), true);
    assert.equal(canAccessResource("EMPLOYEE", "tasks", "POST"), false);
    assert.equal(canAccessResource("MANAGER", "tasks", "POST"), true);
  });

  it("SUPER_ADMIN has full access", () => {
    assert.equal(canAccessResource("SUPER_ADMIN", "employees", "DELETE"), true);
    assert.equal(canAccessResource("SUPER_ADMIN", "payments", "POST"), true);
  });
});

describe("CRUD routes use requireResourceAccess", () => {
  const routes = [
    "src/app/api/[resource]/route.ts",
    "src/app/api/[resource]/[id]/route.ts",
    "src/app/api/employees/route.ts",
    "src/app/api/properties/route.ts",
    "src/app/api/clients/route.ts",
    "src/app/api/tasks/route.ts",
  ];

  for (const route of routes) {
    it(`${route} imports requireResourceAccess`, () => {
      const src = readFileSync(join(process.cwd(), route), "utf8");
      assert.match(src, /requireResourceAccess/);
      assert.equal(src.includes("requireUser(req)"), false);
    });
  }
});
