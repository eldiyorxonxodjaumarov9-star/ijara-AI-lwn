import { z } from "zod";

import {
  computeMonthlyAmount,
  computeTotalAmount,
} from "@/lib/api-server/contract-draft/money";
import { normalizeContractPhone } from "@/lib/api-server/contract-draft/phone-token";

export const adminCreateSchema = z.object({
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  partyUiType: z.enum([
    "individual",
    "self_employed",
    "ytt",
    "legal",
    "mchj",
  ]),
  contractDate: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  serviceName: z.string().trim().min(1).max(200),
  areaSqm: z.number().int().positive(),
  ratePerSqm: z.number().int().nonnegative(),
  monthCount: z.number().int().min(1).max(120),
  paymentDueDay: z.number().int().min(1).max(28),
  depositAmount: z.number().int().nonnegative(),
  phone: z.string().min(9).max(32),
  monthlyAmountClient: z.number().int().nonnegative().optional(),
  totalAmountClient: z.number().int().nonnegative().optional(),
});

export type AdminCreateInput = z.infer<typeof adminCreateSchema>;

export function validateAdminAmounts(input: AdminCreateInput) {
  const monthlyAmount = computeMonthlyAmount(input.areaSqm, input.ratePerSqm);
  const totalAmount = computeTotalAmount(monthlyAmount, input.monthCount);
  if (
    input.monthlyAmountClient != null &&
    input.monthlyAmountClient !== monthlyAmount
  ) {
    throw new Error("Oylik summa qayta hisoblandi — farq aniqlandi");
  }
  if (
    input.totalAmountClient != null &&
    input.totalAmountClient !== totalAmount
  ) {
    throw new Error("Umumiy summa qayta hisoblandi — farq aniqlandi");
  }
  const phone = normalizeContractPhone(input.phone);
  return { monthlyAmount, totalAmount, phone };
}

export const individualClientSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  passportOrId: z.string().trim().min(5).max(40),
  jshshir: z
    .string()
    .trim()
    .regex(/^\d{14}$/, "JSHSHIR 14 raqam bo‘lishi kerak"),
  address: z.string().trim().min(5).max(500),
  phone: z.string().min(9).max(32),
  registrationInfo: z.string().trim().max(300).optional(),
  stir: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{9}$/.test(v), "STIR 9 raqam bo‘lishi kerak")
    .optional(),
  bankName: z.string().trim().max(200).optional(),
  mfo: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}$/.test(v), "MFO 5 raqam bo‘lishi kerak")
    .optional(),
  accountNumber: z.string().trim().max(34).optional(),
});

export const legalClientSchema = z.object({
  companyFullName: z.string().trim().min(2).max(300),
  legalForm: z.string().trim().min(2).max(100),
  directorFullName: z.string().trim().min(2).max(200),
  authorityBasis: z.string().trim().min(2).max(200),
  legalAddress: z.string().trim().min(5).max(500),
  stir: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "STIR 9 raqam bo‘lishi kerak"),
  bankName: z.string().trim().min(2).max(200),
  mfo: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "MFO 5 raqam bo‘lishi kerak"),
  accountNumber: z.string().trim().min(10).max(34),
  phone: z.string().min(9).max(32),
});

export type IndividualClientInput = z.infer<typeof individualClientSchema>;
export type LegalClientInput = z.infer<typeof legalClientSchema>;

export const LESSOR_REQUIRED_FIELDS = [
  "lessorFullName",
  "lessorPassport",
  "lessorJshshir",
  "lessorAddress",
  "lessorCity",
  "lessorBankStir",
  "lessorBankMfo",
  "lessorBankName",
  "lessorAccount",
  "lessorCardNumber",
  "lessorPhone",
] as const;

export type LessorField = (typeof LESSOR_REQUIRED_FIELDS)[number];

export const LESSOR_FIELD_LABELS: Record<LessorField, string> = {
  lessorFullName: "F.I.Sh. yoki tashkilot nomi",
  lessorPassport: "Pasport / ID ma’lumotlari",
  lessorJshshir: "JSHSHIR",
  lessorAddress: "Manzil",
  lessorCity: "Shahar",
  lessorBankStir: "STIR",
  lessorBankMfo: "MFO",
  lessorBankName: "Bank nomi",
  lessorAccount: "Hisob raqami",
  lessorCardNumber: "Karta raqami",
  lessorPhone: "Telefon raqami",
};

export const LESSOR_FIELD_PLACEHOLDERS: Record<LessorField, string> = {
  lessorFullName: "Masalan: Familiya Ism Sharif yoki MChJ nomi",
  lessorPassport: "Masalan: AA1234567",
  lessorJshshir: "14 ta raqam",
  lessorAddress: "Viloyat, tuman, ko‘cha, uy",
  lessorCity: "Masalan: Тошкент шаҳри",
  lessorBankStir: "9 ta raqam",
  lessorBankMfo: "5 ta raqam",
  lessorBankName: "Bank to‘liq nomi",
  lessorAccount: "Hisob raqami (20 raqam)",
  lessorCardNumber: "16 ta raqam",
  lessorPhone: "+998 XX XXX XX XX",
};

/** Form bo‘limlari — barcha LESSOR_REQUIRED_FIELDS shu yerda bo‘lishi shart */
export const LESSOR_FORM_SECTIONS: {
  id: string;
  title: string;
  fields: readonly LessorField[];
}[] = [
  {
    id: "identity",
    title: "Ijaraga beruvchi ma’lumotlari",
    fields: [
      "lessorFullName",
      "lessorPassport",
      "lessorJshshir",
      "lessorAddress",
      "lessorCity",
      "lessorPhone",
    ],
  },
  {
    id: "bank",
    title: "Bank va to‘lov rekvizitlari",
    fields: [
      "lessorBankStir",
      "lessorBankName",
      "lessorBankMfo",
      "lessorAccount",
      "lessorCardNumber",
    ],
  },
];
