import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type { ContractPartyCategory, ContractRequest } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import {
  amountWithSomWords,
} from "@/lib/api-server/contract-draft/amount-words-uz-cyrl";
import {
  moneyFieldsFromAmounts,
  renderContractDocx,
} from "@/lib/api-server/contract-draft/docx-render";
import { formatSomGrouped } from "@/lib/api-server/contract-draft/money";
import { normalizeContractPhone } from "@/lib/api-server/contract-draft/phone-token";
import { recordStatusEvent } from "@/lib/api-server/contract-draft/queries";
import { assertTransition, TEMPLATE_VERSION } from "@/lib/api-server/contract-draft/status";
import { storeContractDocx } from "@/lib/api-server/contract-draft/storage";
import {
  individualClientSchema,
  legalClientSchema,
} from "@/lib/api-server/contract-draft/validation";
import type { LessorProfile } from "@/lib/api-server/contract-draft/lessor";

function formatDateUz(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

async function nextContractNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 8; i++) {
    const n = `${year}${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
    const exists = await prisma.contractRequest.findUnique({
      where: { contractNumber: n },
      select: { id: true },
    });
    if (!exists) return n;
  }
  return `${year}${Date.now().toString().slice(-8)}`;
}

function tenantTypeLabel(row: ContractRequest): string {
  if (row.partyCategory === "LEGAL_ENTITY") {
    return row.partySubtype === "MCHJ" ? "МЧЖ" : "Юридик шахс";
  }
  if (row.partySubtype === "SELF_EMPLOYED") return "Ўзини ўзи банд қилган";
  if (row.partySubtype === "YTT") return "ЯТТ";
  return "Жисмоний шахс";
}

export async function finalizeContractFromClientForm(input: {
  request: ContractRequest & {
    property: { title: string; address: string };
    tenant: { fullName: string };
  };
  clientBody: unknown;
}) {
  const row = input.request;
  if (row.status === "CREATED" && row.clientSnapshot) {
    return { alreadyCreated: true as const, requestId: row.id };
  }
  if (row.status !== "AWAITING_CLIENT" && row.status !== "CLIENT_FORM_OPENED" && row.status !== "FAILED") {
    throw Object.assign(new Error("Bu so‘rov uchun forma yuborib bo‘lmaydi"), {
      status: 409,
    });
  }
  if (row.tokenExpiresAt.getTime() < Date.now()) {
    await prisma.contractRequest.update({
      where: { id: row.id },
      data: { status: "EXPIRED" },
    });
    await recordStatusEvent({
      requestId: row.id,
      fromStatus: row.status,
      toStatus: "EXPIRED",
      actorKind: "SYSTEM",
      reason: "Token muddati tugadi",
    });
    throw Object.assign(new Error("Havola muddati tugagan"), { status: 410 });
  }

  const category = row.partyCategory as ContractPartyCategory;
  let clientSnapshot: Record<string, unknown>;
  if (category === "INDIVIDUAL") {
    const data = individualClientSchema.parse(input.clientBody);
    const phone = normalizeContractPhone(data.phone);
    clientSnapshot = { ...data, phoneNormalized: phone.normalized, phoneDisplay: phone.display };
  } else {
    const data = legalClientSchema.parse(input.clientBody);
    const phone = normalizeContractPhone(data.phone);
    clientSnapshot = { ...data, phoneNormalized: phone.normalized, phoneDisplay: phone.display };
  }

  assertTransition(row.status, "GENERATING");
  await prisma.contractRequest.update({
    where: { id: row.id },
    data: {
      status: "GENERATING",
      clientSnapshot: clientSnapshot as Prisma.InputJsonValue,
      failReasonSafe: null,
    },
  });
  await recordStatusEvent({
    requestId: row.id,
    fromStatus: row.status,
    toStatus: "GENERATING",
    actorKind: "CLIENT",
    reason: "Mijoz formani yubordi",
  });

  try {
    const contractNumber = row.contractNumber ?? (await nextContractNumber());
    const lessor = row.lessorSnapshot as unknown as LessorProfile;
    const money = moneyFieldsFromAmounts(
      row.monthlyAmount,
      row.totalAmount,
      row.depositAmount
    );

    const renderInput = {
      templateKind: row.templateKind,
      contractNumber,
      contractDate: formatDateUz(row.contractDate ?? row.createdAt),
      contractCity: lessor.lessorCity || "Тошкент шаҳри",
      lessor,
      propertyAddress: row.property.address,
      roomName: row.property.title,
      area: String(row.areaSqm),
      serviceName: row.serviceName,
      ratePerSqm: formatSomGrouped(row.ratePerSqm),
      monthCount: String(row.monthCount),
      ...money,
      paymentDueDay: String(row.paymentDueDay).padStart(2, "0"),
      startDate: formatDateUz(row.startDate),
      endDate: formatDateUz(row.endDate),
      tenantType: tenantTypeLabel(row),
      tenantFullName: String(clientSnapshot.fullName ?? ""),
      passportOrId: String(clientSnapshot.passportOrId ?? ""),
      tenantJshshir: String(clientSnapshot.jshshir ?? ""),
      tenantAddress: String(clientSnapshot.address ?? ""),
      tenantPhone: String(clientSnapshot.phoneDisplay ?? clientSnapshot.phone ?? ""),
      showSelfEmployedBlock:
        row.partySubtype === "SELF_EMPLOYED" || row.partySubtype === "YTT"
          ? "1"
          : "",
      tenantStir: String(clientSnapshot.stir ?? ""),
      tenantBankName: String(clientSnapshot.bankName ?? ""),
      tenantMfo: String(clientSnapshot.mfo ?? ""),
      tenantAccountNumber: String(clientSnapshot.accountNumber ?? ""),
      registrationInfo: String(clientSnapshot.registrationInfo ?? ""),
      companyFullName: String(clientSnapshot.companyFullName ?? ""),
      legalForm: String(clientSnapshot.legalForm ?? ""),
      directorFullName: String(clientSnapshot.directorFullName ?? ""),
      authorityBasis: String(clientSnapshot.authorityBasis ?? ""),
      legalAddress: String(clientSnapshot.legalAddress ?? ""),
      stir: String(clientSnapshot.stir ?? ""),
      bankName: String(clientSnapshot.bankName ?? ""),
      mfo: String(clientSnapshot.mfo ?? ""),
      accountNumber: String(clientSnapshot.accountNumber ?? ""),
      phone: String(clientSnapshot.phoneDisplay ?? clientSnapshot.phone ?? ""),
    };

    const { buffer, sha256 } = renderContractDocx(renderInput);
    const fileName = `shartnoma_${contractNumber}.docx`;
    const stored = await storeContractDocx({
      requestId: row.id,
      buffer,
      fileName,
    });

    await prisma.$transaction(async (tx) => {
      await tx.contractGeneratedDocument.upsert({
        where: { requestId: row.id },
        create: {
          id: randomUUID(),
          requestId: row.id,
          storageUrl: stored.storageUrl,
          storageKey: stored.storageKey,
          originalName: fileName,
          byteSize: stored.byteSize,
          contentSha256: sha256,
          templateKind: row.templateKind,
          templateVersion: row.templateVersion || TEMPLATE_VERSION,
        },
        update: {
          storageUrl: stored.storageUrl,
          storageKey: stored.storageKey,
          originalName: fileName,
          byteSize: stored.byteSize,
          contentSha256: sha256,
          generatedAt: new Date(),
        },
      });
      await tx.contractRequest.update({
        where: { id: row.id },
        data: {
          status: "CREATED",
          contractNumber,
          failReasonSafe: null,
        },
      });
      await tx.contractDeliveryEvent.create({
        data: {
          id: randomUUID(),
          requestId: row.id,
          channel: "TELEGRAM",
          status: "PENDING",
          telegramChatId: row.telegramChatId,
          nextRetryAt: new Date(),
        },
      });
    });

    await recordStatusEvent({
      requestId: row.id,
      fromStatus: "GENERATING",
      toStatus: "CREATED",
      actorKind: "SYSTEM",
      reason: "DOCX yaratildi",
    });

    void amountWithSomWords; // keep import used for tests/re-export path
    return { alreadyCreated: false as const, requestId: row.id, contractNumber };
  } catch (err) {
    const safe =
      err instanceof Error && !/passport|jshshir|token|8600|stir/i.test(err.message)
        ? err.message.slice(0, 200)
        : "Shartnoma yaratishda xatolik";
    await prisma.contractRequest.update({
      where: { id: row.id },
      data: { status: "FAILED", failReasonSafe: safe },
    });
    await recordStatusEvent({
      requestId: row.id,
      fromStatus: "GENERATING",
      toStatus: "FAILED",
      actorKind: "SYSTEM",
      reason: safe,
    });
    throw Object.assign(new Error(safe), { status: 500 });
  }
}
