import { prisma } from "@/lib/api-server/prisma";
import {
  contractFormUrl,
  recordStatusEvent,
} from "@/lib/api-server/contract-draft/queries";
import {
  createContractToken,
  contractTokenExpiresAt,
  hashContractToken,
  normalizeContractPhone,
} from "@/lib/api-server/contract-draft/phone-token";
import { PENDING_CLIENT_STATUSES } from "@/lib/api-server/contract-draft/status";
import { loadContractDocxBytes } from "@/lib/api-server/contract-draft/storage";
import {
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/api-server/telegram-bot";

type PendingRow = {
  id: string;
  tokenHash: string;
  property: { title: string; address: string };
};

/** Issue a fresh raw token for bot link (rotates hash). */
export async function rotateFormToken(requestId: string): Promise<string> {
  const { rawToken, tokenHash } = createContractToken();
  await prisma.contractRequest.update({
    where: { id: requestId },
    data: {
      tokenHash,
      tokenExpiresAt: contractTokenExpiresAt(),
    },
  });
  return rawToken;
}

export async function findPendingByPhone(phoneRaw: string): Promise<PendingRow[]> {
  const { normalized } = normalizeContractPhone(phoneRaw);
  return prisma.contractRequest.findMany({
    where: {
      phoneNormalized: normalized,
      status: { in: PENDING_CLIENT_STATUSES },
      tokenExpiresAt: { gt: new Date() },
    },
    include: {
      property: { select: { title: true, address: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function sendFormLinkForRequest(
  chatId: string,
  requestId: string
) {
  const rawToken = await rotateFormToken(requestId);
  const url = contractFormUrl(rawToken);
  await prisma.contractRequest.update({
    where: { id: requestId },
    data: {
      telegramChatId: String(chatId),
      status: "AWAITING_CLIENT",
    },
  });
  await sendTelegramMessage(
    chatId,
    "Shartnoma ma’lumotlarini to‘ldirish uchun quyidagi tugmani bosing.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 Shartnoma ma’lumotlarini to‘ldirish", url }],
        ],
      },
    }
  );
}

export async function handleContractContactFlow(input: {
  chatId: string;
  fromId?: number | null;
  contact: { phone_number?: string; user_id?: number };
}): Promise<boolean> {
  const phone = input.contact.phone_number;
  if (!phone) return false;

  if (
    input.contact.user_id != null &&
    input.fromId != null &&
    Number(input.contact.user_id) !== Number(input.fromId)
  ) {
    await sendTelegramMessage(
      input.chatId,
      "Faqat o‘zingizning telefon raqamingizni yuboring."
    );
    return true;
  }

  let pending: PendingRow[];
  try {
    pending = await findPendingByPhone(phone);
  } catch {
    await sendTelegramMessage(
      input.chatId,
      "Telefon raqami noto‘g‘ri formatda."
    );
    return true;
  }

  await prisma.telegramBotUser.updateMany({
    where: { chatId: String(input.chatId) },
    data: {
      phone: normalizeContractPhone(phone).normalized,
      phoneVerifiedAt: new Date(),
      telegramUserId:
        input.fromId != null ? String(input.fromId) : undefined,
    },
  });

  if (pending.length === 0) {
    return false;
  }

  if (pending.length === 1) {
    await sendFormLinkForRequest(input.chatId, pending[0]!.id);
    return true;
  }

  await sendTelegramMessage(
    input.chatId,
    "Bir nechta shartnoma so‘rovi topildi. Xonani tanlang:",
    {
      reply_markup: {
        inline_keyboard: pending.map((p) => [
          {
            text: p.property.title.slice(0, 60),
            callback_data: `cdr:${p.id}`,
          },
        ]),
      },
    }
  );
  return true;
}

export async function handleContractDraftCallback(
  chatId: string,
  data: string
): Promise<boolean> {
  if (!data.startsWith("cdr:")) return false;
  const requestId = data.slice(4);
  const row = await prisma.contractRequest.findFirst({
    where: {
      id: requestId,
      status: { in: PENDING_CLIENT_STATUSES },
    },
  });
  if (!row) {
    await sendTelegramMessage(chatId, "So‘rov topilmadi yoki muddati tugagan.");
    return true;
  }
  await sendFormLinkForRequest(chatId, row.id);
  return true;
}

export async function processPendingContractDeliveries(limit = 10) {
  const due = await prisma.contractDeliveryEvent.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    take: limit,
    include: {
      request: {
        include: { document: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const ev of due) {
    const chatId = ev.telegramChatId || ev.request.telegramChatId;
    const doc = ev.request.document;
    if (!chatId || !doc) {
      await prisma.contractDeliveryEvent.update({
        where: { id: ev.id },
        data: {
          status: "FAILED",
          lastErrorSafe: "Chat yoki hujjat yo‘q",
          attempts: ev.attempts + 1,
          nextRetryAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      continue;
    }
    try {
      const { body } = await loadContractDocxBytes({
        storageUrl: doc.storageUrl,
        storageKey: doc.storageKey,
      });
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) throw new Error("Bot sozlanmagan");
      const form = new FormData();
      form.set("chat_id", chatId);
      form.set(
        "caption",
        `Shartnomangiz tayyor${ev.request.contractNumber ? ` (№ ${ev.request.contractNumber})` : ""}.`
      );
      form.set(
        "document",
        new Blob([new Uint8Array(body)], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        doc.originalName
      );
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendDocument`,
        { method: "POST", body: form }
      );
      if (!res.ok) throw new Error("Telegram yuborish xatosi");
      await prisma.contractDeliveryEvent.update({
        where: { id: ev.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: ev.attempts + 1,
          lastErrorSafe: null,
        },
      });
    } catch {
      await prisma.contractDeliveryEvent.update({
        where: { id: ev.id },
        data: {
          status: "FAILED",
          attempts: ev.attempts + 1,
          lastErrorSafe: "Yuborib bo‘lmadi",
          nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
    }
  }
}

export function hashTokenForLookup(raw: string) {
  return hashContractToken(raw);
}

export type { TelegramUpdate };
