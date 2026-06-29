import type { ListingPostInput, PostingPlatform } from "@/lib/posting/types";
import { generatePostText } from "@/lib/posting/copy-generator";
import type { AdapterResult, PostingChannelConfig } from "./types";
import { instagramPoster } from "./instagram-poster";
import {
  bestePoster,
  egasiPoster,
  joymeePoster,
  olxPoster,
} from "./manual-platform-poster";
import { telegramPoster } from "./telegram-poster";

export type { AdapterResult, PostingChannelConfig } from "./types";

export async function runPlatformAdapter(
  platform: PostingPlatform,
  listing: ListingPostInput,
  channel: PostingChannelConfig | null
): Promise<AdapterResult> {
  const generatedText = generatePostText(listing, platform);

  if (platform === "ARENDA_INTERNAL") {
    return {
      status: "POSTED",
      externalPostId: listing.legacyLocalId ?? "internal",
      postUrl: "/ijara-qidiruv",
      channelName: "Arenda AI",
      generatedText,
    };
  }

  switch (platform) {
    case "TELEGRAM":
      return telegramPoster(listing, channel, generatedText);
    case "INSTAGRAM":
      return instagramPoster(listing, channel, generatedText);
    case "OLX":
      return olxPoster(listing, channel, generatedText);
    case "JOYMEE":
      return joymeePoster(listing, channel, generatedText);
    case "EGASI":
      return egasiPoster(listing, channel, generatedText);
    case "BESTE":
      return bestePoster(listing, channel, generatedText);
    default:
      return { status: "PENDING", generatedText };
  }
}

export { telegramPoster } from "./telegram-poster";
export { instagramPoster } from "./instagram-poster";
export { olxPoster, joymeePoster, egasiPoster, bestePoster } from "./manual-platform-poster";
