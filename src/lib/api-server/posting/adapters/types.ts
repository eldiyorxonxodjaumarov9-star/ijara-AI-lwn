import type { PostingPlatform } from "@/lib/posting/types";

export type PostingChannelConfig = {
  platform: PostingPlatform;
  enabled: boolean;
  settings: Record<string, string>;
  secrets: Record<string, string>;
};

export type AdapterResult = {
  status: "POSTED" | "FAILED" | "MANUAL_REQUIRED" | "PENDING";
  externalPostId?: string;
  postUrl?: string;
  channelName?: string;
  errorMessage?: string;
  manualPackage?: import("@/lib/posting/types").ManualPostingPackage;
  generatedText: string;
};

export function buildTelegramPostUrl(chatId: string, messageId: string): string | undefined {
  if (!messageId) return undefined;
  if (chatId.startsWith("@")) {
    return `https://t.me/${chatId.slice(1)}/${messageId}`;
  }
  const numeric = chatId.replace("-100", "").replace("-", "");
  if (numeric && /^\d+$/.test(numeric)) {
    return `https://t.me/c/${numeric}/${messageId}`;
  }
  return undefined;
}

export function buildInstagramPostUrl(mediaId: string): string | undefined {
  if (!mediaId) return undefined;
  return `https://www.instagram.com/p/${mediaId}`;
}
