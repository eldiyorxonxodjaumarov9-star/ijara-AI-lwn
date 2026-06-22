const TELEGRAM_API = "https://api.telegram.org";

export function isTelegramBotConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

function botToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  return token;
}

async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) {
    throw new Error(data.description ?? "Telegram API xatosi");
  }
  return data.result as T;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  extra?: Record<string, unknown>
) {
  if (!isTelegramBotConfigured()) return false;
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
  return true;
}

export async function sendContactRequest(chatId: string | number) {
  return sendTelegramMessage(
    chatId,
    "Assalomu alaykum! 👋\n\n" +
      "<b>ArendaAi</b> botiga xush kelibsiz.\n\n" +
      "Telefon raqamingizni yuboring — bazada bormi tekshiramiz.\n" +
      "Topilsa, xona, shartnoma va to'lov ma'lumotlari chiqadi.\n\n" +
      "📱 Tugma orqali yuboring yoki raqamni yozing:\n" +
      "<code>+998901234567</code>",
    {
      reply_markup: {
        keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}

export async function setTelegramWebhook(webhookUrl: string) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return telegramRequest<boolean>("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {}),
  });
}

export async function getTelegramWebhookInfo() {
  return telegramRequest<{
    url?: string;
    pending_update_count?: number;
  }>("getWebhookInfo");
}

export type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    contact?: {
      phone_number: string;
      first_name?: string;
      last_name?: string;
    };
  };
};
