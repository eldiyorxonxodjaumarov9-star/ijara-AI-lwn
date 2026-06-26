import { getLandlordListings, type LandlordListing } from "@/lib/landlord-crm";
import { getPublishedDashboardListings } from "@/lib/platform-rental-bridge";

export type RentalListing = {
  id: string;
  title: string;
  district: string;
  rooms: number;
  area: number;
  price: number;
  propertyType: string;
  description: string;
  images?: string[];
  source: "platform" | "landlord";
  landlordEmail?: string;
  landlordName?: string;
};

const DISTRICTS = [
  "chilonzor",
  "yunusobod",
  "mirzo ulug'bek",
  "mirzo ulugbek",
  "sergeli",
  "yakkasaroy",
  "olmazor",
  "uchtepa",
  "shayxontohur",
  "yashnobod",
  "mirobod",
  "bektemir",
];

const CITY_NAMES = ["toshkent", "samarqand", "buxoro", "andijon", "namangan", "farg'ona", "fargona"];

function isCityOnlyAddress(address: string): boolean {
  const lower = address.trim().toLowerCase().replace(/\s+shahri?$/, "");
  return CITY_NAMES.includes(lower);
}

function propertyTypeMatches(itemType: string, wanted?: string) {
  if (!wanted) return true;
  const a = itemType.toLowerCase();
  const b = wanted.toLowerCase().split(" ")[0];
  return a.includes(b);
}

function districtMatches(
  item: RentalListing,
  districts: string[],
  officeAddress: string
): boolean {
  if (districts.length === 0) return true;
  const addressLower = officeAddress.toLowerCase();
  return districts.some((d) => {
    const needle = d.toLowerCase().slice(0, 4);
    return (
      item.district.toLowerCase().includes(needle) ||
      item.title.toLowerCase().includes(needle) ||
      addressLower.includes(item.district.toLowerCase().slice(0, 4))
    );
  });
}

function scoreListing(
  item: RentalListing,
  input: {
    officeAddress: string;
    maxPrice?: number;
    minArea?: number;
    propertyType?: string;
  },
  districts: string[]
): number {
  let score = 0;
  if (input.propertyType && propertyTypeMatches(item.propertyType, input.propertyType)) {
    score += 4;
  }
  if (districtMatches(item, districts, input.officeAddress)) score += 3;
  if (input.minArea !== undefined && item.area >= input.minArea * 0.85) score += 2;
  if (input.maxPrice !== undefined) {
    if (item.price <= input.maxPrice) score += 3;
    else if (item.price <= input.maxPrice * 1.25) score += 1;
  }
  return score;
}

function listingToRental(l: LandlordListing): RentalListing {
  return {
    id: l.id,
    title: l.title,
    district: l.district,
    rooms: l.rooms,
    area: l.area,
    price: l.price,
    propertyType: l.propertyType,
    description: l.description ?? "",
    images: l.images,
    source: "landlord",
    landlordEmail: l.landlordEmail,
    landlordName: l.landlordName,
  };
}

export function getPostedListings(): RentalListing[] {
  const dashboard = getPublishedDashboardListings();
  const landlord = getLandlordListings()
    .filter((l) => l.status === "active")
    .map(listingToRental);
  return [...dashboard, ...landlord];
}

/** Faqat joylashtirilgan e'lonlar (demo seed yo'q) */
export function getAllSearchListings(): RentalListing[] {
  return getPostedListings();
}

export type ParsedSearch = {
  districts: string[];
  rooms?: number;
  maxPrice?: number;
  minPrice?: number;
  propertyType?: string;
  raw: string;
};

