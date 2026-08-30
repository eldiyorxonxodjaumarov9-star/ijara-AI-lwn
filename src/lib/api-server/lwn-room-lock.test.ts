import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLwnPropertyRecord,
  parseDateOrNull,
  parsePermissionType,
} from "./lwn-room-lock";
import { LWN_BUILDING } from "@/lib/constants";

describe("isLwnPropertyRecord", () => {
  it("accepts LWN building", () => {
    assert.equal(isLwnPropertyRecord({ building: LWN_BUILDING, district: "X" }), true);
  });

  it("accepts LWN district", () => {
    assert.equal(isLwnPropertyRecord({ building: "Other", district: LWN_BUILDING }), true);
  });

  it("rejects non-LWN", () => {
    assert.equal(isLwnPropertyRecord({ building: "Other", district: "Other" }), false);
  });
});

describe("parsePermissionType", () => {
  it("normalizes lowercase input", () => {
    assert.equal(parsePermissionType("app"), "APP");
  });

  it("falls back to PIN for unknown", () => {
    assert.equal(parsePermissionType("bogus"), "PIN");
  });
});

describe("parseDateOrNull", () => {
  it("parses ISO date strings", () => {
    const d = parseDateOrNull("2026-08-28");
    assert.ok(d instanceof Date);
  });

  it("returns null for empty", () => {
    assert.equal(parseDateOrNull(""), null);
    assert.equal(parseDateOrNull(null), null);
  });
});
