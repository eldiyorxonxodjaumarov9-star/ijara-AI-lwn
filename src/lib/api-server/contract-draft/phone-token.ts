import { createHash, randomBytes } from "crypto";

import { normalizePhone } from "@/lib/api-server/tenant-lookup";

/** Digits-only → E.164-ish +998… display helper */
export function normalizeContractPhone(raw: string): {
  normalized: string;
  e164: string;
  display: string;
} {
  let digits = normalizePhone(raw);
  if (digits.startsWith("998") && digits.length === 12) {
    // ok
  } else if (digits.length === 9) {
    digits = `998${digits}`;
  } else if (digits.startsWith("0") && digits.length === 10) {
    digits = `998${digits.slice(1)}`;
  }
  if (!/^998\d{9}$/.test(digits)) {
    throw new Error("Telefon raqami noto‘g‘ri. +998 XX XXX XX XX formatida kiriting.");
  }
  const e164 = `+${digits}`;
  const display = `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  return { normalized: digits, e164, display };
}

export function hashContractToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function createContractToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashContractToken(rawToken) };
}

export function contractTokenTtlDays(): number {
  const n = Number(process.env.CONTRACT_FORM_TOKEN_TTL_DAYS ?? "7");
  return Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), 90) : 7;
}

export function contractTokenExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + contractTokenTtlDays() * 24 * 60 * 60 * 1000);
}
