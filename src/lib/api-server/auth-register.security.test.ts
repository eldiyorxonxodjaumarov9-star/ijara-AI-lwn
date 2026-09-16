/**
 * QA-001: public registration must never trust client role for privilege.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("auth register role hardening", () => {
  it("register route ignores body.role and forces EMPLOYEE", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/auth/register/route.ts"),
      "utf8"
    );
    assert.match(src, /Role\.EMPLOYEE/);
    assert.equal(/role:\s*body\.role/.test(src), false);
    assert.match(src, /Ignore any client-supplied role/);
    assert.match(src, /ALLOW_PUBLIC_REGISTER/);
  });
});
