/**
 * QA-007: sync account must require auth and strip demo passwords.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sanitizeAccountSyncState } from "@/lib/cloud/account-state-sanitize";
import type { AccountSyncState } from "@/lib/cloud/account-state";

describe("sync account route hardening", () => {
  it("requires authenticated user and does not authorize by email query alone", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/sync/account/route.ts"),
      "utf8"
    );
    assert.match(src, /requireUser/);
    assert.match(src, /auth\.user\.email/);
    assert.match(src, /sanitizeAccountSyncState/);
    assert.equal(src.includes("searchParams.get(\"email\")"), false);
  });

  it("sync client sends bearer token instead of email query", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/cloud/sync-client.ts"),
      "utf8"
    );
    assert.match(src, /Authorization.*Bearer/);
    assert.equal(src.includes("?email="), false);
  });
});

describe("sanitizeAccountSyncState", () => {
  it("removes plaintext demo passwords from payload", () => {
    const state: AccountSyncState = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: null,
      demoUsers: [
        {
          id: "u1",
          uid: "u1",
          email: "a@test.uz",
          password: "secret123",
          displayName: "A",
          role: "admin",
          language: "uz",
        },
      ],
      collections: {},
    };
    const safe = sanitizeAccountSyncState(state);
    assert.equal("password" in safe.demoUsers[0], false);
  });
});
