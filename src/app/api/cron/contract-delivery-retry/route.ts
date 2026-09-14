import { NextRequest } from "next/server";

import { processPendingContractDeliveries } from "@/lib/api-server/contract-draft/bot";
import { assertFailClosedCronAuth } from "@/lib/api-server/cron-auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

async function handle(req: NextRequest) {
  const denied = assertFailClosedCronAuth(req);
  if (denied) return denied;
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  await processPendingContractDeliveries(20, { inlineRetries: 1 });
  return ok({ ok: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
