import { prisma } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  formatUzs,
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

function formatDateUz(value?: Date | string | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function looksLikePhone(text: string) {
  const digits = normalizePhone(text);
  return digits.length >= 9;
}

export async function findTenantByPhone(phoneNumber: string) {
  const norm = normalizePhone(phoneNumber);
  const tenants = await prisma.tenant.findMany();
  return tenants.find((t) => normalizePhone(t.phone) === norm) ?? null;
}

async function getTenantRentalInfo(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;

  const contract = await prisma.contract.findFirst({
    where: {
      tenantId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });

  const debt = await getTenantDebtSummary(tenantId);
  const contractMonths =
    tenant.contractDuration ??
    (contract
      ? Math.max(
          1,
          monthsBetween(new Date(contract.startDate), new Date(contract.endDate))
        )
      : null);

  return { tenant, contract, debt, contractMonths };
}

export async function buildTenantInfoMessage(tenantId: string, linked = false) {
  const info = await getTenantRentalInfo(tenantId);
  if (!info) {
    return "Ma'lumot topilmadi.";
  }

  const { tenant, contract, debt, contractMonths } = info;
  const roomName = contract?.property.title ?? "—";
  const lines: string[] = [];

  if (linked) {
    lines.push("✅ <b>Siz bazada topildingiz!</b>\n");
  } else {
    lines.push(`Salom, <b>${tenant.fullName}</b>!\n`);
  }

  lines.push(`👤 <b>Ism:</b> ${tenant.fullName}`);
  lines.push(`📱 <b>Telefon:</b> ${tenant.phone}`);

  if (contract) {
    lines.push(`\n🏠 <b>Xona:</b> ${roomName} xonada arenda olgansiz`);
    lines.push(`📅 <b>Arenda kirish:</b> ${formatDateUz(contract.startDate)}`);
    if (contractMonths) {
      lines.push(`📋 <b>Shartnoma muddati:</b> ${contractMonths} oy`);
    }
    lines.push(`📆 <b>Shartnoma tugashi:</b> ${formatDateUz(contract.endDate)}`);
    lines.push(`💰 <b>Oylik ijara:</b> ${formatUzs(contract.monthlyRent)}`);
    if (tenant.paymentDueDate) {
      lines.push(
        `⏰ <b>To'lov muddati:</b> ${formatDateUz(tenant.paymentDueDate)}`
      );
    }
  } else {
    lines.push("\n⚠️ Faol shartnoma topilmadi. Admin bilan bog'laning.");
  }

  if (debt && debt.debt > 0) {
    lines.push(`\n⚠️ <b>Qarzdorlik:</b> ${formatUzs(debt.debt)}`);
  } else {
    lines.push("\n✅ Hozircha qarzdorlik yo'q.");
  }

  if (linked) {
    lines.push(
      "\nKelishdik! To'lov eslatmalari shu bot orqali avtomatik yuboriladi."
    );
  }

  return lines.join("\n");
}

export async function processPhoneForBot(chatId: string, phoneNumber: string) {
  const tenant = await findTenantByPhone(phoneNumber);

  if (!tenant) {
    return {
      ok: false as const,
      message:
        "❌ <b>Bu telefon raqam bazada yo'q.</b>\n\n" +
        "Raqamni tekshirib qayta yuboring yoki admin bilan bog'laning.\n\n" +
        "Misol: +998901234567",
    };
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      telegramChatId: chatId,
      telegram: tenant.telegram ?? undefined,
    },
  });

  const message = await buildTenantInfoMessage(tenant.id, true);
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
      const reply = await buildTenantInfoMessage(linked.id, false);
      await sendTelegramMessage(chatId, reply, {
        reply_markup: { remove_keyboard: true },
      });
      return;
    }
    await sendContactRequest(chatId);
    return;
  }

  if (message.contact?.phone_number) {
    const result = await processPhoneForBot(chatId, message.contact.phone_number);
    await sendTelegramMessage(chatId, result.message, {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (looksLikePhone(text)) {
    const result = await processPhoneForBot(chatId, text);
    await sendTelegramMessage(chatId, result.message, {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (text.startsWith("/help") || text.startsWith("/yordam")) {
    await sendTelegramMessage(
      chatId,
      "<b>ArendaAi bot</b>\n\n" +
        "/start — telefon raqamni yuborish\n" +
        "Raqam bazada bo'lsa, xona va shartnoma ma'lumotlari chiqadi.\n" +
        "Raqamni yozishingiz yoki tugma orqali yuborishingiz mumkin.\n\n" +
        "Qarzdorlik bo'lsa, bot avtomatik eslatma yuboradi."
    );
    return;
  }

  if (text && !text.startsWith("/")) {
    await sendTelegramMessage(
      chatId,
      "Telefon raqamingizni yuboring.\n\n" +
        "Tugmani bosing yoki raqamni yozing: <code>+998901234567</code>\n\n" +
        "/start — qayta boshlash"
    );
  }
}
