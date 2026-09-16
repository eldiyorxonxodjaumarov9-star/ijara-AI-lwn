import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { __test } from "@/lib/api/client";

describe("resolveApiBaseUrl", () => {
  it("appends /api when absolute origin has empty path", () => {
    assert.equal(__test.resolveApiBaseUrl("https://ijaraai.uz"), "https://ijaraai.uz/api");
    assert.equal(__test.resolveApiBaseUrl("https://ijaraai.uz/"), "https://ijaraai.uz/api");
  });

  it("keeps relative /api", () => {
    assert.equal(__test.resolveApiBaseUrl("/api"), "/api");
    assert.equal(__test.resolveApiBaseUrl("/api/"), "/api");
  });

  it("keeps absolute URL that already includes /api", () => {
    assert.equal(
      __test.resolveApiBaseUrl("https://ijaraai.uz/api"),
      "https://ijaraai.uz/api"
    );
  });

  it("returns undefined for empty", () => {
    assert.equal(__test.resolveApiBaseUrl(""), undefined);
    assert.equal(__test.resolveApiBaseUrl(undefined), undefined);
  });
});
