export type RobotRentFormType = "CUSTOMER" | "DISTRIBUTOR" | "MANUFACTURER";

export type FormProfile = "mobile" | "desktop";

export type FieldKind = "text" | "tel" | "email" | "number" | "date" | "textarea" | "checkbox";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  profiles: FormProfile[];
}

export const FORM_TITLES: Record<RobotRentFormType, { mobile: string; desktop: string }> = {
  CUSTOMER: {
    mobile: "Sinovga ariza berish",
    desktop: "Sinovga ariza berish",
  },
  DISTRIBUTOR: {
    mobile: "Robot taklif qilish",
    desktop: "Robot taklif qilish",
  },
  MANUFACTURER: {
    mobile: "Hamkorlikka ariza berish",
    desktop: "Hamkorlikka ariza berish",
  },
};

export const SUBMIT_LABELS: Record<RobotRentFormType, string> = {
  CUSTOMER: "Sinovga ariza berish",
  DISTRIBUTOR: "Robot taklif qilish",
  MANUFACTURER: "Hamkorlikka ariza berish",
};

export const PARTNER_BADGES: Record<RobotRentFormType, string> = {
  CUSTOMER: "Mijoz",
  DISTRIBUTOR: "Distribyutor",
  MANUFACTURER: "Ishlab chiqaruvchi",
};

const CUSTOMER_FIELDS: FieldDef[] = [
  {
    name: "companyName",
    label: "Kompaniya",
    kind: "text",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "city",
    label: "Shahar",
    kind: "text",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "phone",
    label: "Telefon",
    kind: "tel",
    placeholder: "+998 90 123 45 67",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "objectType",
    label: "Obyekt turi",
    kind: "text",
    placeholder: "Ofis, ombor, savdo markazi…",
    profiles: ["desktop"],
  },
  {
    name: "areaSqm",
    label: "Maydon (m²)",
    kind: "number",
    profiles: ["desktop"],
  },
  {
    name: "startDate",
    label: "Boshlanish sanasi",
    kind: "date",
    profiles: ["desktop"],
  },
];

const DISTRIBUTOR_FIELDS: FieldDef[] = [
  {
    name: "companyName",
    label: "Kompaniya",
    kind: "text",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "robotModel",
    label: "Robot modeli",
    kind: "text",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "phone",
    label: "Telefon",
    kind: "tel",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "serviceCity",
    label: "Xizmat ko‘rsatish shahri",
    kind: "text",
    profiles: ["desktop"],
  },
  {
    name: "hasDemoRobot",
    label: "Demo robot mavjud",
    kind: "checkbox",
    profiles: ["desktop"],
  },
  {
    name: "serviceCapability",
    label: "Servis imkoniyati",
    kind: "textarea",
    profiles: ["desktop"],
  },
];

const MANUFACTURER_FIELDS: FieldDef[] = [
  {
    name: "companyName",
    label: "Kompaniya",
    kind: "text",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "country",
    label: "Mamlakat",
    kind: "text",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "email",
    label: "Email",
    kind: "email",
    profiles: ["mobile", "desktop"],
  },
  {
    name: "robotModel",
    label: "Robot modeli",
    kind: "text",
    profiles: ["desktop"],
  },
  {
    name: "techDocumentNote",
    label: "Texnik hujjat",
    kind: "textarea",
    profiles: ["desktop"],
  },
  {
    name: "monthlyRentalTerms",
    label: "Oylik ijara shartlari",
    kind: "textarea",
    profiles: ["desktop"],
  },
];

export const FIELDS_BY_TYPE: Record<RobotRentFormType, FieldDef[]> = {
  CUSTOMER: CUSTOMER_FIELDS,
  DISTRIBUTOR: DISTRIBUTOR_FIELDS,
  MANUFACTURER: MANUFACTURER_FIELDS,
};

export function fieldsForProfile(type: RobotRentFormType, profile: FormProfile) {
  return FIELDS_BY_TYPE[type].filter((f) => f.profiles.includes(profile));
}