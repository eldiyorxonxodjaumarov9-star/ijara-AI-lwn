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

export function ttlockFailFromUnknown(err: unknown) {
  const mapped = mapTtlockErrorToUz(err);
  return ttlockFail(mapped.code, mapped.message, mapped.httpStatus);
}
