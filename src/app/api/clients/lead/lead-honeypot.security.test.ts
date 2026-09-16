import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLeadHoneypotTriggered,
  parsePublicLeadBody,
} from "@/lib/api-server/clients/public-lead";

/**
 * QA-027 — Lead honeypot must reject (route returns 400) without DB write.
 * Route: src/app/api/clients/lead/route.ts calls isLeadHoneypotTriggered
 * before upsertPublicClientLead.
 */
describe("lead honeypot route contract (QA-027)", () => {
  it("filled website honeypot triggers before any persistence", () => {
    const body = {
      fullName: "Spam Bot",
      phone: "+998901112233",
      website: "http://spam.example",
    };
    assert.equal(isLeadHoneypotTriggered(body), true);
    // Legitimate parse would succeed — honeypot must short-circuit first.
    assert.equal(parsePublicLeadBody(body).ok, true);
  });

  it("empty honeypot fields allow normal lead parse", () => {
    const body = {
      fullName: "Ali Valiyev",
      phone: "+998901234567",
      website: "",
      company_url: "   ",
      _hp: null,
    };
    assert.equal(isLeadHoneypotTriggered(body), false);
    assert.equal(parsePublicLeadBody(body).ok, true);
  });

  it("triggers on all known honeypot keys", () => {
    for (const key of ["website", "company_url", "_hp", "url"] as const) {
      assert.equal(
        isLeadHoneypotTriggered({ fullName: "A", [key]: "x" }),
        true,
        key
      );
    }
  });
});
