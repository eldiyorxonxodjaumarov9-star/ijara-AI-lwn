/**
 * QA-002 / QA-003: posting, listings, Instagram, and telegram-distribution
 * API routes must enforce staff RBAC or fail-closed cron auth.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function readRoute(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function assertGuard(src: string, guard: string, file: string): void {
  assert.match(
    src,
    new RegExp(guard),
    `${file} must call ${guard}`
  );
}

describe("posting & listings route auth guards", () => {
  it("posting listings [id] — staff reads, privileged retry", () => {
    const file = "src/app/api/posting/listings/[id]/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireAnyStaffUser", file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("posting jobs [id] — staff reads, privileged mutations", () => {
    const file = "src/app/api/posting/jobs/[id]/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireAnyStaffUser", file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("posting channels — staff reads, privileged patch", () => {
    const file = "src/app/api/posting/channels/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireAnyStaffUser", file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("listings publish — privileged staff only", () => {
    const file = "src/app/api/listings/publish/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("listings index — any staff read", () => {
    const file = "src/app/api/listings/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireAnyStaffUser", file);
  });

  it("listings instagram post — privileged staff only", () => {
    const file = "src/app/api/listings/[id]/post/instagram/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireStaffUser", file);
  });
});

describe("instagram integration route auth guards", () => {
  it("instagram root — staff read, privileged mutate", () => {
    const file = "src/app/api/integrations/instagram/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireAnyStaffUser", file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("instagram status — any staff read", () => {
    const file = "src/app/api/integrations/instagram/status/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireAnyStaffUser", file);
  });

  it("instagram disconnect — privileged staff", () => {
    const file = "src/app/api/integrations/instagram/disconnect/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("instagram test — privileged staff", () => {
    const file = "src/app/api/integrations/instagram/test/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("instagram auth-url — privileged staff", () => {
    const file = "src/app/api/integrations/instagram/auth-url/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireStaffUser", file);
  });

  /**
   * OAuth callback stays public for Meta redirect; validates authorization code
   * server-side but does not verify OAuth `state` (CSRF) on return — harden separately.
   */
  it("instagram callback — public OAuth redirect (no RBAC)", () => {
    const file = "src/app/api/integrations/instagram/callback/route.ts";
    const src = readRoute(file);
    assert.equal(src.includes("requireAnyStaffUser"), false);
    assert.equal(src.includes("requireStaffUser"), false);
    assert.equal(src.includes("requireAdminUser"), false);
    assert.match(src, /handleInstagramCallback/);
    assert.equal(/searchParams\.get\(["']state["']\)/.test(src), false);
  });
});

describe("telegram-distribution route auth guards", () => {
  it("queue process — fail-closed cron auth", () => {
    const file = "src/app/api/telegram-distribution/queue/process/route.ts";
    const src = readRoute(file);
    assertGuard(src, "assertFailClosedCronAuth", file);
  });

  it("listing jobs/logs — any staff read", () => {
    const file = "src/app/api/telegram-distribution/listings/[id]/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireAnyStaffUser", file);
  });

  it("listing repost & distribute — privileged staff", () => {
    for (const file of [
      "src/app/api/telegram-distribution/listings/[id]/repost/route.ts",
      "src/app/api/telegram-distribution/listings/[id]/distribute/route.ts",
    ]) {
      const src = readRoute(file);
      assertGuard(src, "requireStaffUser", file);
    }
  });

  it("job retry — privileged staff", () => {
    const file = "src/app/api/telegram-distribution/jobs/[id]/retry/route.ts";
    const src = readRoute(file);
    assertGuard(src, "requireStaffUser", file);
  });

  it("channels — staff read, privileged create/update/delete/test", () => {
    const listFile = "src/app/api/telegram-distribution/channels/route.ts";
    const listSrc = readRoute(listFile);
    assertGuard(listSrc, "requireAnyStaffUser", listFile);
    assertGuard(listSrc, "requireStaffUser", listFile);

    for (const file of [
      "src/app/api/telegram-distribution/channels/[id]/route.ts",
      "src/app/api/telegram-distribution/channels/[id]/test/route.ts",
      "src/app/api/telegram-distribution/channels/[id]/check-admin/route.ts",
    ]) {
      const src = readRoute(file);
      assertGuard(src, "requireStaffUser", file);
    }
  });
});
