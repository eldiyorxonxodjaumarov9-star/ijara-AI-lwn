/**
 * Signed portal session — sign/verify and requirePortalTenant guards.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import { NextRequest } from "next/server";

import {
  requirePortalTenant,
  signPortalToken,
  verifyPortalToken,
} from "./portal-session";

function portalRequest(auth: string | null): NextRequest {
  const headers = new Headers();
  if (auth != null) headers.set("authorization", auth);
  return new NextRequest("http://localhost/api/portal/data", {
    method: "POST",
    headers,
  });
}

describe("portal session JWT", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.JWT_PORTAL_SECRET = "test-portal-secret-for-unit-tests";
    process.env.JWT_PORTAL_EXPIRES = "1h";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("signPortalToken / verifyPortalToken round-trip", () => {
    const token = signPortalToken("tenant-abc");
    assert.ok(token.length > 0);

    const payload = verifyPortalToken(token);
    assert.ok(payload);
    assert.equal(payload.sub, "tenant-abc");
    assert.equal(payload.typ, "portal");
  });

  it("verifyPortalToken rejects invalid token", () => {
    assert.equal(verifyPortalToken("not-a-jwt"), null);
  });
});

describe("requirePortalTenant", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.JWT_PORTAL_SECRET = "test-portal-secret-for-unit-tests";
    process.env.JWT_PORTAL_EXPIRES = "1h";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("missing token → 401", () => {
    const result = requirePortalTenant(portalRequest(null));
    assert.ok("error" in result);
    assert.equal(result.error.status, 401);
  });

  it("mismatched tenantId → 403", () => {
    const token = signPortalToken("tenant-a");
    const result = requirePortalTenant(
      portalRequest(`Bearer ${token}`),
      "tenant-b"
    );
    assert.ok("error" in result);
    assert.equal(result.error.status, 403);
  });

  it("matching tenantId → ok", () => {
    const token = signPortalToken("tenant-a");
    const result = requirePortalTenant(
      portalRequest(`Bearer ${token}`),
      "tenant-a"
    );
    assert.ok("tenantId" in result);
    assert.equal(result.tenantId, "tenant-a");
  });

  it("valid token without body tenantId → ok", () => {
    const token = signPortalToken("tenant-a");
    const result = requirePortalTenant(portalRequest(`Bearer ${token}`));
    assert.ok("tenantId" in result);
    assert.equal(result.tenantId, "tenant-a");
  });
});
