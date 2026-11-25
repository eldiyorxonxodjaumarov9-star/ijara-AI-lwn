import { NextRequest } from "next/server";

import { assertFailClosedCronAuth } from "@/lib/api-server/cron-auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { processPendingQrFeedbackTelegram } from "@/lib/api-server/qr-feedback/telegram-notify";

/**
 * Durable retry for QR cleanliness → Telegram delivery (PENDING / FAILED).
 * Vercel Cron + manual POST with CRON_SECRET.
 */
async function handle(req: NextRequest) {
  const denied = assertFailClosedCronAuth(req);
  if (denied) return denied;
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 20;
  const result = await processPendingQrFeedbackTelegram(
    Number.isFinite(limit) ? limit : 20
  );
  return ok({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
