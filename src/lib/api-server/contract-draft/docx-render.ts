import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import { amountWithSomWords } from "@/lib/api-server/contract-draft/amount-words-uz-cyrl";
import { formatSomGrouped } from "@/lib/api-server/contract-draft/money";
import { TEMPLATE_VERSION, templateFileName } from "@/lib/api-server/contract-draft/status";
import type { LessorProfile } from "@/lib/api-server/contract-draft/lessor";
import type { ContractTemplateKind } from "@prisma/client";

export type RenderContractInput = {
  templateKind: ContractTemplateKind;
  contractNumber: string;
  contractDate: string;
  contractCity: string;
  lessor: LessorProfile;
  propertyAddress: string;
  roomName: string;
  area: string;
  serviceName: string;
  ratePerSqm: string;
  monthCount: string;
  monthlyPayment: string;
  totalAmount: string;
  totalAmountWords: string;
  paymentDueDay: string;
  deposit: string;
  depositWords: string;
  startDate: string;
  endDate: string;
  tenantType: string;
  // individual
  tenantFullName?: string;
  passportOrId?: string;
  tenantJshshir?: string;
  tenantAddress?: string;
  tenantPhone?: string;
  // legal
  companyFullName?: string;
  legalForm?: string;
  directorFullName?: string;
  authorityBasis?: string;
  legalAddress?: string;
  stir?: string;
  bankName?: string;
  mfo?: string;
  accountNumber?: string;
  phone?: string;
};

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function templatesRoot() {
  return path.join(process.cwd(), "server", "contract-templates", TEMPLATE_VERSION);
}

export function loadTemplateBuffer(kind: ContractTemplateKind): Buffer {
  const file = path.join(templatesRoot(), templateFileName(kind));
  if (!existsSync(file)) {
    throw new Error("Shartnoma shabloni topilmadi");
  }
  return readFileSync(file);
}

export function findUnresolvedPlaceholders(xmlOrText: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, "g");
  while ((m = re.exec(xmlOrText)) !== null) {
    found.add(m[1]!);
  }
  return [...found];
}

export function buildDocxData(input: RenderContractInput): Record<string, string> {
  return {
    contractNumber: input.contractNumber,
    contractDate: input.contractDate,
    contractCity: input.contractCity,
    lessorFullName: input.lessor.lessorFullName,
    lessorPassport: input.lessor.lessorPassport,
    lessorAddress: input.lessor.lessorAddress,
    lessorJshshir: input.lessor.lessorJshshir,
    lessorBankStir: input.lessor.lessorBankStir,
    lessorBankMfo: input.lessor.lessorBankMfo,
    lessorBankName: input.lessor.lessorBankName,
    lessorAccount: input.lessor.lessorAccount,
    lessorCardNumber: input.lessor.lessorCardNumber,
    lessorPhone: input.lessor.lessorPhone,
    tenantType: input.tenantType,
    propertyAddress: input.propertyAddress,
    roomName: input.roomName,
    area: input.area,
    serviceName: input.serviceName,
    ratePerSqm: input.ratePerSqm,
    monthCount: input.monthCount,
    monthlyPayment: input.monthlyPayment,
    totalAmount: input.totalAmount,
    totalAmountWords: input.totalAmountWords,
    paymentDueDay: input.paymentDueDay,
    deposit: input.deposit,
    depositWords: input.depositWords,
    startDate: input.startDate,
    endDate: input.endDate,
    tenantFullName: input.tenantFullName ?? "",
    passportOrId: input.passportOrId ?? "",
    tenantJshshir: input.tenantJshshir ?? "",
    tenantAddress: input.tenantAddress ?? "",
    tenantPhone: input.tenantPhone ?? "",
    companyFullName: input.companyFullName ?? "",
    legalForm: input.legalForm ?? "",
    directorFullName: input.directorFullName ?? "",
    authorityBasis: input.authorityBasis ?? "",
    legalAddress: input.legalAddress ?? "",
    stir: input.stir ?? "",
    bankName: input.bankName ?? "",
    mfo: input.mfo ?? "",
    accountNumber: input.accountNumber ?? "",
    phone: input.phone ?? input.tenantPhone ?? "",
  };
}

export function renderContractDocx(input: RenderContractInput): {
  buffer: Buffer;
  sha256: string;
} {
  const template = loadTemplateBuffer(input.templateKind);
  const zip = new PizZip(template);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });
  const data = buildDocxData(input);
  doc.render(data);
  const outZip = doc.getZip();
  const buffer = outZip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
  const xml = outZip.file("word/document.xml")?.asText() ?? "";
  const unresolved = findUnresolvedPlaceholders(xml);
  if (unresolved.length > 0) {
    throw new Error("Shablon to‘liq to‘ldirilmadi");
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return { buffer, sha256 };
}

export function moneyFieldsFromAmounts(monthly: number, total: number, deposit: number) {
  return {
    monthlyPayment: formatSomGrouped(monthly),
    totalAmount: formatSomGrouped(total),
    totalAmountWords: amountWithSomWords(total),
    deposit: formatSomGrouped(deposit),
    depositWords: amountWithSomWords(deposit),
  };
}
