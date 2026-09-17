/**
 * Email OTP authentication — security and flow invariants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  hashEmailOtpCode,
  verifyEmailOtpCode,
} from "./email/otp";

const root = process.cwd();

describe("email OTP storage", () => {
  it("hashes codes — never stores plain text in helpers", () => {
    const code = "482193";
    const hash = hashEmailOtpCode(code);
    assert.notEqual(hash, code);
    assert.equal(hash.length, 64);
    assert.ok(verifyEmailOtpCode(code, hash));
    assert.equal(verifyEmailOtpCode("000000", hash), false);
  });
});

describe("send-code route hardening", () => {
  const src = readFileSync(
    join(root, "src/app/api/auth/email/send-code/route.ts"),
    "utf8"
  );

  it("returns 503 when email provider is not configured", () => {
    assert.match(src, /isEmailSendingConfigured/);
    assert.match(src, /503/);
    assert.match(src, /EMAIL_NOT_CONFIGURED/);
  });

  it("does not create users on send-code", () => {
    assert.equal(/prisma\.user\.create/.test(src), false);
    assert.equal(/createDemoWorkspaceForUser/.test(src), false);
  });

  it("does not expose OTP in API response", () => {
    assert.equal(/return ok\([^)]*code/.test(src), false);
  });

  it("rate limits resend", () => {
    assert.match(src, /checkOtpSendRateLimit/);
    assert.match(src, /RATE_LIMITED/);
  });
});

describe("verify-code route hardening", () => {
  const src = readFileSync(
    join(root, "src/app/api/auth/email/verify-code/route.ts"),
    "utf8"
  );

  it("creates user only via authenticateWithEmailOtp after OTP verify", () => {
    assert.match(src, /authenticateWithEmailOtp/);
    assert.equal(/prisma\.user\.create/.test(src), false);
  });

  it("never assigns SUPER_ADMIN from public flow", () => {
    assert.equal(/SUPER_ADMIN/.test(src), false);
  });
});

describe("email-otp-auth module", () => {
  const src = readFileSync(
    join(root, "src/lib/api-server/auth/email-otp-auth.ts"),
    "utf8"
  );

  it("creates user and DEMO workspace only after OTP success", () => {
    assert.match(src, /verifyEmailOtpRecord/);
    assert.match(src, /createDemoWorkspaceForUser/);
    assert.match(src, /Role\.ADMIN/);
    assert.equal(/Role\.SUPER_ADMIN/.test(src), false);
  });

  it("uses random password hash for passwordless users", () => {
    assert.match(src, /randomPasswordHash/);
    assert.match(src, /randomBytes/);
  });

  it("default demo workspace name is set", () => {
    assert.match(src, /Yangi ijara biznesi/);
  });
});

describe("email send module", () => {
  const src = readFileSync(
    join(root, "src/lib/api-server/email/send.ts"),
    "utf8"
  );

  it("uses Resend server-side only", () => {
    assert.match(src, /api\.resend\.com/);
    assert.match(src, /RESEND_API_KEY/);
    assert.equal(/NEXT_PUBLIC/.test(src), false);
  });

  it("throws when provider missing — no fake success", () => {
    assert.match(src, /EmailSendError/);
    assert.match(src, /isEmailSendingConfigured/);
  });
});

describe("OTP prisma schema", () => {
  const schema = readFileSync(
    join(root, "server/prisma/schema.prisma"),
    "utf8"
  );

  it("EmailOtpVerification stores codeHash not plain code", () => {
    assert.match(schema, /model EmailOtpVerification/);
    assert.match(schema, /codeHash/);
    assert.equal(/\bcode\s+String/.test(schema.split("EmailOtpVerification")[1]?.split("}")[0] ?? ""), false);
  });
});

describe("login UI", () => {
  const src = readFileSync(
    join(root, "src/app/(auth)/login/page.tsx"),
    "utf8"
  );

  it("primary flow is email OTP not phone", () => {
    assert.match(src, /Kodni olish/);
    assert.match(src, /EmailOtpInput/);
    assert.equal(/telefon/i.test(src), false);
  });
});
