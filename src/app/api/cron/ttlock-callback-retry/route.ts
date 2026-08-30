import { NextRequest } from "next/server";

import { assertFailClosedCronAuth } from "@/lib/api-server/cron-auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { runCallbackRetrySweep } from "@/lib/api-server/ttlock/callback-retry-sweep";

async function handleCallbackRetryCron(req: NextRequest, workerPrefix: string) {
  const denied = assertFailClosedCronAuth(req);
  if (denied) return denied;

  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 503);
  }

  const result = await runCallbackRetrySweep(workerPrefix);
  return ok({
    ...result,
    message: "Callback retry sweep yakunlandi.",
  });
}

/** Vercel Cron GET + manual POST (CRON_SECRET majburiy) */
export async function GET(req: NextRequest) {
  return handleCallbackRetryCron(req, "cron-get");
}

export async function POST(req: NextRequest) {
  return handleCallbackRetryCron(req, "cron-post");
}
