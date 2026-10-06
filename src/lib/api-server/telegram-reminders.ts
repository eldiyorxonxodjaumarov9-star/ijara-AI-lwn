import type { Prisma } from "@prisma/client";

import { recordActivity, type ActivityInput } from "@/lib/api-server/activity-events";
import { WRITE_OFF_AMOUNTS, withWrittenOff } from "@/lib/api-server/debt-adjustments";
import type { ManualDebtReminderTarget } from "@/lib/api-server/manual-debts";
import {
  appendManualDebtsToReminder,
  buildManualDebtReminderMessage,
} from "@/lib/manual-debts";
import { prisma } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  formatUzs,
  groupDebtsByTenant,
  type DebtReminderInput,
  type ReminderTimeSlot,
} from "@/lib/payment-reminder-utils";
import { selectCanonicalDebts } from "@/lib/debts/canonical-debts";
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

/** Qarz hisoblanadigan statuslar — tugagan shartnomalar qarz 0 bo'lguncha qoladi. */
export const DEBT_CONTRACT_STATUSES = ["ACTIVE", "EXPIRED", "TERMINATED"] as const;

export type ServerDebtScope = {
  /** Faqat shu workspace (bulk eslatma). Berilmasa — barcha workspace (cron). */
  workspaceId?: string;
  tenantId?: string;
  now?: Date;
};

export async function computeServerDebts(
  scope: ServerDebtScope = {},
  db: Prisma.TransactionClient = prisma
): Promise<DebtReminderInput[]> {
  const contracts = await db.contract.findMany({
    where: {
      status: { in: [...DEBT_CONTRACT_STATUSES] },
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
      ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    },
    select: {
      id: true,
      propertyId: true,
      tenantId: true,
      startDate: true,
      endDate: true,
      monthlyRent: true,
      status: true,
      createdAt: true,
      property: { select: { title: true } },
      tenant: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          passport: true,
          rentAmount: true,
          paymentDueDate: true,
          leftAt: true,
          createdAt: true,
        },
      },
      payments: {
        select: {
          id: true,
          contractId: true,
          amount: true,
          paymentDate: true,
          periodYear: true,
          periodMonth: true,
          paymentMethod: true,
          createdAt: true,
        },
      },
      debtAdjustments: WRITE_OFF_AMOUNTS,
    },
  });
  const now = scope.now ?? new Date();

  const clientContracts: Contract[] = [];
  const tenantsById = new Map<string, Tenant>();
  const payments: Payment[] = [];

  for (const c of contracts) {
    clientContracts.push({
      id: c.id,
      propertyId: c.propertyId,
      tenantId: c.tenantId,
      propertyName: c.property.title,
      tenantName: c.tenant.fullName,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      monthlyPayment: c.monthlyRent,
      status: c.status.toLowerCase() as ContractStatus,
      writtenOffAmount: withWrittenOff(c).writtenOffAmount,
      createdAt: c.createdAt.toISOString(),
    });
    tenantsById.set(c.tenant.id, {
      id: c.tenant.id,
      fullName: c.tenant.fullName,
      phone: c.tenant.phone,
      passport: c.tenant.passport,
      rentAmount: c.tenant.rentAmount,
      paymentDueDate: c.tenant.paymentDueDate?.toISOString(),
      leftAt: c.tenant.leftAt?.toISOString(),
      createdAt: c.tenant.createdAt.toISOString(),
    });
    for (const p of c.payments) {
      payments.push({
        id: p.id,
        contractId: p.contractId,
        tenantId: c.tenantId,
        amount: p.amount,
        date: p.paymentDate.toISOString(),
        periodYear: p.periodYear ?? undefined,
        periodMonth: p.periodMonth ?? undefined,
        method: p.paymentMethod.toLowerCase() as Payment["method"],
        createdAt: p.createdAt.toISOString(),
      });
    }
  }

  return selectCanonicalDebts(
    clientContracts,
    payments,
    [...tenantsById.values()],
    now
  ).map((row) => ({
    contractId: row.contractId,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    propertyName: row.propertyName,
    debt: row.debt,
    overdueDays: row.overdueDays,
    monthsDue: row.monthsDue,
    unpaidMonths: row.unpaidMonths,
    oldestUnpaidDueDate: row.oldestUnpaidDueDate,
  }));
}

