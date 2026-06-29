const API = "https://api.telegram.org/bot";

type TgResponse<T> = {
  ok: boolean;
  description?: string;
  result?: T;
};

async function tgCall<T>(
  token: string,
  method: string,
  body?: Record<string, unknown> | FormData
): Promise<T> {
  const res = await fetch(`${API}${token}/${method}`, {
    method: "POST",
    ...(body instanceof FormData
      ? { body }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        }),
  });
  const data = (await res.json()) as TgResponse<T>;
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram ${method} xatosi`);
  }
  return data.result as T;
}

export function resolveBotToken(explicit?: string) {
  return explicit?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export async function getBotInfo(token: string) {
  return tgCall<{ id: number; username?: string }>(token, "getMe");
}

export async function getChatMember(
  token: string,
  chatId: string,
  userId: number
) {
  return tgCall<{ status: string }>(token, "getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });
}

export async function checkBotAdminStatus(token: string, chatId: string) {
  const bot = await getBotInfo(token);
  const member = await getChatMember(token, chatId, bot.id);
  const isAdmin = ["administrator", "creator"].includes(member.status);
  return {
    isAdmin,
    status: member.status,
    botUsername: bot.username,
  };
}

export function buildTelegramPostUrl(
  chatId: string,
  messageId: string,
  username?: string | null
) {
  if (username) {
    return `https://t.me/${username.replace(/^@/, "")}/${messageId}`;
  }
  const internal = chatId.replace(/^-100/, "");
  return `https://t.me/c/${internal}/${messageId}`;
}

export async function sendTelegramText(
  token: string,
  chatId: string,
  text: string
) {
  const result = await tgCall<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
  return String(result.message_id);
}

function photoInput(photo: string, form: FormData, field: string) {
  if (photo.startsWith("http://") || photo.startsWith("https://")) {
    form.append(field, photo);
    return;
  }
  if (photo.startsWith("data:")) {
    const match = photo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Rasm formati noto'g'ri");
    form.append(
      field,
      new Blob([Buffer.from(match[2], "base64")], { type: match[1] }),
      "photo.jpg"
    );
    return;
  }
  throw new Error("Telegram uchun URL yoki base64 rasm kerak");
}

export async function sendTelegramPhoto(
  token: string,
  chatId: string,
  photo: string,
  caption: string
) {
  if (photo.startsWith("http://") || photo.startsWith("https://")) {
    const result = await tgCall<{ message_id: number }>(token, "sendPhoto", {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: "HTML",
    });
    return String(result.message_id);
  }

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  photoInput(photo, form, "photo");
  const result = await tgCall<{ message_id: number }>(token, "sendPhoto", form);
  return String(result.message_id);
}

/** Bir nechta rasm — oxirgisi caption bilan */
export async function sendTelegramMediaGroup(
  token: string,
  chatId: string,
  images: string[],
  caption: string
) {
  const urls = images.filter(
    (u) => u.startsWith("http://") || u.startsWith("https://")
  );

  if (urls.length === 0) {
    return sendTelegramText(token, chatId, caption);
  }

  if (urls.length === 1) {
    return sendTelegramPhoto(token, chatId, urls[0], caption);
  }

  const batch = urls.slice(0, 10);
  const media = batch.map((url, i) => ({
    type: "photo",
    media: url,
    ...(i === batch.length - 1 ? { caption, parse_mode: "HTML" } : {}),
  }));

  const result = await tgCall<Array<{ message_id: number }>>(
    token,
    "sendMediaGroup",
    {
      chat_id: chatId,
      media,
    }
  );

  const last = result[result.length - 1];
  return String(last?.message_id ?? result[0]?.message_id ?? "");
}

export async function sendTestChannelMessage(
  token: string,
  chatId: string,
  channelName: string
) {
  const text = [
    "✅ <b>Arenda AI — test xabari</b>",
    "",
    `Kanal: ${channelName}`,
    `Vaqt: ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}`,
    "",
    "Bot ushbu kanalga e'lonlarni yubora oladi.",
  ].join("\n");
  return sendTelegramText(token, chatId, text);
}
