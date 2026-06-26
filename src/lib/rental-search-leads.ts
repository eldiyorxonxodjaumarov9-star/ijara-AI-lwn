import type { ParsedSearch } from "@/lib/rental-search";

export type RentalSearchLead = {
  id: string;
  query: string;
  districts: string[];
  rooms?: number;
  maxPrice?: number;
  propertyType?: string;
  resultsCount: number;
  createdAt: string;
};

const LEADS_KEY = "arenda:rental-search-leads";

export function getRentalSearchLeads(): RentalSearchLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEADS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RentalSearchLead[];
  } catch {
    return [];
  }
}

export function recordRentalSearchLead(
  query: string,
  parsed: ParsedSearch,
  resultsCount: number
) {
  if (typeof window === "undefined") return;
  const leads = getRentalSearchLeads();
  const lead: RentalSearchLead = {
    id: crypto.randomUUID(),
    query: query.trim(),
    districts: parsed.districts,
    rooms: parsed.rooms,
    maxPrice: parsed.maxPrice,
    propertyType: parsed.propertyType,
    resultsCount,
    createdAt: new Date().toISOString(),
  };
  leads.unshift(lead);
  window.localStorage.setItem(LEADS_KEY, JSON.stringify(leads.slice(0, 200)));
  return lead;
}

export function deleteRentalSearchLead(id: string) {
  if (typeof window === "undefined") return;
  const leads = getRentalSearchLeads().filter((l) => l.id !== id);
  window.localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

export function findRentalSearchLeads(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getRentalSearchLeads().filter(
    (l) =>
      l.query.toLowerCase().includes(q) ||
      l.districts.some((d) => d.toLowerCase().includes(q))
  );
}

export function formatLeadRequirements(lead: RentalSearchLead) {
  const parts: string[] = [];
  if (lead.districts.length) parts.push(lead.districts.join(", "));
  if (lead.rooms) parts.push(`${lead.rooms} xona`);
  if (lead.maxPrice) {
    parts.push(
      `${new Intl.NumberFormat("uz-UZ").format(lead.maxPrice)} so'm gacha`
    );
  }
  if (lead.propertyType) parts.push(lead.propertyType);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
