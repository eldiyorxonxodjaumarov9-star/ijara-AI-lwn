import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatTaskDueAt,
  isStaffRole,
  isTaskOverdue,
  maskPhone,
  wizardNotExpired,
} from "@/lib/tasks/task-shared";
import { classifyAttachment, sanitizeFileName } from "@/lib/api-server/tasks/task-attachments";

describe("task shared helpers", () => {
  it("staff roles", () => {
    assert.equal(isStaffRole("ADMIN"), true);
    assert.equal(isStaffRole("MANAGER"), true);
    assert.equal(isStaffRole("EMPLOYEE"), false);
  });

  it("overdue only for active statuses", () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    assert.equal(isTaskOverdue(past, "NEW"), true);
    assert.equal(isTaskOverdue(past, "COMPLETED"), false);
    assert.equal(isTaskOverdue(null, "NEW"), false);
  });

  it("formats Asia/Tashkent due date", () => {
    const s = formatTaskDueAt("2026-08-31T10:00:00.000Z");
    assert.ok(s.includes("2026") || s.includes("31") || s.includes("08"));
  });

  it("masks phone", () => {
    assert.equal(maskPhone("998901112233"), "***2233");
  });

  it("wizard TTL", () => {
    assert.equal(
      wizardNotExpired({
        kind: "task_report",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      true
    );
    assert.equal(
      wizardNotExpired({
        kind: "task_report",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
      false
    );
  });
});

describe("task attachments", () => {
  it("sanitizes file names and blocks executables", () => {
    assert.equal(sanitizeFileName("../a/b.exe").includes(".."), false);
    const bad = classifyAttachment("application/octet-stream", "virus.exe");
    assert.ok("error" in bad);
  });

  it("allows images and pdf", () => {
    const img = classifyAttachment("image/jpeg", "a.jpg");
    assert.ok(!("error" in img) && img.type === "IMAGE");
    const pdf = classifyAttachment("application/pdf", "a.pdf");
    assert.ok(!("error" in pdf) && pdf.type === "DOCUMENT");
  });
});
