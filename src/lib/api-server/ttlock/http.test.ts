import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";

import {
  ttlockFail,
  ttlockFromRequireUserError,
} from "@/lib/api-server/ttlock/http";
import { fail } from "@/lib/api-server/http";

describe("ttlockFromRequireUserError", () => {
  it("maps true 401 auth failures to TTLOCK_AUTH_REQUIRED", async () => {
    const raw = fail("Autentifikatsiya talab qilinadi", 401);
    const res = ttlockFromRequireUserError(raw);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error?.code, "TTLOCK_AUTH_REQUIRED");
  });

  it("passes through plan upgrade 403 unchanged", async () => {
    const raw = fail(
      "Bu funksiya Pro tarifida mavjud. Tarifni yangilash.",
      403,
      "PLAN_UPGRADE_REQUIRED"
    );
    const res = ttlockFromRequireUserError(raw);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, "PLAN_UPGRADE_REQUIRED");
    assert.notEqual(body.error?.code, "TTLOCK_AUTH_REQUIRED");
  });

  it("does not remap non-401 ttlockFail responses", async () => {
    const raw = ttlockFail("TTLOCK_FORBIDDEN", "Ruxsat yo‘q", 403);
    const res = ttlockFromRequireUserError(raw as NextResponse);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, "TTLOCK_FORBIDDEN");
  });
});
