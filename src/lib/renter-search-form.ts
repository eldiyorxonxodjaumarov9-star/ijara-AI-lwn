export const ACTIVITY_TYPES = [
  "Savdo",
  "Xizmat ko'rsatish",
  "Ishlab chiqarish",
  "IT va texnologiya",
  "Oziq-ovqat",
  "Go'zallik va salomatlik",
  "Ta'lim",
  "Boshqa",
] as const;

import { PROPERTY_TYPES } from "@/lib/landlord-profile";
import { parseSumma } from "@/lib/uzs-input";

export { formatSummaInput, parseSumma } from "@/lib/uzs-input";

export function normalizeRenterForm(data: Partial<RenterSearchForm> = {}): RenterSearchForm {
  return {
    login: data.login ?? "",
    password: data.password ?? "",
    companyName: data.companyName ?? "",
    phone: data.phone ?? "",
    activityType: data.activityType ?? ACTIVITY_TYPES[0],
    activitySince: data.activitySince ?? "",
    briefInfo: data.briefInfo ?? "",
    instagramLink: data.instagramLink ?? "",
    instagramQr: data.instagramQr ?? "",
    officeAddress: data.officeAddress ?? "",
    rentalPlaceType: data.rentalPlaceType ?? PROPERTY_TYPES[0],
    kv: data.kv ?? "",
    summa: data.summa ?? "",
  };
}

export type RenterSearchForm = {
  login: string;
  password: string;
  companyName: string;
  phone: string;
  activityType: string;
  activitySince: string;
  briefInfo: string;
  instagramLink: string;
  instagramQr: string;
  officeAddress: string;
  rentalPlaceType: string;
  kv: string;
  summa: string;
};

export function buildInquiryMessage(
  form: Partial<RenterSearchForm>,
  listingTitle?: string
): string {
  const f = normalizeRenterForm(form);
  const summa = parseSumma(f.summa);
  const phone = f.phone.trim();
  const lines = [
    listingTitle ? `E'lon: ${listingTitle}` : null,
    f.companyName.trim() ? `Firma: ${f.companyName.trim()}` : null,
    phone ? `Telefon: ${phone}` : null,
    f.activityType ? `Faoliyat: ${f.activityType}` : null,
    f.activitySince.trim() ? `Faoliyat muddati: ${f.activitySince.trim()}` : null,
    f.briefInfo.trim() ? `Qisqacha: ${f.briefInfo.trim()}` : null,
    f.instagramLink.trim() ? `Instagram: ${f.instagramLink.trim()}` : null,
    f.officeAddress.trim() ? `Ofis manzili: ${f.officeAddress.trim()}` : null,
    f.rentalPlaceType ? `Joy turi: ${f.rentalPlaceType}` : null,
    f.kv ? `KV: ${f.kv} m²` : null,
    summa ? `Summa: ${new Intl.NumberFormat("uz-UZ").format(summa)} so'm` : null,
    "Ijara joy bo'yicha bog'lanishni xohlaymiz.",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Xabar matnida telefon bo'lmasa, avtomatik qo'shadi */
export function ensurePhoneInMessage(message: string, phone: string): string {
  const normalized = phone.trim();
  if (!normalized) return message;
  const digits = normalized.replace(/\D/g, "");
  const alreadyIncluded =
    message.includes(normalized) ||
    (digits.length >= 9 && message.replace(/\D/g, "").includes(digits.slice(-9)));
  if (alreadyIncluded) return message;
  return `Telefon: ${normalized}\n${message}`;
}
