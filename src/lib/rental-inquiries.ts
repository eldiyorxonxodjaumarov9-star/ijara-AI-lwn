import { buildInquiryMessage, parseSumma, type RenterSearchForm } from "@/lib/renter-search-form";

/** Barcha ijara egalari ko'radigan umumiy so'rov */
export const GLOBAL_LANDLORD_KEY = "*";

export type RentalInquiry = {
  id: string;
  companyName: string;
  phone: string;
  activityType: string;
  activitySince?: string;
  briefInfo?: string;
  instagramLink: string;
  instagramQr?: string;
  officeAddress: string;
  rentalPlaceType: string;
  kv: number;
  summa: number;
  message: string;
  listingId?: string;
  listingTitle: string;
  /** Arendator login (xabar yuborgan) */
  renterLogin?: string;
  /** "*" = barcha ijara egalari uchun */
  landlordEmail: string;
  landlordName?: string;
  createdAt: string;
  /** @deprecated eski yozuvlar */
  renterName?: string;
  renterPhone?: string;
  district?: string;
  rooms?: number;
  maxPrice?: number;
};

const INQUIRIES_KEY = "arenda:rental-inquiries";

export function getInquiryCompanyName(inquiry: RentalInquiry) {
  return inquiry.companyName || inquiry.renterName || "—";
}

export function getInquiryPhone(inquiry: RentalInquiry) {
  return inquiry.phone || inquiry.renterPhone || "";
}

export function isGlobalInquiry(inquiry: RentalInquiry) {
  const e = inquiry.landlordEmail?.trim();
  return !e || e === GLOBAL_LANDLORD_KEY;
}

export function isListingMessage(inquiry: RentalInquiry) {
  return !isGlobalInquiry(inquiry);
}

/** Faqat e'lon bo'yicha yuborilgan xabarlar */
export function getListingMessagesForLandlord(landlordEmail?: string): RentalInquiry[] {
  const email = landlordEmail?.trim().toLowerCase() ?? "";
  if (!email) return [];
  return getRentalInquiries().filter(
    (i) => isListingMessage(i) && i.landlordEmail.toLowerCase() === email
  );
}

/** Faqat ijara qidiruv formasi (barcha egalar uchun) */
export function getGlobalInquiriesForLandlord(landlordEmail?: string): RentalInquiry[] {
  return getInquiriesForLandlord(landlordEmail).filter(isGlobalInquiry);
}

/** Arendator yuborgan xabarlar */
export function getMessagesForRenter(renterLogin?: string): RentalInquiry[] {
  const login = renterLogin?.trim().toLowerCase() ?? "";
  if (!login) return [];
  return getRentalInquiries().filter(
    (i) => isListingMessage(i) && i.renterLogin?.toLowerCase() === login
  );
}

export function getRentalInquiries(): RentalInquiry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INQUIRIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RentalInquiry[];
  } catch {
    return [];
  }
}

/** Shu ijara egasiga tegishli + barcha umumiy so'rovlar */
export function getInquiriesForLandlord(landlordEmail?: string): RentalInquiry[] {
  const email = landlordEmail?.trim().toLowerCase() ?? "";
  return getRentalInquiries().filter(
    (i) => isGlobalInquiry(i) || (email && i.landlordEmail.toLowerCase() === email)
  );
}

export function saveRentalInquiry(
  inquiry: Omit<RentalInquiry, "id" | "createdAt">
): RentalInquiry {
  const list = getRentalInquiries();
  const created: RentalInquiry = {
    ...inquiry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.unshift(created);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list.slice(0, 500)));
  }
  return created;
}

/** Forma to'ldirilganda — barcha ijara egalari mijozlar ro'yxatida ko'rinadi */
export function saveGlobalInquiryFromForm(form: RenterSearchForm) {
  const summa = parseSumma(form.summa) ?? 0;
  return saveRentalInquiry({
    companyName: form.companyName.trim(),
    phone: form.phone?.trim() ?? "",
    activityType: form.activityType,
    activitySince: form.activitySince.trim() || undefined,
    briefInfo: form.briefInfo.trim() || undefined,
    instagramLink: form.instagramLink.trim(),
    instagramQr: form.instagramQr || undefined,
    officeAddress: form.officeAddress.trim(),
    rentalPlaceType: form.rentalPlaceType,
    kv: Number(form.kv) || 0,
    summa,
    message: buildInquiryMessage(form),
    listingTitle: "Ijara qidiruv so'rovi",
    landlordEmail: GLOBAL_LANDLORD_KEY,
  });
}

export function deleteRentalInquiry(id: string) {
  if (typeof window === "undefined") return;
  const list = getRentalInquiries().filter((i) => i.id !== id);
  window.localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));
}

export function findInquiries(query: string, landlordEmail?: string) {
  const q = query.trim().toLowerCase();
  const base = getInquiriesForLandlord(landlordEmail);
  if (!q) return base;
  return base.filter((i) => {
    const hay = [
      getInquiryCompanyName(i),
      i.activityType,
      i.activitySince ?? "",
      i.briefInfo ?? "",
      i.instagramLink,
      getInquiryPhone(i),
      i.officeAddress,
      i.rentalPlaceType,
      i.listingTitle,
      i.message,
      i.renterPhone ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
