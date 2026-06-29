import type { ListingPostInput } from "@/lib/posting/types";
import { buildManualPackage, generatePostText } from "@/lib/posting/copy-generator";
import {
  InstagramError,
  isInstagramConnected,
  isInstagramEnabled,
  loadInstagramConfig,
  publishInstagramPost,
} from "@/lib/api-server/integrations/instagram-service";
import type { AdapterResult, PostingChannelConfig } from "./types";

export async function instagramPoster(
  listing: ListingPostInput,
  channel: PostingChannelConfig | null,
  generatedText?: string
): Promise<AdapterResult> {
  const text = generatedText ?? generatePostText(listing, "INSTAGRAM");
  const cfg = await loadInstagramConfig();
  const enabled = channel?.enabled ?? cfg.enabled;
  const accountName =
    channel?.settings.igUsername?.trim() ||
    channel?.settings.accountName?.trim() ||
    cfg.username ||
    "Instagram";

  if (!enabled) {
    return {
      status: "MANUAL_REQUIRED",
      generatedText: text,
      manualPackage: buildManualPackage(listing, "INSTAGRAM"),
      errorMessage: "Instagram o'chirilgan",
      channelName: accountName,
    };
  }

  const connected = await isInstagramConnected();
  if (!connected) {
    return {
      status: "MANUAL_REQUIRED",
      generatedText: text,
      manualPackage: buildManualPackage(listing, "INSTAGRAM"),
      errorMessage: "Instagram ulanmagan",
      channelName: accountName,
    };
  }

  if (!listing.images?.[0]) {
    return {
      status: "MANUAL_REQUIRED",
      generatedText: text,
      manualPackage: buildManualPackage(listing, "INSTAGRAM"),
      errorMessage: "Instagram uchun rasm kerak",
      channelName: accountName,
    };
  }

  try {
    const result = await publishInstagramPost(listing);
    return {
      status: "POSTED",
      externalPostId: result.mediaId,
      postUrl: result.postUrl ?? result.permalink,
      channelName: result.channelName ?? accountName,
      generatedText: text,
    };
  } catch (err) {
    const message =
      err instanceof InstagramError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Instagram xatosi";

    const manualRequired =
      err instanceof InstagramError &&
      ["disabled", "not_connected", "image_url_invalid", "image_missing"].includes(err.code);

    return {
      status: manualRequired ? "MANUAL_REQUIRED" : "FAILED",
      generatedText: text,
      errorMessage: message,
      manualPackage: buildManualPackage(listing, "INSTAGRAM"),
      channelName: accountName,
    };
  }
}
