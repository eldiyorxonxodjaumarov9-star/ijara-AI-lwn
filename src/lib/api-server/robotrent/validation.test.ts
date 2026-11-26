import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRobotRentApplicationBody } from "./validation";

describe("robotrent application validation", () => {
  it("accepts mobile customer with 3 fields", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "CUSTOMER",
      formProfile: "mobile",
      companyName: "Acme",
      city: "Toshkent",
      phone: "+998901234567",
    });
    assert.equal(parsed.ok, true);
  });

  it("rejects mobile customer without phone", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "CUSTOMER",
      formProfile: "mobile",
      companyName: "Acme",
      city: "Toshkent",
    });
    assert.equal(parsed.ok, false);
  });

  it("requires desktop customer extras", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "CUSTOMER",
      formProfile: "desktop",
      companyName: "Acme",
      city: "Toshkent",
      phone: "+998901234567",
    });
    assert.equal(parsed.ok, false);
  });

  it("accepts mobile distributor with 3 fields", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "DISTRIBUTOR",
      formProfile: "mobile",
      companyName: "Servis Co",
      robotModel: "RR-50",
      phone: "+998901234567",
    });
    assert.equal(parsed.ok, true);
  });

  it("accepts mobile manufacturer with 3 fields", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "MANUFACTURER",
      formProfile: "mobile",
      companyName: "Factory",
      country: "CN",
      email: "info@factory.com",
    });
    assert.equal(parsed.ok, true);
  });

  it("rejects honeypot", () => {
    const parsed = parseRobotRentApplicationBody({
      type: "CUSTOMER",
      formProfile: "mobile",
      website: "spam",
      companyName: "Acme",
      city: "Toshkent",
      phone: "+998901234567",
    });
    assert.equal(parsed.ok, false);
  });
});