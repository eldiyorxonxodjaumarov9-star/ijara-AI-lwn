import type { Property } from "@/types";
import type { RentalListing } from "@/lib/rental-search";
import { PROPERTY_TYPES } from "@/lib/landlord-profile";

const PUBLISHED_IDS_KEY = "arenda:published-property-ids";
const PROPERTIES_KEY = "arendahub:properties";
const SESSION_KEY = "arendahub:session";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(data));
}

export function getPublishedPropertyIds(): string[] {
  return readJson<string[]>(PUBLISHED_IDS_KEY, []);
}

export function isPropertyPublished(propertyId: string) {
  return getPublishedPropertyIds().includes(propertyId);
}

export function publishPropertyToSearch(propertyId: string) {
  const ids = getPublishedPropertyIds();
  if (!ids.includes(propertyId)) {
    writeJson(PUBLISHED_IDS_KEY, [propertyId, ...ids]);
  }
}

export function unpublishPropertyFromSearch(propertyId: string) {
  writeJson(
    PUBLISHED_IDS_KEY,
    getPublishedPropertyIds().filter((id) => id !== propertyId)
  );
}

export function readDashboardProperties(): Property[] {
  return readJson<Property[]>(PROPERTIES_KEY, []);
}

export function getPlatformContact(): { email: string; name: string } {
  const session = readJson<{ email?: string; displayName?: string } | null>(
    SESSION_KEY,
    null
  );
  return {
    email: session?.email?.trim() || "platform@arendaai.uz",
    name: session?.displayName?.trim() || "Arenda AI",
  };
}

function inferPropertyType(property: Property): string {
  const hay = `${property.name} ${property.description ?? ""}`.toLowerCase();
  if (hay.includes("ofis")) return "Ofis";
  if (hay.includes("do'kon") || hay.includes("dokon") || hay.includes("savdo"))
    return "Do'kon";
  if (hay.includes("ombor")) return "Ombor";
  return PROPERTY_TYPES[0];
}

export function propertyToRentalListing(
  property: Property,
  contact = getPlatformContact()
): RentalListing {
  return {
    id: `hub-${property.id}`,
    title: property.name,
    district: property.district || property.region,
    rooms: property.rooms,
    area: property.area,
    price: property.price,
    propertyType: inferPropertyType(property),
    description: property.description ?? "",
    images: property.images?.length ? property.images : undefined,
    source: "platform",
    landlordEmail: contact.email,
    landlordName: contact.name,
  };
}

/** Dashboarddagi bo'sh va e'longa chiqarilgan mulklar — ijara qidiruvda ko'rinadi */
export function getPublishedDashboardListings(): RentalListing[] {
  const published = new Set(getPublishedPropertyIds());
  if (published.size === 0) return [];
  const contact = getPlatformContact();
  return readDashboardProperties()
    .filter((p) => p.status === "available" && published.has(p.id))
    .map((p) => propertyToRentalListing(p, contact));
}
