import type {
  ContractDraftStatus,
  ContractPartyCategory,
  ContractPartySubtype,
  ContractTemplateKind,
} from "@prisma/client";

export const ACTIVE_REQUEST_STATUSES: ContractDraftStatus[] = [
  "DRAFT",
  "AWAITING_CLIENT",
  "CLIENT_FORM_OPENED",
  "GENERATING",
  "FAILED",
];

export const PENDING_CLIENT_STATUSES: ContractDraftStatus[] = [
  "AWAITING_CLIENT",
  "CLIENT_FORM_OPENED",
];

const ALLOWED: Record<ContractDraftStatus, ContractDraftStatus[]> = {
  DRAFT: ["AWAITING_CLIENT", "CANCELLED"],
  AWAITING_CLIENT: ["CLIENT_FORM_OPENED", "CANCELLED", "EXPIRED", "GENERATING"],
  CLIENT_FORM_OPENED: ["GENERATING", "CANCELLED", "EXPIRED", "AWAITING_CLIENT"],
  GENERATING: ["CREATED", "FAILED"],
  CREATED: [],
  FAILED: ["GENERATING", "CANCELLED", "AWAITING_CLIENT"],
  EXPIRED: ["CANCELLED"],
  CANCELLED: [],
};

export function canTransition(
  from: ContractDraftStatus,
  to: ContractDraftStatus
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: ContractDraftStatus,
  to: ContractDraftStatus
) {
  if (!canTransition(from, to)) {
    throw new Error(`Holat o‘zgarishi ruxsat etilmagan: ${from} → ${to}`);
  }
}

export function mapUiPartyToCategorySubtype(uiType: string): {
  partyCategory: ContractPartyCategory;
  partySubtype: ContractPartySubtype;
  templateKind: ContractTemplateKind;
} {
  switch (uiType) {
    case "individual":
      return {
        partyCategory: "INDIVIDUAL",
        partySubtype: "NONE",
        templateKind: "INDIVIDUAL",
      };
    case "self_employed":
      return {
        partyCategory: "INDIVIDUAL",
        partySubtype: "SELF_EMPLOYED",
        templateKind: "INDIVIDUAL",
      };
    case "ytt":
      return {
        partyCategory: "INDIVIDUAL",
        partySubtype: "YTT",
        templateKind: "INDIVIDUAL",
      };
    case "legal":
      return {
        partyCategory: "LEGAL_ENTITY",
        partySubtype: "NONE",
        templateKind: "LEGAL_ENTITY",
      };
    case "mchj":
      return {
        partyCategory: "LEGAL_ENTITY",
        partySubtype: "MCHJ",
        templateKind: "LEGAL_ENTITY",
      };
    default:
      throw new Error("Mijoz turi noto‘g‘ri");
  }
}

export function templateFileName(kind: ContractTemplateKind): string {
  return kind === "LEGAL_ENTITY" ? "legal.docx" : "individual.docx";
}

export const TEMPLATE_VERSION = "v1";
