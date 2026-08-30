import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  ttlockFail,
  ttlockFailFromUnknown,
  ttlockOk,
} from "@/lib/api-server/ttlock/http";
import { listAssignableTtlockLocks } from "@/lib/api-server/ttlock/room-lock-assign";
import { listTtlockLocks } from "@/lib/api-server/ttlock/service";

/**
 * GET /api/integrations/ttlock/locks
 * ?propertyId=… → xonaga biriktirish uchun assignable DTO (assignment holatlari bilan)
 * propertyId yo‘q → sozlamalar panelidagi oddiy public lock ro‘yxati
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return ttlockFail("TTLOCK_DB_UNAVAILABLE", "DATABASE_URL sozlanmagan", 501);
  }
  const auth = await requireUser(req);
  if (auth.error) {
    return ttlockFail("TTLOCK_AUTH_REQUIRED", "Autentifikatsiya talab qilinadi", 401);
  }

  try {
    const propertyId = req.nextUrl.searchParams.get("propertyId")?.trim() || null;
    if (propertyId) {
      const locks = await listAssignableTtlockLocks(auth.user, propertyId);
      return ttlockOk({ locks, count: locks.length, propertyId });
    }
    const locks = await listTtlockLocks(auth.user);
    return ttlockOk({ locks, count: locks.length });
  } catch (err) {
    return ttlockFailFromUnknown(err);
  }
}
