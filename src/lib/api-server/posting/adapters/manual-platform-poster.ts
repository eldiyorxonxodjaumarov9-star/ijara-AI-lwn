import type { ListingPostInput, PostingPlatform } from "@/lib/posting/types";
import { buildManualPackage, generatePostText } from "@/lib/posting/copy-generator";
import type { AdapterResult, PostingChannelConfig } from "./types";

const PLATFORM_LABEL: Record<string, string> = {
  OLX: "OLX.uz",
  JOYMEE: "Joymee",
  EGASI: "egasi.uz",
  BESTE: "Beste",
};

export function createManualPlatformPoster(platform: PostingPlatform) {
  return async function manualPlatformPoster(
    listing: ListingPostInput,
    channel: PostingChannelConfig | null,
    generatedText?: string
  ): Promise<AdapterResult> {
    const text = generatedText ?? generatePostText(listing, platform);
    const label = PLATFORM_LABEL[platform] ?? platform;

    if (!channel?.enabled) {
      return {
        status: "PENDING",
        generatedText: text,
        errorMessage: `${label} o'chirilgan`,
      };
    }

    return {
      status: "MANUAL_REQUIRED",
      generatedText: text,
      manualPackage: buildManualPackage(listing, platform),
      channelName: label,
    };
  };
}

export const olxPoster = createManualPlatformPoster("OLX");
export const joymeePoster = createManualPlatformPoster("JOYMEE");
export const egasiPoster = createManualPlatformPoster("EGASI");
export const bestePoster = createManualPlatformPoster("BESTE");

export function markManualRequired(
  listing: ListingPostInput,
  platform: PostingPlatform,
  reason?: string
): AdapterResult {
  return {
    status: "MANUAL_REQUIRED",
    generatedText: generatePostText(listing, platform),
    manualPackage: buildManualPackage(listing, platform),
    errorMessage: reason,
  };
}
