import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatPhoneDisplay,
  normalizePhoneDigits,
  validateTenantPhone,
} from "./sms-notifications";

describe("validateTenantPhone", () => {
  it("rejects empty phone", () => {
    assert.equal(validateTenantPhone("").valid, false);
  });

  it("accepts 9-digit mobile", () => {
    assert.equal(validateTenantPhone("901234567").valid, true);
  });

  it("accepts +998 format", () => {
    assert.equal(validateTenantPhone("+998 90 123 45 67").valid, true);
  });

  it("rejects too short", () => {
    assert.equal(validateTenantPhone("90123").valid, false);
  });

  it("rejects non-mobile prefix", () => {
    assert.equal(validateTenantPhone("801234567").valid, false);
  });
});

describe("formatPhoneDisplay", () => {
  it("formats 9 digits", () => {
    assert.match(formatPhoneDisplay("901234567"), /\+998 90/);
  });
});

describe("normalizePhoneDigits", () => {
  it("strips non-digits", () => {
    assert.equal(normalizePhoneDigits("+998 (90) 123-45-67"), "998901234567");
  });
});
