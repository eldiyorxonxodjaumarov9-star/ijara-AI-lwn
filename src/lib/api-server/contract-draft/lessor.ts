import { prisma } from "@/lib/api-server/prisma";
import {
  LESSOR_FIELD_LABELS,
  LESSOR_REQUIRED_FIELDS,
  type LessorField,
} from "@/lib/api-server/contract-draft/validation";

export type LessorProfile = {
  lessorFullName: string;
  lessorPassport: string;
  lessorJshshir: string;
  lessorAddress: string;
  lessorCity: string;
  lessorBankStir: string;
  lessorBankMfo: string;
  lessorBankName: string;
  lessorAccount: string;
  lessorCardNumber: string;
  lessorPhone: string;
};

function trimOrEmpty(v: string | null | undefined) {
  return String(v ?? "").trim();
}

export async function loadCompanyLessorRow() {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: "ArendaHub" },
    });
  }
  return company;
}

export function missingLessorFields(row: Record<string, unknown>): LessorField[] {
  return LESSOR_REQUIRED_FIELDS.filter((k) => !trimOrEmpty(row[k] as string));
}

export function missingLessorLabels(row: Record<string, unknown>): string[] {
  return missingLessorFields(row).map((k) => LESSOR_FIELD_LABELS[k]);
}

export async function requireLessorProfile(): Promise<
  | { ok: true; profile: LessorProfile }
  | { ok: false; missing: string[] }
> {
  const row = await loadCompanyLessorRow();
  const missing = missingLessorLabels(row as unknown as Record<string, unknown>);
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    profile: {
      lessorFullName: trimOrEmpty(row.lessorFullName),
      lessorPassport: trimOrEmpty(row.lessorPassport),
      lessorJshshir: trimOrEmpty(row.lessorJshshir),
      lessorAddress: trimOrEmpty(row.lessorAddress),
      lessorCity: trimOrEmpty(row.lessorCity) || "Тошкент шаҳри",
      lessorBankStir: trimOrEmpty(row.lessorBankStir),
      lessorBankMfo: trimOrEmpty(row.lessorBankMfo),
      lessorBankName: trimOrEmpty(row.lessorBankName),
      lessorAccount: trimOrEmpty(row.lessorAccount),
      lessorCardNumber: trimOrEmpty(row.lessorCardNumber),
      lessorPhone: trimOrEmpty(row.lessorPhone),
    },
  };
}
