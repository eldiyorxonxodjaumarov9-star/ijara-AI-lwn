import { randomUUID } from "crypto";

import { prisma } from "@/lib/api-server/prisma";
import {
  contractFormUrl,
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

const MAX_DELIVERY_ATTEMPTS = 12;
const INLINE_RETRY_DELAY_MS = 800;

type PendingRow = {
  id: string;
  tokenHash: string;
  phoneNormalized: string;
  property: { title: string; address: string };
};

export function pendingLabel(p: {
  property: { title: string; address: string };
}): string {
  const room = p.property.title.trim() || "Xona";
  const obj = p.property.address.trim();
  const label = obj ? `${obj} — ${room}` : room;
  return label.slice(0, 64);
}

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
    select: {
      id: true,
      tokenHash: true,
      phoneNormalized: true,
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

/**
 * Contract matching requires a shared Telegram contact (not typed phone)
 * to prevent claiming another person's draft.
 */
export async function handleContractContactFlow(input: {
  chatId: string;
  fromId?: number | null;
  contact: { phone_number?: string; user_id?: number };
  /** When true, phone was typed as text — do not claim contract drafts */
  typedPhone?: boolean;
}): Promise<boolean> {
  const phone = input.contact.phone_number;
  if (!phone) return false;

  if (input.typedPhone) {
    try {
      const pending = await findPendingByPhone(phone);
      if (pending.length > 0) {
        await sendTelegramMessage(
          input.chatId,
          "Shartnoma so‘rovi topildi.\n" +
            "Davom etish uchun «📱 Telefon raqamimni yuborish» tugmasidan foydalaning " +
            "(yozma raqam qabul qilinmaydi)."
        );
        return true;
      }
    } catch {
      // fall through to normal onboarding
    }
    return false;
  }

  if (
    input.contact.user_id == null ||
    input.fromId == null ||
    Number(input.contact.user_id) !== Number(input.fromId)
  ) {
    await sendTelegramMessage(
      input.chatId,
      "Faqat o‘zingizning telefon raqamingizni yuboring.\n" +
        "Shartnoma uchun «📱 Telefon raqamimni yuborish» tugmasidan foydalaning."
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

  const normalized = normalizeContractPhone(phone).normalized;
  await prisma.telegramBotUser.updateMany({
    where: { chatId: String(input.chatId) },
    data: {
      phone: normalized,
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
    "Bir nechta shartnoma so‘rovi topildi. Obyekt va xonani tanlang:",
    {
      reply_markup: {
        inline_keyboard: pending.map((p) => [
          {
            text: pendingLabel(p),
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

  const botUser = await prisma.telegramBotUser.findUnique({
    where: { chatId: String(chatId) },
    select: { phone: true },
  });
  if (!botUser?.phone) {
    await sendTelegramMessage(
      chatId,
      "Avval telefon raqamingizni tugma orqali yuboring."
    );
    return true;
  }

  const row = await prisma.contractRequest.findFirst({
    where: {
      id: requestId,
      status: { in: PENDING_CLIENT_STATUSES },
      phoneNormalized: botUser.phone,
    },
  });
  if (!row) {
    await sendTelegramMessage(
      chatId,
      "So‘rov topilmadi, muddati tugagan yoki boshqa raqamga tegishli."
    );
    return true;
  }
  await sendFormLinkForRequest(chatId, row.id);
  return true;
}

function classifyTelegramDeliveryError(status: number, bodyText: string): {
  permanent: boolean;
  safeMessage: string;
} {
  const lower = bodyText.toLowerCase();
  const permanentHints = [
    "chat not found",
    "blocked by the user",
    "user is deactivated",
    "bot was blocked",
    "forbidden",
    "chat_id is empty",
  ];
  if (status === 403 || status === 400) {
    if (permanentHints.some((h) => lower.includes(h)) || status === 403) {
      return { permanent: true, safeMessage: "Telegram qabul qilmadi" };
    }
  }
  if (status >= 500 || status === 429) {
    return { permanent: false, safeMessage: "Telegram vaqtincha xato" };
  }
  return { permanent: false, safeMessage: "Yuborib bo‘lmadi" };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function sendOneDelivery(ev: {
  id: string;
  attempts: number;
  telegramChatId: string | null;
  request: {
    id: string;
    telegramChatId: string | null;
    contractNumber: string | null;
    document: {
      storageUrl: string;
      storageKey: string | null;
      originalName: string;
    } | null;
  };
}): Promise<"sent" | "retry" | "permanent" | "skip"> {
  const chatId = ev.telegramChatId || ev.request.telegramChatId;
  const doc = ev.request.document;
  if (!chatId || !doc) {
    await prisma.contractDeliveryEvent.update({
      where: { id: ev.id },
      data: {
        status: "FAILED",
        lastErrorSafe: "Chat yoki hujjat yo‘q",
        attempts: ev.attempts + 1,
        nextRetryAt: null,
      },
    });
    return "permanent";
  }
  if (ev.attempts >= MAX_DELIVERY_ATTEMPTS) {
    await prisma.contractDeliveryEvent.update({
      where: { id: ev.id },
      data: {
        status: "FAILED",
        lastErrorSafe: "Urinishlar limiti",
        nextRetryAt: null,
      },
    });
    return "permanent";
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
    const raw = await res.text();
    if (!res.ok) {
      const classified = classifyTelegramDeliveryError(res.status, raw);
      await prisma.contractDeliveryEvent.update({
        where: { id: ev.id },
        data: {
          status: "FAILED",
          attempts: ev.attempts + 1,
          lastErrorSafe: classified.safeMessage,
          nextRetryAt: classified.permanent
            ? null
            : new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      return classified.permanent ? "permanent" : "retry";
    }
    await prisma.contractDeliveryEvent.update({
      where: { id: ev.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: ev.attempts + 1,
        lastErrorSafe: null,
        nextRetryAt: null,
      },
    });
    return "sent";
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
    return "retry";
  }
}

export async function processPendingContractDeliveries(
  limit = 10,
  opts?: { inlineRetries?: number }
) {
  const now = new Date();
  const due = await prisma.contractDeliveryEvent.findMany({
    where: {
      attempts: { lt: MAX_DELIVERY_ATTEMPTS },
      OR: [
        {
          status: "PENDING",
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        {
          status: "FAILED",
          nextRetryAt: { lte: now },
        },
      ],
    },
    take: limit,
    include: {
      request: {
        include: { document: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const inlineRetries = Math.max(0, opts?.inlineRetries ?? 0);

  for (const ev of due) {
    let current = ev;
    let outcome = await sendOneDelivery(current);
    for (let i = 0; i < inlineRetries && outcome === "retry"; i++) {
      await sleep(INLINE_RETRY_DELAY_MS);
      const refreshed = await prisma.contractDeliveryEvent.findUnique({
        where: { id: ev.id },
        include: { request: { include: { document: true } } },
      });
      if (!refreshed || refreshed.status === "SENT") break;
      current = refreshed;
      outcome = await sendOneDelivery(current);
    }
  }
}

/** Admin-triggered resend: only CREATED + document; idempotent if already SENT unless force. */
export async function enqueueContractDeliveryResend(input: {
  requestId: string;
  force?: boolean;
}): Promise<{ queued: boolean; message: string }> {
  const row = await prisma.contractRequest.findUnique({
    where: { id: input.requestId },
    include: { document: true, deliveries: { orderBy: { createdAt: "desc" } } },
  });
  if (!row || row.status !== "CREATED" || !row.document) {
    throw Object.assign(new Error("Yuborish uchun tayyor hujjat yo‘q"), {
      status: 400,
    });
  }
  if (!row.telegramChatId) {
    throw Object.assign(
      new Error("Mijoz Telegram chati bog‘lanmagan"),
      { status: 400 }
    );
  }

  const lastSent = row.deliveries.find((d) => d.status === "SENT");
  if (lastSent && !input.force) {
    return {
      queued: false,
      message: "Hujjat allaqachon yuborilgan. Qayta yuborish uchun force kerak.",
    };
  }

  await prisma.contractDeliveryEvent.updateMany({
    where: {
      requestId: input.requestId,
      status: { in: ["PENDING", "FAILED"] },
      nextRetryAt: { not: null },
    },
    data: { nextRetryAt: null, lastErrorSafe: "Admin resend" },
  });

  await prisma.contractDeliveryEvent.create({
    data: {
      id: randomUUID(),
      requestId: input.requestId,
      channel: "TELEGRAM",
      status: "PENDING",
      telegramChatId: row.telegramChatId,
      nextRetryAt: new Date(),
    },
  });
  return { queued: true, message: "Botga qayta yuborish navbatga qo‘yildi" };
}

export function hashTokenForLookup(raw: string) {
  return hashContractToken(raw);
}

export type { TelegramUpdate };
