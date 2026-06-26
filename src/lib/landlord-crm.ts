import { getInquiriesForLandlord } from "@/lib/rental-inquiries";
import { getLandlordProfile } from "@/lib/landlord-profile";

export type ClientStatus = "new" | "checking" | "approved" | "rejected";

export type LandlordClient = {
  id: string;
  fullName: string;
  phone: string;
  status: ClientStatus;
  notes?: string;
  createdAt: string;
};

export type ListingStatus = "active" | "draft" | "rented";

export type LandlordListing = {
  id: string;
  title: string;
  district: string;
  rooms: number;
  area: number;
  price: number;
  propertyType: string;
  description?: string;
  images?: string[];
  status: ListingStatus;
  landlordEmail: string;
  landlordName?: string;
  createdAt: string;
};

const CLIENTS_KEY = "arenda:landlord-clients";
const LISTINGS_KEY = "arenda:landlord-listings";

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, data: T[]): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") {
    return { ok: false, error: "Brauzerda saqlab bo'lmaydi" };
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "Xotira to'ldi. Rasmlarni kamaytiring yoki kichikroq fayl yuklang (5 ta, 2 MB gacha).",
    };
  }
}

export function getLandlordClients(): LandlordClient[] {
  return readJson<LandlordClient>(CLIENTS_KEY);
}

export function saveLandlordClient(
  client: Omit<LandlordClient, "id" | "createdAt"> & { id?: string; createdAt?: string }
): LandlordClient {
  const clients = getLandlordClients();
  const now = new Date().toISOString();
  if (client.id) {
    const idx = clients.findIndex((c) => c.id === client.id);
    const updated: LandlordClient = {
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      status: client.status,
      notes: client.notes,
      createdAt: client.createdAt ?? clients[idx]?.createdAt ?? now,
    };
    if (idx >= 0) clients[idx] = updated;
    else clients.unshift(updated);
    writeJson(CLIENTS_KEY, clients);
    return updated;
  }
  const created: LandlordClient = {
    id: crypto.randomUUID(),
    fullName: client.fullName,
    phone: client.phone,
    status: client.status,
    notes: client.notes,
    createdAt: now,
  };
  clients.unshift(created);
  writeJson(CLIENTS_KEY, clients);
  return created;
}

export function deleteLandlordClient(id: string) {
  writeJson(
    CLIENTS_KEY,
    getLandlordClients().filter((c) => c.id !== id)
  );
}

export function getLandlordListings(landlordEmail?: string): LandlordListing[] {
  const all = readJson<LandlordListing>(LISTINGS_KEY);
  const email = landlordEmail?.trim().toLowerCase();
  if (!email) return all;
  return all.filter((l) => l.landlordEmail?.toLowerCase() === email);
}

export type SaveLandlordListingResult =
  | { ok: true; listing: LandlordListing }
  | { ok: false; error: string };

export function saveLandlordListing(
  listing: Omit<LandlordListing, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): SaveLandlordListingResult {
  const listings = getLandlordListings();
  const now = new Date().toISOString();
  if (listing.id) {
    const idx = listings.findIndex((l) => l.id === listing.id);
    const updated: LandlordListing = {
      id: listing.id,
      title: listing.title,
      district: listing.district,
      rooms: listing.rooms,
      area: listing.area,
      price: listing.price,
      propertyType: listing.propertyType,
      description: listing.description,
      images: listing.images,
      status: listing.status,
      landlordEmail: listing.landlordEmail ?? listings[idx]?.landlordEmail ?? "",
      landlordName: listing.landlordName ?? listings[idx]?.landlordName,
      createdAt: listing.createdAt ?? listings[idx]?.createdAt ?? now,
    };
    if (idx >= 0) listings[idx] = updated;
    else listings.unshift(updated);
    const saved = writeJson(LISTINGS_KEY, listings);
    if (!saved.ok) return saved;
    return { ok: true, listing: updated };
  }
  const created: LandlordListing = {
    id: crypto.randomUUID(),
    title: listing.title,
    district: listing.district,
    rooms: listing.rooms,
    area: listing.area,
    price: listing.price,
    propertyType: listing.propertyType,
    description: listing.description,
    images: listing.images,
    status: listing.status,
    landlordEmail: listing.landlordEmail,
    landlordName: listing.landlordName,
    createdAt: now,
  };
  listings.unshift(created);
  const saved = writeJson(LISTINGS_KEY, listings);
  if (!saved.ok) return saved;
  return { ok: true, listing: created };
}

export function deleteLandlordListing(id: string) {
  const result = writeJson(
    LISTINGS_KEY,
    readJson<LandlordListing>(LISTINGS_KEY).filter((l) => l.id !== id)
  );
  return result.ok;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-9);
}

export function verifyLandlordClient(phone: string, fullName?: string) {
  const norm = normalizePhone(phone);
  const clients = getLandlordClients();
  const match = clients.find((c) => normalizePhone(c.phone) === norm);
  if (!match) {
    return { found: false as const, message: "Mijoz ro'yxatda topilmadi." };
  }
  if (fullName?.trim()) {
    const similar =
      match.fullName.toLowerCase().includes(fullName.trim().toLowerCase()) ||
      fullName.trim().toLowerCase().includes(match.fullName.toLowerCase());
    if (!similar) {
      return {
        found: true as const,
        partial: true,
        client: match,
        message: "Telefon mos, lekin ism farq qiladi. Qo'lda tekshiring.",
      };
    }
  }
  return {
    found: true as const,
    partial: false,
    client: match,
    message: "Mijoz tasdiqlandi — ro'yxatda mavjud.",
  };
}

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  new: "Yangi",
  checking: "Tekshirilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

export function getCrmReports(landlordEmail?: string) {
  const email =
    landlordEmail?.trim().toLowerCase() ||
    getLandlordProfile()?.email?.trim().toLowerCase() ||
    "";
  const inquiries = getInquiriesForLandlord(email || undefined);
  const listings = email ? getLandlordListings(email) : getLandlordListings();
  const activeListings = listings.filter((l) => l.status === "active");
  const rentedListings = listings.filter((l) => l.status === "rented");
  const monthlyPotential = activeListings.reduce((s, l) => s + l.price, 0);

  return {
    totalClients: inquiries.length,
    approvedClients: inquiries.filter((i) => i.listingTitle !== "Ijara qidiruv so'rovi").length,
    checkingClients: inquiries.filter((i) => i.listingTitle === "Ijara qidiruv so'rovi").length,
    totalListings: listings.length,
    activeListings: activeListings.length,
    rentedListings: rentedListings.length,
    monthlyPotential,
  };
}
