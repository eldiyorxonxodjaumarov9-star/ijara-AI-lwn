import { NextRequest } from "next/server";

import {
  attendanceWebhookSecret,
  isAttendanceBotConfigured,
  isAttendanceBotEnabled,
} from "@/lib/api-server/attendance-bot/config";
import {
  attendanceDeleteWebhook,
  attendanceSetWebhook,
} from "@/lib/api-server/attendance-bot/telegram";
import { fail, ok } from "@/lib/api-server/http";

/**
 * Local/dev helper to setWebhook for the attendance bot only.
 * Protect with SETUP_SECRET (never the main bot token).
 * Does not call setWebhook on TELEGRAM_BOT_TOKEN.
 */
export async function POST(req: NextRequest) {
  if (!isAttendanceBotEnabled()) {
    return fail("IJARA_ATTENDANCE_ENABLED=false", 501);
  }
  if (!isAttendanceBotConfigured()) {
    return fail("IJARA_ATTENDANCE_BOT_TOKEN sozlanmagan", 501);
  }

  const setupSecret = process.env.SETUP_SECRET?.trim();
  if (!setupSecret) {
    return fail("SETUP_SECRET sozlanmagan", 503);
  }
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (auth !== setupSecret) {
    return fail("Ruxsat yo'q", 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    webhookUrl?: string;
    clear?: boolean;
  };

  try {
    if (body.clear) {
      await attendanceDeleteWebhook();
      return ok({ cleared: true });
    }
    const webhookUrl = body.webhookUrl?.trim();
    if (!webhookUrl) {
      return fail("webhookUrl majburiy", 400);
    }
    if (!webhookUrl.includes("/api/attendance-bot/webhook")) {
      return fail(
        "webhookUrl /api/attendance-bot/webhook ni o‘z ichiga olishi kerak",
        400
      );
    }
    const secret = attendanceWebhookSecret();
    if (!secret) {
      return fail("IJARA_ATTENDANCE_WEBHOOK_SECRET sozlanmagan", 503);
    }
    await attendanceSetWebhook(webhookUrl, secret);
    return ok({ set: true, webhookUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup xatosi";
    const safe = message.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot***");
    return fail(safe, 500);
  }
}
