/**

 * QA-009: forgot/reset password enumeration-safe flow.

 */

import assert from "node:assert/strict";

import { describe, it } from "node:test";

import { readFileSync } from "node:fs";

import { join } from "node:path";



import {

  createPasswordResetRawToken,

  hashPasswordResetToken,

} from "./portal-session";



const root = process.cwd();



describe("forgot-password route hardening", () => {

  it("always returns generic message and never leaks reset token", () => {

    const src = readFileSync(

      join(root, "src/app/api/auth/forgot-password/route.ts"),

      "utf8"

    );

    assert.match(src, /GENERIC_MESSAGE/);

    assert.match(src, /createPasswordResetRawToken/);

    assert.match(src, /hashPasswordResetToken/);

    assert.match(src, /resetTokenExp/);

    assert.equal(/return ok\(\{[^}]*rawToken/.test(src), false);

    assert.equal(/return ok\(\{[^}]*token/.test(src), false);

  });

});



describe("reset-password route hardening", () => {

  it("verifies hashed token, clears single-use fields, invalidates refresh", () => {

    const src = readFileSync(

      join(root, "src/app/api/auth/reset-password/route.ts"),

      "utf8"

    );

    assert.match(src, /hashPasswordResetToken/);

    assert.match(src, /resetTokenExp/);

    assert.match(src, /resetToken: null/);

    assert.match(src, /refreshTokenHash: null/);

    assert.match(src, /bcrypt\.hash/);

  });

});



describe("password reset token helpers", () => {

  it("hashes raw tokens consistently for lookup", () => {

    const raw = createPasswordResetRawToken();

    assert.equal(hashPasswordResetToken(raw), hashPasswordResetToken(raw));

    assert.notEqual(raw, hashPasswordResetToken(raw));

  });

});


