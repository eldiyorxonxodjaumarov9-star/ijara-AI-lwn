import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  ttlockFail,
  ttlockFailFromUnknown,
  ttlockFromRequireUserError,
  ttlockOk,
} from "@/lib/api-server/ttlock/http";
import { disconnectTtlock } from "@/lib/api-server/ttlock/service";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return ttlockFail("TTLOCK_DB_UNAVAILABLE", "DATABASE_URL sozlanmagan", 501);
  }
  const auth = await requireUser(req);
  if (auth.error) {
    return ttlockFromRequireUserError(auth.error);
  }

  try {
    const data = await disconnectTtlock(auth.user);
    return ttlockOk(data);
  } catch (err) {
    return ttlockFailFromUnknown(err);
  }
}
