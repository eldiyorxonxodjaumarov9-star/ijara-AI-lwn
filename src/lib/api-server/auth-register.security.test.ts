/**
 * Public registration must never trust client role for privilege.
 * Workspace signup creates ADMIN (workspace owner), never SUPER_ADMIN.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("auth register role hardening", () => {
  it("register route ignores body.role and forces ADMIN workspace owner", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/auth/register/route.ts"),
      "utf8"
    );
    assert.match(src, /Role\.ADMIN/);
    assert.equal(/Role\.SUPER_ADMIN/.test(src), false);
    assert.equal(/role:\s*body\.role/.test(src), false);
    assert.equal(/role:\s*parsed\.data\.role/.test(src), false);
    assert.match(src, /ALLOW_PUBLIC_REGISTER|ENABLE_WORKSPACE_SIGNUP/);
    assert.match(src, /createDemoWorkspaceForUser/);
  });
});
