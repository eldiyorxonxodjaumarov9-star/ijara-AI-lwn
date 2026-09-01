import { timingSafeEqual } from "crypto";

import { fail } from "@/lib/api-server/http";

export const CRON_NOT_CONFIGURED_CODE = "CRON_NOT_CONFIGURED";

const BEARER_PREFIX = "Bearer ";

export function readCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? secret : null;
}

/** Uzunlik farqi bo‘lsa ham exception chiqarmaydi */
export function timingSafeSecretEqual(
  provided: string,
  expected: string
): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    if (providedBuf.length > 0) {
      timingSafeEqual(providedBuf, Buffer.alloc(providedBuf.length));
    }
    return false;
  }
  if (providedBuf.length === 0) {
    return expected.length === 0;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Fail-closed cron auth — secret majburiy.
 * Secret yo‘q/bo‘sh → 503 CRON_NOT_CONFIGURED; noto‘g‘ri bearer → 403.
 */
export function assertFailClosedCronAuth(req: Request): Response | null {
  const cronSecret = readCronSecret();
  if (!cronSecret) {
    return fail("Service Unavailable", 503, CRON_NOT_CONFIGURED_CODE);
  }

  const auth = req.headers.get("authorization");
  if (!auth) {
    return fail("Ruxsat yo'q", 403);
  }

  if (!auth.startsWith(BEARER_PREFIX)) {
    return fail("Ruxsat yo'q", 403);
  }

  const token = auth.slice(BEARER_PREFIX.length);
  if (!timingSafeSecretEqual(token, cronSecret)) {
    return fail("Ruxsat yo'q", 403);
  }

  return null;
}
