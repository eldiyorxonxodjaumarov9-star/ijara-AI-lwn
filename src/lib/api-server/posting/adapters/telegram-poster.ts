import type { ListingPostInput } from "@/lib/posting/types";
import { generatePostText } from "@/lib/posting/copy-generator";
import type { AdapterResult, PostingChannelConfig } from "./types";

export async function telegramPoster(
  listing: ListingPostInput,
  channel: PostingChannelConfig | null,
  generatedText?: string
): Promise<AdapterResult> {
  const text = generatedText ?? generatePostText(listing, "TELEGRAM");

  if (!channel?.enabled) {
    return { status: "PENDING", generatedText: text, errorMessage: "Telegram o'chirilgan" };
  }

  const token =
    channel.secrets.botToken?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId =
    channel.settings.channelId?.trim() ||
    channel.secrets.channelId?.trim() ||
    process.env.TELEGRAM_LISTING_CHANNEL_ID?.trim();
  const channelName =
    channel.settings.channelName?.trim() || chatId || "Telegram kanal";

  if (!token || !chatId) {
    const { buildManualPackage } = await import("@/lib/posting/copy-generator");
    return {
      status: "MANUAL_REQUIRED",
      generatedText: text,
      manualPackage: buildManualPackage(listing, "TELEGRAM"),
      errorMessage: "Telegram token yoki kanal ID sozlanmagan",
      channelName,
    };
  }

  try {
    const firstImage = listing.images?.[0];
    const messageId = firstImage
      ? await sendTelegramPhoto(token, chatId, firstImage, text)
      : await sendTelegramMessage(token, chatId, text);

    const { buildTelegramPostUrl } = await import("./types");
    return {
      status: "POSTED",
      externalPostId: messageId,
      postUrl: buildTelegramPostUrl(chatId, messageId),
      channelName,
      generatedText: text,
    };
  } catch (err) {
    const { buildManualPackage } = await import("@/lib/posting/copy-generator");
    return {
      status: "FAILED",
      generatedText: text,
      errorMessage: err instanceof Error ? err.message : "Telegram xatosi",
      manualPackage: buildManualPackage(listing, "TELEGRAM"),
      channelName,
    };
  }
}

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: { message_id: number };
  };
  if (!data.ok) throw new Error(data.description ?? "Telegram sendMessage xatosi");
  return String(data.result?.message_id ?? "");
}

async function sendTelegramPhoto(
  token: string,
  chatId: string,
  photo: string,
  caption: string
) {
  if (photo.startsWith("http://") || photo.startsWith("https://")) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo, caption, parse_mode: "HTML" }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };
    if (!data.ok) throw new Error(data.description ?? "Telegram sendPhoto xatosi");
    return String(data.result?.message_id ?? "");
  }

  if (photo.startsWith("data:")) {
    const match = photo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Rasm formati noto'g'ri");
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append(
      "photo",
      new Blob([Buffer.from(match[2], "base64")], { type: match[1] }),
      "photo.jpg"
    );
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };
    if (!data.ok) throw new Error(data.description ?? "Telegram rasm yuklash xatosi");
    return String(data.result?.message_id ?? "");
  }

  throw new Error("Telegram uchun URL yoki base64 rasm kerak");
}
