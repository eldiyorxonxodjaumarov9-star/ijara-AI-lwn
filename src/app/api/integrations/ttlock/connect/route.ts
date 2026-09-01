import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  ttlockFail,
  ttlockFailFromUnknown,
  ttlockOk,
} from "@/lib/api-server/ttlock/http";
import { connectTtlock } from "@/lib/api-server/ttlock/service";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return ttlockFail("TTLOCK_DB_UNAVAILABLE", "DATABASE_URL sozlanmagan", 501);
  }
  const auth = await requireUser(req);
  if (auth.error) {
    return ttlockFail("TTLOCK_AUTH_REQUIRED", "Autentifikatsiya talab qilinadi", 401);
  }

  try {
    const data = await connectTtlock(auth.user);
    return ttlockOk(data);
  } catch (err) {
    return ttlockFailFromUnknown(err);
  }
}
