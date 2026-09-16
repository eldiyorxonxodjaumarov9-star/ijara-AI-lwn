import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLeadHoneypotTriggered,
  LEAD_FULLNAME_MAX,
  LEAD_PHONE_MAX,
  parsePublicLeadBody,
} from "./public-lead";

describe("public lead validation (QA-019)", () => {
  it("rejects short name and bad phone", () => {
    assert.equal(parsePublicLeadBody({ fullName: "A", phone: "123" }).ok, false);
    assert.equal(
      parsePublicLeadBody({ fullName: "Ali Valiyev", phone: "+998901234567" }).ok,
      true
    );
  });

  it("enforces length limits", () => {
    const long = "x".repeat(LEAD_FULLNAME_MAX + 10);
    const parsed = parsePublicLeadBody({
      fullName: long,
      phone: "+998901234567",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.fullName.length, LEAD_FULLNAME_MAX);
    }
    const phoneParsed = parsePublicLeadBody({
      fullName: "Ali Valiyev",
      phone: (`+998 90 123 45 67 ${"x".repeat(20)}`).slice(0, LEAD_PHONE_MAX + 5),
    });
    assert.equal(phoneParsed.ok, true);
    if (phoneParsed.ok) {
      assert.equal(phoneParsed.data.phone.length, LEAD_PHONE_MAX);
    }
  });

  it("honeypot triggers on hidden fields", () => {
    assert.equal(isLeadHoneypotTriggered({ fullName: "Ali", website: "x" }), true);
    assert.equal(isLeadHoneypotTriggered({ fullName: "Ali", phone: "1" }), false);
  });
});
