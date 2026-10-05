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
    assert.equal(/plan:\s*parsed\.data/.test(src), false);
    assert.equal(/plan:\s*["']pro["']/.test(src), false);
    assert.match(src, /ALLOW_PUBLIC_REGISTER|ENABLE_WORKSPACE_SIGNUP/);
    assert.match(src, /createDemoWorkspaceForUser/);
    assert.match(src, /industry/);
    assert.match(src, /409/);
  });

  it("client register payload does not send role or plan", () => {
    const src = readFileSync(
      join(process.cwd(), "src/context/auth-context.tsx"),
      "utf8"
    );
    const start = src.indexOf('"/auth/register"');
    const bodyStart = src.indexOf("body:", start);
    const bodyEnd = src.indexOf("},", bodyStart);
    assert.ok(start > 0 && bodyStart > start && bodyEnd > bodyStart);
    const body = src.slice(bodyStart, bodyEnd);
    assert.match(body, /industry: payload\.industry/);
    assert.equal(/role:/.test(body), false);
    assert.equal(/plan:/.test(body), false);
  });
});
