import { randomUUID } from "crypto";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { requireLessorProfile } from "@/lib/api-server/contract-draft/lessor";
import {
  createContractToken,
  contractTokenExpiresAt,
} from "@/lib/api-server/contract-draft/phone-token";
import {
  assertContractStaff,
  contractFormUrl,
  recordStatusEvent,
  toPublicRequestView,
} from "@/lib/api-server/contract-draft/queries";
import {
  ACTIVE_REQUEST_STATUSES,
  mapUiPartyToCategorySubtype,
  TEMPLATE_VERSION,
} from "@/lib/api-server/contract-draft/status";
import {
  adminCreateSchema,
  validateAdminAmounts,
} from "@/lib/api-server/contract-draft/validation";
import { sendTelegramMessage } from "@/lib/api-server/telegram-bot";

function parseDateOnly(raw: string): Date {
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 5, 0, 0));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("Sana noto‘g‘ri");
  return d;
}

function formatDateUz(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

export async function createAndSendContractRequest(
  user: User,
  body: unknown
) {
  assertContractStaff(user);
  const parsed = adminCreateSchema.parse(body);
  const { monthlyAmount, totalAmount, phone } = validateAdminAmounts(parsed);
  const mapping = mapUiPartyToCategorySubtype(parsed.partyUiType);

  const lessor = await requireLessorProfile();
  if (!lessor.ok) {
    throw Object.assign(
      new Error(
        `Ijaraga beruvchi rekvizitlari yetishmayapti: ${lessor.missing.join(", ")}`
      ),
      { status: 400, code: "LESSOR_INCOMPLETE", missing: lessor.missing }
    );
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: parsed.tenantId } });
  if (!tenant) throw Object.assign(new Error("Mijoz topilmadi"), { status: 404 });

  const property = await prisma.property.findUnique({
    where: { id: parsed.propertyId },
  });
  if (!property) throw Object.assign(new Error("Xona/obyekt topilmadi"), { status: 404 });

  const startDate = parseDateOnly(parsed.startDate);
  const endDate = parseDateOnly(parsed.endDate);
  const contractDate = parseDateOnly(parsed.contractDate);
  if (!(startDate.getTime() < endDate.getTime())) {
    throw Object.assign(
      new Error("Boshlanish sanasi tugashdan oldin bo‘lishi kerak"),
      { status: 400 }
    );
  }

  const contractNumber = parsed.contractNumber?.trim() || null;
  if (contractNumber) {
    const taken = await prisma.contractRequest.findUnique({
      where: { contractNumber },
      select: { id: true },
    });
    if (taken) {
      throw Object.assign(
        new Error("Bu shartnoma raqami allaqachon band"),
        { status: 409 }
      );
    }
  }

  const contractCity =
    parsed.contractCity?.trim() || lessor.profile.lessorCity || "Тошкент шаҳри";
  const adminNotes = parsed.adminNotes?.trim() || "";

  const { rawToken, tokenHash } = createContractToken();
  const id = randomUUID();

  const adminSnapshot = {
    serviceName: parsed.serviceName,
    areaSqm: parsed.areaSqm,
    ratePerSqm: parsed.ratePerSqm,
    monthCount: parsed.monthCount,
    monthlyAmount,
    totalAmount,
    paymentDueDay: parsed.paymentDueDay,
    depositAmount: parsed.depositAmount,
    contractNumber,
    contractDate: formatDateUz(contractDate),
    contractCity,
    adminNotes: adminNotes || null,
    startDate: formatDateUz(startDate),
    endDate: formatDateUz(endDate),
    propertyTitle: property.title,
    propertyAddress: property.address,
    partyUiType: parsed.partyUiType,
  };

  const row = await prisma.$transaction(async (tx) => {
    const existingActive = await tx.contractRequest.findFirst({
      where: {
        tenantId: tenant.id,
        status: { in: ACTIVE_REQUEST_STATUSES },
      },
      select: { id: true },
    });
    if (existingActive) {
      throw Object.assign(
        new Error("Bu mijoz uchun faol shartnoma so‘rovi allaqachon mavjud"),
        { status: 409 }
      );
    }

    return tx.contractRequest.create({
      data: {
        id,
        tenantId: tenant.id,
        propertyId: property.id,
        createdByUserId: user.id,
        partyCategory: mapping.partyCategory,
        partySubtype: mapping.partySubtype,
        templateKind: mapping.templateKind,
        templateVersion: TEMPLATE_VERSION,
        status: "AWAITING_CLIENT",
        phoneNormalized: phone.normalized,
        phoneDisplay: phone.display,
        contractNumber,
        contractDate,
        startDate,
        endDate,
        serviceName: parsed.serviceName,
        areaSqm: parsed.areaSqm,
        ratePerSqm: parsed.ratePerSqm,
        monthCount: parsed.monthCount,
        monthlyAmount,
        totalAmount,
        paymentDueDay: parsed.paymentDueDay,
        depositAmount: parsed.depositAmount,
        adminSnapshot,
        lessorSnapshot: lessor.profile,
        tokenHash,
        tokenExpiresAt: contractTokenExpiresAt(),
        // Telegram hali bog‘lanmagan bo‘lsa soxta chatId saqlamaymiz
        telegramChatId: tenant.telegramChatId || null,
      },
      include: {
        tenant: { select: { id: true, fullName: true, phone: true } },
        property: { select: { id: true, title: true, address: true } },
        document: { select: { id: true, originalName: true, generatedAt: true } },
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    });
  });

  await recordStatusEvent({
    requestId: id,
    fromStatus: "DRAFT",
    toStatus: "AWAITING_CLIENT",
    actorUserId: user.id,
    actorKind: "ADMIN",
    reason: "Mijozga yuborildi",
  });

  let botNotified = false;
  const chatId = tenant.telegramChatId;
  if (chatId) {
    try {
      const url = contractFormUrl(rawToken);
      await sendTelegramMessage(
        chatId,
        `Hurmatli mijoz, siz uchun shartnoma so‘rovi yaratildi (${property.title}).\nMa’lumotlarni to‘ldirish uchun tugmani bosing.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📝 Shartnoma ma’lumotlarini to‘ldirish", url }],
            ],
          },
        }
      );
      botNotified = true;
    } catch {
      // so‘rov saqlanadi; bot keyin /start + telefon orqali bog‘lanadi
    }
  }

  const awaitClientMessage =
    "So‘rov tayyor. Mijoz @ArendaaAI_bot’da /start bosib, o‘z telefon raqamini yuborgach forma havolasini oladi.";

  return {
    request: toPublicRequestView(row),
    botNotified,
    userMessage: botNotified
      ? `So‘rov tayyor. Forma havolasi botga yuborildi. Agar ochilmasa: ${awaitClientMessage}`
      : awaitClientMessage,
  };
}
