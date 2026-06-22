import { prisma } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  groupDebtsByTenant,
  type DebtReminderInput,
} from "@/lib/payment-reminder-utils";
import { normalizePhone } from "@/lib/api-server/tenant-lookup";
import {
  isTelegramBotConfigured,
  sendContactRequest,
  sendTelegramMessage,
} from "@/lib/api-server/telegram-bot";

function monthsBetween(from: Date, to: Date) {
  if (to < from) return 0;
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export async function computeServerDebts(): Promise<DebtReminderInput[]> {
  const contracts = await prisma.contract.findMany({
    where: { status: { in: ["ACTIVE", "EXPIRED"] } },
    include: { property: true, tenant: true, payments: true },
  });
  const now = new Date();

  return contracts
    .map((c) => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      const until = now < end ? now : end;
      const monthsDue = Math.max(1, monthsBetween(start, until) + 1);
      const expected = monthsDue * c.monthlyRent;
      const paid = c.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        contractId: c.id,
        tenantId: c.tenantId,
        tenantName: c.tenant.fullName,
        propertyName: c.property.title,
        debt: expected - paid,
      };
    })
    .filter((d) => d.debt > 0);
}

export async function getTenantDebtSummary(tenantId: string) {
  const debts = (await computeServerDebts()).filter((d) => d.tenantId === tenantId);
  const grouped = groupDebtsByTenant(debts);
  return grouped[0] ?? null;
}

export async function linkTenantTelegramChat(
  chatId: string,
  phoneNumber: string
) {
  const norm = normalizePhone(phoneNumber);
  const tenants = await prisma.tenant.findMany();
  const tenant = tenants.find((t) => normalizePhone(t.phone) === norm);

  if (!tenant) {
    return {
      ok: false as const,
      message:
        "Bu telefon raqam arendatorlar ro'yxatida topilmadi. Admin bilan bog'laning.",
    };
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      telegramChatId: chatId,
      telegram: tenant.telegram ?? `@${chatId}`,
    },
  });

  const debt = await getTenantDebtSummary(tenant.id);
  let message =
    `✅ <b>Ro'yxatdan o'tdingiz!</b>\n\n` +
    `Ism: ${tenant.fullName}\n` +
    `Endi to'lov eslatmalari shu bot orqali yuboriladi.`;

  if (debt) {
    message += "\n\n⚠️ " + buildPaymentReminderMessage(debt);
  } else {
    message += "\n\n✅ Hozircha qarzdorlik yo'q.";
  }

  return { ok: true as const, tenant, message };
}

export async function sendTelegramPaymentReminders(debts?: DebtReminderInput[]) {
  if (!isTelegramBotConfigured()) {
    return { sent: 0, skipped: 0, reason: "bot_not_configured" };
  }

  const debtList = debts ?? (await computeServerDebts());
  const grouped = groupDebtsByTenant(debtList);
  let sent = 0;
  let skipped = 0;

  for (const debt of grouped) {
    if (!debt.tenantId) {
      skipped += 1;
      continue;
    }
    const tenant = await prisma.tenant.findUnique({
      where: { id: debt.tenantId },
      select: { telegramChatId: true, fullName: true },
    });
    if (!tenant?.telegramChatId) {
      skipped += 1;
      continue;
    }

    const text = buildPaymentReminderMessage(debt);
    try {
      await sendTelegramMessage(tenant.telegramChatId, text);
      sent += 1;
    } catch {
      skipped += 1;
    }
  }

  return { sent, skipped };
}

export async function handleTelegramUpdate(update: {
  message?: {
    chat: { id: number };
    text?: string;
    contact?: { phone_number: string };
  };
}) {
  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const text = message.text?.trim() ?? "";

  if (text.startsWith("/start")) {
    const linked = await prisma.tenant.findFirst({
      where: { telegramChatId: chatId },
    });
    if (linked) {
      const debt = await getTenantDebtSummary(linked.id);
      let reply =
        `Salom, <b>${linked.fullName}</b>! Siz allaqachon ulangansiz.\n` +
        `To'lov eslatmalari avtomatik yuboriladi.`;
      if (debt) {
        reply += "\n\n⚠️ " + buildPaymentReminderMessage(debt);
      } else {
        reply += "\n\n✅ Hozircha qarzdorlik yo'q.";
      }
      await sendTelegramMessage(chatId, reply, {
        reply_markup: { remove_keyboard: true },
      });
      return;
    }
    await sendContactRequest(chatId);
    return;
  }

  if (message.contact?.phone_number) {
    const result = await linkTenantTelegramChat(
      chatId,
      message.contact.phone_number
    );
    await sendTelegramMessage(chatId, result.message, {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (text.startsWith("/help") || text.startsWith("/yordam")) {
    await sendTelegramMessage(
      chatId,
      "<b>ArendaAi bot</b>\n\n" +
        "/start — ro'yxatdan o'tish va eslatmalarni yoqish\n" +
        "Telefon raqamingiz arendatorlar bazasida bo'lishi kerak.\n\n" +
        "Qarzdorlik bo'lsa, bot va platforma avtomatik eslatma yuboradi."
    );
  }
}