export async function getTenantDebtSummary(tenantId: string) {
  const debts = await computeServerDebts({ tenantId });
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

/**
 * Shartnoma qarzlari + qo'lda kiritilgan qarzlar. Bir workspace ichida bir chatga
 * bitta umumiy xabar; bir run'da har chatga ko'pi bilan bitta xabar.
 * Chat topilmasa — skip.
 */
export async function sendTelegramPaymentReminders(
  debts?: DebtReminderInput[],
  slot?: ReminderTimeSlot,
  manualDebts: ManualDebtReminderTarget[] = [],
  /** Only the scheduled cron counts as automation; staff-triggered sends are not. */
  opts: { recordAutomation?: boolean } = {}
) {
  if (!isTelegramBotConfigured()) {
    return { sent: 0, skipped: 0, failed: 0, reason: "bot_not_configured" };
  }

  const debtList = debts ?? (await computeServerDebts());
  const grouped = groupDebtsByTenant(debtList);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const tenantIds = [
    ...new Set(grouped.map((d) => d.tenantId).filter((id): id is string => !!id)),
  ];
  const tenantRows = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, telegramChatId: true, workspaceId: true },
      })
    : [];
  const tenantById = new Map(tenantRows.map((t) => [t.id, t]));

  type Outgoing = {
    chatId: string;
    workspaceId: string | null;
    contract?: (typeof grouped)[number];
    manual: ManualDebtReminderTarget[];
  };
  const outgoing = new Map<string, Outgoing>();

  for (const debt of grouped) {
    const tenant = debt.tenantId ? tenantById.get(debt.tenantId) : undefined;
    const chatId = tenant?.telegramChatId;
    if (!chatId) {
      skipped += 1;
      continue;
    }
    const key = `${tenant.workspaceId ?? ""}:${chatId}`;
    if (outgoing.has(key)) {
      skipped += 1;
      continue;
    }
    outgoing.set(key, { chatId, workspaceId: tenant.workspaceId ?? null, contract: debt, manual: [] });
  }
  for (const m of manualDebts) {
    if (!m.chatId || m.remainingAmount <= 0) {
      skipped += 1;
      continue;
    }
    const key = `${m.workspaceId}:${m.chatId}`;
    const entry = outgoing.get(key) ?? { chatId: m.chatId, workspaceId: m.workspaceId, manual: [] };
    entry.manual.push(m);
    outgoing.set(key, entry);
  }

  const sentChats = new Set<string>();
  const activity: ActivityInput[] = [];
  for (const entry of outgoing.values()) {
    if (sentChats.has(entry.chatId)) {
      skipped += 1;
      continue;
    }
    sentChats.add(entry.chatId);

    const text = entry.contract
      ? entry.manual.length > 0
        ? appendManualDebtsToReminder(
            buildPaymentReminderMessage(entry.contract, slot),
            entry.contract.debt,
            entry.manual
          )
        : buildPaymentReminderMessage(entry.contract, slot)
      : buildManualDebtReminderMessage(entry.manual, slot);
    try {
      await sendTelegramMessage(entry.chatId, text);
      sent += 1;
      if (opts.recordAutomation && entry.workspaceId) {
        activity.push({
          workspaceId: entry.workspaceId,
          action: "DEBT_REMINDER_SENT",
          entityType: entry.contract ? "Tenant" : "ManualDebt",
          entityId: entry.contract?.tenantId ?? entry.manual[0]?.manualDebtId ?? null,
          metadata: { slot: slot ?? undefined, manualDebts: entry.manual.length },
        });
      }
    } catch {
      failed += 1;
    }
  }

  await recordActivity(activity);
  return { sent, skipped, failed };
}
