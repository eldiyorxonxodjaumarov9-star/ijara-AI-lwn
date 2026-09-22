import { NextResponse } from "next/server";

import { mapTtlockErrorToUz } from "@/lib/api-server/ttlock/errors";

/** TTLock route’lar uchun { success, data?, error? } formati */
export function ttlockOk<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function ttlockFail(
  code: string,
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Map requireUser failures for TTLock routes.
 * - True auth failures (401) → TTLOCK_AUTH_REQUIRED
 * - Plan / other errors (e.g. 403 PLAN_UPGRADE_REQUIRED) pass through unchanged
 */
export function ttlockFromRequireUserError(error: NextResponse): NextResponse {
  if (error.status === 401) {
    return ttlockFail(
      "TTLOCK_AUTH_REQUIRED",
      "Autentifikatsiya talab qilinadi",
      401
    );
  }
  return error;
}

export function ttlockFailFromUnknown(err: unknown) {
  const mapped = mapTtlockErrorToUz(err);
  return ttlockFail(mapped.code, mapped.message, mapped.httpStatus);
}
