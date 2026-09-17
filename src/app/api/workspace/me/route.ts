import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  resolveUserWorkspaceContext,
  toPublicSubscriptionView,
} from "@/lib/api-server/workspace";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const ctx = await resolveUserWorkspaceContext(auth.user);
  return ok(toPublicSubscriptionView(ctx));
}
