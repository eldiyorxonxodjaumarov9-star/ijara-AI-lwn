import { prisma } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  formatUzs,
  groupDebtsByTenant,
  type DebtReminderInput,
  type ReminderTimeSlot,
} from "@/lib/payment-reminder-utils";
import { computeContractDebt } from "@/lib/debt-calculator";
import type { Contract, Payment, Tenant } from "@/types";
import { normalizePhone } from "@/lib/api-server/tenant-lookup";
import { updateBotUserPhone } from "@/lib/api-server/telegram-bot-users";
import {
  isTelegramBotConfigured,
  sendTelegramMessage,
} from "@/lib/api-server/telegram-bot";
import type { ContractStatus } from "@/types";

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
      const contract: Contract = {
        id: c.id,
        propertyId: c.propertyId,
        tenantId: c.tenantId,
        propertyName: c.property.title,
        tenantName: c.tenant.fullName,
        startDate: c.startDate.toISOString(),
        endDate: c.endDate.toISOString(),
        monthlyPayment: c.monthlyRent,
        deposit: c.deposit ?? undefined,
        depositPaid: c.depositPaid,
        status: c.status.toLowerCase() as ContractStatus,
        notes: c.notes ?? undefined,
        createdAt: c.createdAt.toISOString(),
      };
      const tenant: Tenant = {
        id: c.tenant.id,
        fullName: c.tenant.fullName,
        phone: c.tenant.phone,
        passport: c.tenant.passport,
        rentAmount: c.tenant.rentAmount,
        paymentDueDate: c.tenant.paymentDueDate?.toISOString(),
        createdAt: c.tenant.createdAt.toISOString(),
      };
      const payments: Payment[] = c.payments.map((p) => ({
        id: p.id,
        contractId: p.contractId,
        tenantId: c.tenantId,
        amount: p.amount,
        date: p.paymentDate.toISOString(),
        method: p.paymentMethod.toLowerCase() as Payment["method"],
        note: p.notes ?? undefined,
        createdAt: p.createdAt.toISOString(),
      }));
      const result = computeContractDebt(contract, payments, tenant, now);
      return {
        contractId: c.id,
        tenantId: c.tenantId,
        tenantName: c.tenant.fullName,
        propertyName: c.property.title,
        debt: result.debt,
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

async function unlinkTelegramChat(chatId: string) {
  await prisma.tenant.updateMany({
    where: { telegramChatId: chatId },
    data: { telegramChatId: null },
  });
}

export async function processPhoneForBot(chatId: string, phoneNumber: string) {
  await updateBotUserPhone(chatId, phoneNumber);

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

  await unlinkTelegramChat(chatId);
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      telegramChatId: chatId,
      telegram: tenant.telegram ?? undefined,
    },
  });

  await updateBotUserPhone(chatId, phoneNumber, tenant.id);

  const message = await buildTenantInfoMessage(tenant.id, true);
  return { ok: true as const, tenant, message };
}

export async function sendTelegramPaymentReminders(
  debts?: DebtReminderInput[],
  slot?: ReminderTimeSlot
) {
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

    const text = buildPaymentReminderMessage(debt, slot);
    try {
      await sendTelegramMessage(tenant.telegramChatId, text);
      sent += 1;
    } catch {
      skipped += 1;
    }
  }

  return { sent, skipped };
}
