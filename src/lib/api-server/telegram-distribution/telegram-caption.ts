import { formatUzs } from "@/lib/rental-search";
import type { ListingPostInput } from "@/lib/posting/types";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugTag(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "")
    .slice(0, 24);
}

export function generateTelegramDistributionCaption(
  listing: ListingPostInput & { region?: string | null },
  listingUrl?: string
) {
  const baseUrl =
    listingUrl ??
    process.env.NEXT_PUBLIC_APP_URL?.trim() ??
    "https://www.arendaai.uz";
  const link = `${baseUrl.replace(/\/$/, "")}/ijara-qidiruv`;

  const regionLabel = listing.region?.trim() || listing.district;

  const lines = [
    "🏠 <b>Yangi ijara e'loni!</b>",
    "",
    `📍 Hudud: ${escapeHtml(regionLabel)}`,
    listing.region && listing.region !== listing.district
      ? `🗺 Tuman: ${escapeHtml(listing.district)}`
      : null,
    `🏢 Mulk turi: ${escapeHtml(listing.propertyType)}`,
    `🛏 Xona: ${listing.rooms} ta`,
    `📐 Maydon: ${listing.area} m²`,
    `💰 Narx: <b>${escapeHtml(formatUzs(listing.price))}</b> / oy`,
  ].filter(Boolean) as string[];

  if (listing.description?.trim()) {
    lines.push("", escapeHtml(listing.description.trim()));
  }

  const tags = [
    "#ijara",
    "#toshkent",
    "#arendaai",
    "#uzbekistan",
    `#${slugTag(regionLabel)}`,
    `#${slugTag(listing.propertyType)}`,
  ].join(" ");

  lines.push(
    "",
    `🔗 <a href="${link}">Batafsil Arenda AI</a>`,
    "",
    tags
  );

  return lines.join("\n");
}
