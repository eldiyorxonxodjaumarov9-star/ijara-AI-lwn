/**
 * QR feedback status button contracts — no double JSON.stringify on apiFetch bodies.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { FEEDBACK_STATUS_LABELS } from "./constants";

const root = process.cwd();

describe("QR feedback status UI labels", () => {
  it("maps NEW / IN_REVIEW / RESOLVED to Uzbek labels", () => {
    assert.equal(FEEDBACK_STATUS_LABELS.NEW, "Yangi");
    assert.equal(FEEDBACK_STATUS_LABELS.IN_REVIEW, "Ko‘rib chiqilmoqda");
    assert.equal(FEEDBACK_STATUS_LABELS.RESOLVED, "Hal qilindi");
  });
});

describe("QR codes page apiFetch body contract", () => {
  const page = readFileSync(
    join(root, "src/app/(dashboard)/qr-codes/page.tsx"),
    "utf8"
  );
  const route = readFileSync(
    join(root, "src/app/api/qr-codes/feedbacks/[id]/route.ts"),
    "utf8"
  );
  const service = readFileSync(
    join(root, "src/lib/api-server/qr-feedback/service.ts"),
    "utf8"
  );
  const client = readFileSync(join(root, "src/lib/api/client.ts"), "utf8");

  it("apiFetch already JSON.stringifies object bodies once", () => {
    assert.match(client, /JSON\.stringify\(body\)/);
  });

  it("page never double-stringifies mutation bodies", () => {
    assert.doesNotMatch(page, /body:\s*JSON\.stringify\(/);
    assert.match(page, /body:\s*\{\s*status\s*\}/);
    assert.match(page, /body:\s*\{\s*retryTelegram:\s*true\s*\}/);
    assert.match(page, /body:\s*\{\s*action:\s*"ensure"\s*\}/);
    assert.match(page, /body:\s*\{\s*active:\s*!qr\.active\s*\}/);
  });

  it("status buttons cover NEW, IN_REVIEW, RESOLVED transitions", () => {
    assert.match(page, /setFeedbackStatus\(f\.id,\s*"NEW"\)/);
    assert.match(page, /setFeedbackStatus\(f\.id,\s*"IN_REVIEW"\)/);
    assert.match(page, /setFeedbackStatus\(f\.id,\s*"RESOLVED"\)/);
    assert.match(page, /f\.status === "RESOLVED"/);
    assert.match(page, /Holat tarixi/);
  });

  it("PATCH route records actor via updateFeedbackStatus and accepts object body", () => {
    assert.match(route, /actorUserId:\s*auth\.user\.id/);
    assert.match(route, /retryTelegram === true/);
    assert.match(service, /feedbackStatusEvent\.create/);
    assert.match(service, /statusHistory/);
  });
});
