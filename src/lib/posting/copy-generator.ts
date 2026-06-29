import { formatUzs } from "@/lib/rental-search";
import type { ListingPostInput, ManualPostingPackage, PostingPlatform } from "@/lib/posting/types";

/** AI Auto Poster — barcha platformalar uchun asosiy matn */
export function generateAiPostBase(listing: ListingPostInput) {
  const lines = [
    "🏠 Yangi ijara e'loni!",
    "",
    `📍 Hudud: ${listing.district}`,
    `🏢 Mulk turi: ${listing.propertyType}`,
    `🛏 Xona: ${listing.rooms} ta`,
    `📐 Maydon: ${listing.area} m²`,
    `💰 Narx: ${formatUzs(listing.price)} / oy`,
  ];
  if (listing.description?.trim()) {
    lines.push("", listing.description.trim());
  }
  lines.push("", "Batafsil ma'lumot uchun Arenda AI orqali bog'laning.");
  return lines.join("\n");
}

export function generateTelegramPost(listing: ListingPostInput) {
  const lines = [
    "🏠 <b>Yangi ijara e'loni!</b>",
    "",
    `📍 Hudud: ${escapeHtml(listing.district)}`,
    `🏢 Mulk turi: ${escapeHtml(listing.propertyType)}`,
    `🛏 Xona: ${listing.rooms} ta`,
    `📐 Maydon: ${listing.area} m²`,
    `💰 Narx: <b>${escapeHtml(formatUzs(listing.price))}</b> / oy`,
  ];
  if (listing.description?.trim()) {
    lines.push("", escapeHtml(listing.description.trim()));
  }
  lines.push("", "📲 Batafsil: Arenda AI orqali bog'laning");
  return lines.join("\n");
}

export function generateInstagramPost(listing: ListingPostInput) {
  const base = generateAiPostBase(listing);
  const tags = [
    "#ijara",
    "#toshkent",
    "#arenda",
    "#uzbekistan",
    "#ijara_uz",
    `#${slugTag(listing.district)}`,
    `#${slugTag(listing.propertyType)}`,
  ].join(" ");
  return `${base}\n\n${tags}`;
}

export function generateFormalPost(listing: ListingPostInput, platform: string) {
  return [
    `[${platform}] ${listing.title}`,
    "",
    generateAiPostBase(listing),
    "",
    "Aloqa: Arenda AI platformasi orqali",
  ].join("\n");
}

export function buildManualPackage(
  listing: ListingPostInput,
  platform: PostingPlatform
): ManualPostingPackage {
  const label =
    platform === "OLX"
      ? "OLX.uz"
      : platform === "JOYMEE"
        ? "Joymee"
        : platform === "EGASI"
          ? "egasi.uz"
          : platform === "BESTE"
            ? "Beste"
            : platform === "TELEGRAM"
              ? "Telegram"
              : platform === "INSTAGRAM"
                ? "Instagram"
                : platform;

  const body =
    platform === "INSTAGRAM"
      ? generateInstagramPost(listing)
      : platform === "TELEGRAM"
        ? generateAiPostBase(listing)
        : generateFormalPost(listing, label);

  return {
    platform,
    title: listing.title,
    body,
    hashtags:
      platform === "INSTAGRAM"
        ? "#ijara #toshkent #arenda #uzbekistan #ijara_uz"
        : undefined,
    imageUrls: listing.images ?? [],
    tips: `${label} saytiga kiring, «E'lon joylash» bo'limini oching, matnni nusxalang va rasmlarni yuklang.`,
  };
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugTag(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF]+/g, "")
    .slice(0, 24);
}

export function generatePostText(listing: ListingPostInput, platform: PostingPlatform) {
  return getGeneratedText(listing, platform);
}

export function getGeneratedText(listing: ListingPostInput, platform: PostingPlatform) {
  switch (platform) {
    case "TELEGRAM":
      return generateTelegramPost(listing);
    case "INSTAGRAM":
      return generateInstagramPost(listing);
    case "ARENDA_INTERNAL":
      return generateFormalPost(listing, "Arenda AI");
    default:
      return generateFormalPost(
        listing,
        platform === "OLX"
          ? "OLX.uz"
          : platform === "JOYMEE"
            ? "Joymee"
            : platform === "EGASI"
              ? "egasi.uz"
              : "Beste"
      );
  }
}
