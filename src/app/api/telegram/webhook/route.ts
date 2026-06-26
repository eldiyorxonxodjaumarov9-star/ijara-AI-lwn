import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  getTelegramWebhookInfo,
  isTelegramBotConfigured,
  type TelegramUpdate,
} from "@/lib/api-server/telegram-bot";
import { handleTelegramUpdate } from "@/lib/api-server/telegram-handler";

export async function POST(req: NextRequest) {
  if (!isTelegramBotConfigured()) {
    return fail("TELEGRAM_BOT_TOKEN sozlanmagan", 501);
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return fail("Ruxsat yo'q", 403);
    }
  }

  try {
    const update = (await req.json()) as TelegramUpdate;
    await handleTelegramUpdate(update);
    return ok({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook xatosi";
    return fail(message, 500);
  }
}

export async function GET() {
  if (!isTelegramBotConfigured()) {
    return ok({ configured: false });
  }
  try {
    const info = await getTelegramWebhookInfo();
    return ok({ configured: true, webhook: info });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Xatolik";
    return ok({ configured: true, error: message });
  }
}
