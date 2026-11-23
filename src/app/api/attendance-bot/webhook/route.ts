import { NextRequest } from "next/server";

import {
  attendanceWebhookSecret,
  isAttendanceBotConfigured,
} from "@/lib/api-server/attendance-bot/config";
import { handleAttendanceUpdate } from "@/lib/api-server/attendance-bot/handler";
import {
  attendanceGetWebhookInfo,
  type AttendanceUpdate,
} from "@/lib/api-server/attendance-bot/telegram";
import { fail, ok } from "@/lib/api-server/http";

/**
 * Mustaqil davomat boti webhook.
 * Asosiy /api/telegram/webhook ga tegmaydi.
 */
export async function POST(req: NextRequest) {
  if (!isAttendanceBotConfigured()) {
    return fail("Davomat boti o‘chirilgan yoki token yo‘q", 501);
  }

  const secret = attendanceWebhookSecret();
  if (!secret) {
    return fail("IJARA_ATTENDANCE_WEBHOOK_SECRET sozlanmagan", 503);
  }
  const header = req.headers.get("x-telegram-bot-api-secret-token");
  if (header !== secret) {
    return fail("Ruxsat yo'q", 403);
  }

  try {
    const update = (await req.json()) as AttendanceUpdate;
    await handleAttendanceUpdate(update);
    return ok({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook xatosi";
    const safe = message.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot***");
    return fail(safe, 500);
  }
}

export async function GET() {
  if (!isAttendanceBotConfigured()) {
    return ok({ configured: false, bot: "attendance" });
  }
  try {
    const info = await attendanceGetWebhookInfo();
    return ok({ configured: true, bot: "attendance", webhook: info });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Xatolik";
    return ok({ configured: true, bot: "attendance", error: message });
  }
}
