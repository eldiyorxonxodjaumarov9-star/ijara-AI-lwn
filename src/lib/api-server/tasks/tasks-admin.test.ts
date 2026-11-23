import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assertTaskTransition } from "@/lib/tasks/task-transitions";
import { isStaffRole } from "@/lib/tasks/task-shared";
import { canAccessResource, isAdminRole } from "@/lib/api-server/rbac";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("tasks double-serialize fix", () => {
  it("page runAction passes an object body (not pre-stringified)", () => {
    const src = read("src/app/(dashboard)/tasks/page.tsx");
    assert.match(src, /body:\s*\{\s*action,\s*\.\.\.extra\s*\}/);
    assert.equal(/body:\s*JSON\.stringify\(\{\s*action/.test(src), false);
  });

  it("TaskDialog create does not pre-stringify", () => {
    const src = read("src/components/tasks/task-dialog.tsx");
    assert.equal(/body:\s*JSON\.stringify\(/.test(src), false);
    assert.match(src, /method:\s*"POST"/);
  });

  it("API tolerates a legacy double-serialized string body", () => {
    const src = read("src/app/api/tasks/[id]/route.ts");
    assert.match(src, /typeof body === "string"/);
    assert.match(src, /JSON\.parse\(body\)/);
  });
});

describe("admin task capabilities", () => {
  it("ADMIN/MANAGER may mutate tasks; EMPLOYEE is GET-only", () => {
    assert.equal(canAccessResource("ADMIN", "tasks", "POST"), true);
    assert.equal(canAccessResource("MANAGER", "tasks", "PATCH"), true);
    assert.equal(canAccessResource("SUPER_ADMIN", "tasks", "DELETE"), true);
    assert.equal(canAccessResource("EMPLOYEE", "tasks", "GET"), true);
    assert.equal(canAccessResource("EMPLOYEE", "tasks", "POST"), false);
    assert.equal(canAccessResource("EMPLOYEE", "tasks", "DELETE"), false);
  });

  it("soft-delete is admin-gated in the route", () => {
    assert.equal(isAdminRole("ADMIN"), true);
    assert.equal(isAdminRole("SUPER_ADMIN"), true);
    assert.equal(isAdminRole("MANAGER"), false);
    assert.equal(isAdminRole("EMPLOYEE"), false);
    const src = read("src/app/api/tasks/[id]/route.ts");
    assert.match(src, /isAdminRole\(auth\.user\.role\)/);
    assert.match(src, /softDeleteTask/);
  });

  it("staff helpers", () => {
    assert.equal(isStaffRole("ADMIN"), true);
    assert.equal(isStaffRole("MANAGER"), true);
    assert.equal(isStaffRole("EMPLOYEE"), false);
  });
});

describe("cancel vs soft-delete vs reopen", () => {
  it("cancel is a status transition to CANCELLED", () => {
    assert.doesNotThrow(() =>
      assertTaskTransition({ from: "NEW", to: "CANCELLED", actor: "USER" })
    );
    assert.doesNotThrow(() =>
      assertTaskTransition({ from: "SUBMITTED", to: "CANCELLED", actor: "USER" })
    );
  });

  it("reopen from CANCELLED is admin-only", () => {
    assert.doesNotThrow(() =>
      assertTaskTransition({ from: "CANCELLED", to: "IN_PROGRESS", actor: "USER" })
    );
    assert.throws(() =>
      assertTaskTransition({
        from: "CANCELLED",
        to: "IN_PROGRESS",
        actor: "EMPLOYEE",
      })
    );
  });

  it("service exposes update + softDelete and excludes deleted from lists", () => {
    const src = read("src/lib/api-server/tasks/task-service.ts");
    assert.match(src, /export async function updateTask/);
    assert.match(src, /export async function softDeleteTask/);
    assert.match(src, /deletedAt:\s*null/);
    assert.match(src, /notifyEmployeeTaskAssigned/);
  });

  it("UI has distinct cancel, delete, reopen, edit, reassign", () => {
    const page = read("src/app/(dashboard)/tasks/page.tsx");
    assert.match(page, /Bekor qilish/);
    assert.match(page, /O‘chirish/);
    assert.match(page, /Qayta ochish/);
    assert.match(page, /Tahrirlash/);
    assert.match(page, /Boshqa xodimga berish/);
    assert.match(page, /Telegramga qayta yuborish/);
    assert.match(page, /Telegram xatosi amallarni to‘xtatmaydi/);
  });
});

describe("workspace isolation markers", () => {
  it("task routes always resolve workspace from session", () => {
    const idRoute = read("src/app/api/tasks/[id]/route.ts");
    const listRoute = read("src/app/api/tasks/route.ts");
    assert.match(idRoute, /resolveUserWorkspaceContext/);
    assert.match(idRoute, /isRecordInWorkspace/);
    assert.match(listRoute, /workspaceId/);
    assert.equal(/body\.workspaceId/.test(idRoute), false);
  });
});
