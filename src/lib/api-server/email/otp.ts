import { createHash, randomInt } from "crypto";

import { checkRateLimit } from "@/lib/api-server/contract-draft/rate-limit";
import {
  getOtpExpiryMinutes,
  getOtpMaxAttempts,
  getOtpResendCooldownSec,
} from "@/lib/api-server/email/config";
import { prisma } from "@/lib/api-server/prisma";
import { timingSafeHashEqual } from "@/lib/api-server/portal-session";

export function normalizeAuthEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function generateEmailOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function hashEmailOtpCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function verifyEmailOtpCode(code: string, codeHash: string): boolean {
  const computed = hashEmailOtpCode(code);
  return timingSafeHashEqual(computed, codeHash);
}

export type OtpSendRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; reason: "email" | "ip" };

export function checkOtpSendRateLimit(
  email: string,
  ip: string
): OtpSendRateLimitResult {
  const cooldownMs = getOtpResendCooldownSec() * 1000;
  const emailRl = checkRateLimit(`otp-send:email:${email}`, 1, cooldownMs);
  if (!emailRl.ok) {
    return { ok: false, retryAfterSec: emailRl.retryAfterSec, reason: "email" };
  }
  const ipRl = checkRateLimit(`otp-send:ip:${ip}`, 10, 60 * 60 * 1000);
  if (!ipRl.ok) {
    return { ok: false, retryAfterSec: ipRl.retryAfterSec, reason: "ip" };
  }
  return { ok: true };
}

export function checkOtpVerifyRateLimit(ip: string) {
  return checkRateLimit(`otp-verify:ip:${ip}`, 20, 15 * 60 * 1000);
}

/** Invalidate prior active OTPs for this email before issuing a new one. */
export async function invalidateActiveOtps(email: string): Promise<void> {
  await prisma.emailOtpVerification.updateMany({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
}

export async function createEmailOtp(email: string): Promise<{
  code: string;
  expiresAt: Date;
}> {
  const code = generateEmailOtpCode();
  const expiresAt = new Date(
    Date.now() + getOtpExpiryMinutes() * 60 * 1000
  );
  await invalidateActiveOtps(email);
  await prisma.emailOtpVerification.create({
    data: {
      email,
      codeHash: hashEmailOtpCode(code),
      maxAttempts: getOtpMaxAttempts(),
      expiresAt,
    },
  });
  return { code, expiresAt };
}

export type OtpVerifyResult =
  | { ok: true; recordId: string }
  | {
      ok: false;
      reason: "not_found" | "expired" | "consumed" | "blocked" | "invalid";
      attemptsLeft?: number;
    };

export async function verifyEmailOtpRecord(
  email: string,
  code: string
): Promise<OtpVerifyResult> {
  const record = await prisma.emailOtpVerification.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, reason: "not_found" };
  }

  if (record.consumedAt) {
    return { ok: false, reason: "consumed" };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (record.attempts >= record.maxAttempts) {
    return { ok: false, reason: "blocked", attemptsLeft: 0 };
  }

  const match = verifyEmailOtpCode(code, record.codeHash);
  if (!match) {
    const attempts = record.attempts + 1;
    await prisma.emailOtpVerification.update({
      where: { id: record.id },
      data: {
        attempts,
        ...(attempts >= record.maxAttempts
          ? { consumedAt: new Date() }
          : {}),
      },
    });
    const attemptsLeft = Math.max(0, record.maxAttempts - attempts);
    return {
      ok: false,
      reason: attempts >= record.maxAttempts ? "blocked" : "invalid",
      attemptsLeft,
    };
  }

  await prisma.emailOtpVerification.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true, recordId: record.id };
}
