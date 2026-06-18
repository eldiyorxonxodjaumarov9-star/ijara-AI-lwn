import { NextRequest } from "next/server";

import { requireUser, sanitizeUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  return ok(sanitizeUser(auth.user));
}
