export const RENTAL_INDUSTRIES = [
  "OFFICE_RENTAL",
  "APARTMENT_RENTAL",
  "HOTEL_HOSTEL",
  "CAR_RENTAL",
  "RETAIL_RENTAL",
  "WAREHOUSE_RENTAL",
  "VILLA_RENTAL",
  "COMMERCIAL_RENTAL",
  "OTHER",
] as const;

export type RentalIndustry = (typeof RENTAL_INDUSTRIES)[number];

export const RENTAL_INDUSTRY_LABELS: Record<RentalIndustry, string> = {
  OFFICE_RENTAL: "Ofis / Biznes markazi",
  APARTMENT_RENTAL: "Kvartira / Uy",
  HOTEL_HOSTEL: "Mehmonxona / Hostel",
  CAR_RENTAL: "Avtomobil ijarasi",
  RETAIL_RENTAL: "Savdo joylari",
  WAREHOUSE_RENTAL: "Ombor",
  VILLA_RENTAL: "Dacha / Villa",
  COMMERCIAL_RENTAL: "Tijorat ko‘chmas mulki",
  OTHER: "Boshqa",
};

export function isRentalIndustry(value: unknown): value is RentalIndustry {
  return (
    typeof value === "string" &&
    (RENTAL_INDUSTRIES as readonly string[]).includes(value)
  );
}
