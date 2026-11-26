export type RobotRentFormType = "CUSTOMER" | "DISTRIBUTOR" | "MANUFACTURER";

export type FormProfile = "mobile" | "desktop";

export type FieldKind = "text" | "tel" | "email" | "number" | "date" | "textarea" | "checkbox";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
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
  { name: "companyName", label: "Kompaniya", kind: "text" },
  { name: "city", label: "Shahar", kind: "text" },
  {
    name: "phone",
    label: "Telefon",
    kind: "tel",
    placeholder: "+998 90 123 45 67",
  },
];

const DISTRIBUTOR_FIELDS: FieldDef[] = [
  { name: "companyName", label: "Kompaniya", kind: "text" },
  { name: "robotModel", label: "Robot modeli", kind: "text" },
  { name: "phone", label: "Telefon", kind: "tel" },
];

const MANUFACTURER_FIELDS: FieldDef[] = [
  { name: "companyName", label: "Kompaniya", kind: "text" },
  { name: "country", label: "Mamlakat", kind: "text" },
  { name: "email", label: "Email", kind: "email" },
];

export const FIELDS_BY_TYPE: Record<RobotRentFormType, FieldDef[]> = {
  CUSTOMER: CUSTOMER_FIELDS,
  DISTRIBUTOR: DISTRIBUTOR_FIELDS,
  MANUFACTURER: MANUFACTURER_FIELDS,
};

export function fieldsForProfile(type: RobotRentFormType, _profile?: FormProfile) {
  return FIELDS_BY_TYPE[type];
}