export function parseRentalSearchQuery(query: string): ParsedSearch {
  const lower = query.toLowerCase();
  const districts = DISTRICTS.filter((d) => lower.includes(d));

  const roomMatch = lower.match(/(\d)\s*xonali/);
  const rooms = roomMatch ? Number(roomMatch[1]) : undefined;

  const millionMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*million/);
  const maxPrice = millionMatch
    ? Math.round(Number(millionMatch[1].replace(",", ".")) * 1_000_000)
    : undefined;

  let propertyType: string | undefined;
  if (lower.includes("ofis")) propertyType = "Ofis";
  else if (lower.includes("do'kon") || lower.includes("dokon"))
    propertyType = "Do'kon";
  else if (lower.includes("kvartira") || lower.includes("uy"))
    propertyType = "Kvartira / uy";

  return {
    districts: districts.map((d) =>
      d === "mirzo ulugbek" ? "Mirzo Ulug'bek" : d.charAt(0).toUpperCase() + d.slice(1)
    ),
    rooms,
    maxPrice,
    propertyType,
    raw: query,
  };
}

export function searchRentalListingsFromForm(input: {
  officeAddress: string;
  maxPrice?: number;
  minArea?: number;
  propertyType?: string;
}) {
  const addressParsed = parseRentalSearchQuery(input.officeAddress);
  let districts = addressParsed.districts;
  if (districts.length === 0 && input.officeAddress.trim() && !isCityOnlyAddress(input.officeAddress)) {
    districts = [input.officeAddress.trim()];
  }
  if (districts.length === 1 && isCityOnlyAddress(districts[0])) {
    districts = [];
  }

  const query = [
    input.officeAddress,
    input.minArea ? `${input.minArea} m²` : "",
    input.maxPrice ? `${Math.round(input.maxPrice / 1_000_000)} million` : "",
    input.propertyType ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const parsed: ParsedSearch = {
    districts,
    maxPrice: input.maxPrice,
    propertyType: input.propertyType,
    raw: query,
  };

  const all = getPostedListings();

  const strict = all.filter((item) => {
    if (districts.length > 0 && !districtMatches(item, districts, input.officeAddress)) {
      return false;
    }
    if (input.minArea !== undefined && item.area < input.minArea * 0.85) return false;
    if (parsed.maxPrice !== undefined && item.price > parsed.maxPrice * 1.15) return false;
    if (!propertyTypeMatches(item.propertyType, parsed.propertyType)) return false;
    return true;
  });

  if (strict.length > 0) {
    return {
      parsed,
      results: strict.sort((a, b) => a.price - b.price),
      query,
      mode: "matched" as const,
    };
  }

  const scored = all
    .map((item) => ({ item, score: scoreListing(item, input, districts) }))
    .sort((a, b) => b.score - a.score || a.item.price - b.item.price);

  const relaxed = scored
    .filter(({ score }) => score > 0)
    .map(({ item }) => item);

  const results =
    relaxed.length > 0 ? relaxed : all.sort((a, b) => a.price - b.price);

  return {
    parsed,
    results,
    query,
    mode: relaxed.length > 0 ? ("similar" as const) : ("all" as const),
  };
}

export function searchRentalListings(query: string): {
  parsed: ParsedSearch;
  results: RentalListing[];
} {
  const parsed = parseRentalSearchQuery(query);
  const all = getAllSearchListings();

  const results = all.filter((item) => {
    if (parsed.districts.length > 0) {
      const districtOk = parsed.districts.some((d) =>
        item.district.toLowerCase().includes(d.toLowerCase().slice(0, 4))
      );
      if (!districtOk) return false;
    }
    if (parsed.rooms !== undefined && item.rooms !== parsed.rooms) return false;
    if (parsed.maxPrice !== undefined && item.price > parsed.maxPrice * 1.15)
      return false;
    if (
      parsed.propertyType &&
      !item.propertyType.toLowerCase().includes(parsed.propertyType.split(" ")[0].toLowerCase())
    ) {
      return false;
    }
    if (
      parsed.districts.length === 0 &&
      parsed.rooms === undefined &&
      parsed.maxPrice === undefined &&
      parsed.propertyType === undefined
    ) {
      const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      if (words.length > 0) {
        const hay = `${item.title} ${item.district} ${item.description}`.toLowerCase();
        return words.some((w) => hay.includes(w));
      }
    }
    return true;
  });

  return {
    parsed,
    results: results.sort((a, b) => a.price - b.price),
  };
}

export function formatUzs(amount: number) {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " so'm";
}
