import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRobotRentApplicationBody } from "./validation";

describe("robotrent application validation", () => {
  it("accepts valid customer application", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "CUSTOMER",
      companyName: "Acme",
      city: "Toshkent",
      objectType: "Ofis",
      areaSqm: 1200,
      phone: "+998901234567",
      startDate: "2026-12-01",
    });
    assert.equal(parsed.ok, true);
  });

  it("rejects honeypot", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "CUSTOMER",
      website: "spam",
      companyName: "Acme",
      city: "Toshkent",
      objectType: "Ofis",
      areaSqm: 1200,
      phone: "+998901234567",
      startDate: "2026-12-01",
    });
    assert.equal(parsed.ok, false);
  });
});