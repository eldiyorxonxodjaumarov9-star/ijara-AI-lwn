import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import {
  getTelegramWebhookInfo,
  isTelegramBotConfigured,
  setTelegramWebhook,
} from "@/lib/api-server/telegram-bot";

function appOrigin(req: NextRequest) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/** Admin: Telegram webhook URL ni o'rnatish */
export async function POST(req: NextRequest) {
  if (!isTelegramBotConfigured()) {
    return fail("TELEGRAM_BOT_TOKEN sozlanmagan", 501);
  }
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const origin = appOrigin(req);
  if (!origin) return fail("APP URL aniqlanmadi", 400);

  const webhookUrl = `${origin}/api/telegram/webhook`;
  try {
    await setTelegramWebhook(webhookUrl);
    const info = await getTelegramWebhookInfo();
    return ok({ webhookUrl, info });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook xatosi";
    return fail(message, 500);
  }
}

export async function GET(req: NextRequest) {
  if (!isTelegramBotConfigured()) {
    return ok({ configured: false });
  }
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const origin = appOrigin(req);
  const info = await getTelegramWebhookInfo();
  return ok({
    configured: true,
    suggestedWebhookUrl: origin ? `${origin}/api/telegram/webhook` : null,
    info,
  });
}
