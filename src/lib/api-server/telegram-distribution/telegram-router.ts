import type { ListingPostInput } from "@/lib/posting/types";

export type RoutableChannel = {
  id: string;
  name: string;
  username?: string | null;
  chatId: string;
  enabled: boolean;
  regionFilters: string[];
  propertyTypeFilters: string[];
  priority: number;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function matchesFilter(values: string[], target: string) {
  if (!values.length) return true;
  const t = norm(target);
  return values.some((v) => {
    const f = norm(v);
    if (f === "*" || f === "all" || f === "barchasi") return true;
    return t.includes(f) || f.includes(t);
  });
}

/**
 * Hudud va mulk turiga qarab kanallarni tanlaydi.
 * Masalan: Chilonzor → mahalliy + shahar + umumiy kanallar.
 */
export function routeTelegramChannels(
  listing: Pick<ListingPostInput, "district" | "propertyType"> & {
    region?: string | null;
  },
  channels: RoutableChannel[]
): RoutableChannel[] {
  const regionTarget = [listing.region, listing.district]
    .filter(Boolean)
    .join(" ");

  return channels
    .filter((c) => c.enabled)
    .filter(
      (c) =>
        matchesFilter(c.regionFilters, regionTarget) &&
        matchesFilter(c.propertyTypeFilters, listing.propertyType)
    )
    .sort((a, b) => b.priority - a.priority);
}

export function explainRouting(
  listing: Pick<ListingPostInput, "district" | "propertyType"> & {
    region?: string | null;
  },
  channel: RoutableChannel
) {
  const regionTarget = [listing.region, listing.district].filter(Boolean).join(" ");
  return {
    regionMatch: matchesFilter(channel.regionFilters, regionTarget),
    propertyTypeMatch: matchesFilter(
      channel.propertyTypeFilters,
      listing.propertyType
    ),
    priority: channel.priority,
  };
}
