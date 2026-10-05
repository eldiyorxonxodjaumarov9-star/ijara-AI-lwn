import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  caretAfterDigits,
  formatUzLocal,
  toUzCanonical,
  UZ_PHONE_PATTERN,
  uzLocalDigits,
  uzLocalFromCanonical,
} from "@/lib/uz-phone";

describe("uz phone mask", () => {
  it("formats 9 local digits as XX XXX XX XX", () => {
    assert.equal(formatUzLocal("901234567"), "90 123 45 67");
    assert.equal(formatUzLocal("9012"), "90 12");
    assert.equal(formatUzLocal(""), "");
  });

  it("caps at 9 digits and drops letters and symbols", () => {
    assert.equal(uzLocalDigits("9012345678"), "901234567");
    assert.equal(uzLocalDigits("90a1(2)-3+"), "90123");
  });

  it("normalizes pasted numbers with or without the country code", () => {
    for (const pasted of ["998901234567", "+998901234567", "90 123 45 67", "+998 90 123 45 67"]) {
      assert.equal(uzLocalDigits(pasted, { pasted: true }), "901234567", pasted);
    }
  });

  it("keeps typing a local number that itself starts with 998", () => {
    assert.equal(uzLocalDigits("998123456"), "998123456");
    assert.equal(uzLocalDigits("9981234567"), "998123456");
  });

  it("produces the canonical +998XXXXXXXXX value and validates completeness", () => {
    assert.equal(toUzCanonical("901234567"), "+998901234567");
    assert.equal(toUzCanonical(""), "");
    assert.ok(UZ_PHONE_PATTERN.test("+998901234567"));
    assert.ok(!UZ_PHONE_PATTERN.test("+99890123456"));
    assert.equal(uzLocalFromCanonical("+998901234567"), "901234567");
  });

  it("places the caret after the n-th digit", () => {
    assert.equal(caretAfterDigits("90 123 45 67", 3), 4);
    assert.equal(caretAfterDigits("90 123 45 67", 9), 12);
    assert.equal(caretAfterDigits("90 1", 0), 0);
  });
});
