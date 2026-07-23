import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { computeContractDebt } from "@/lib/debt-calculator";
import { sendTelegramMessage } from "@/lib/api-server/telegram-bot";
import {
  formatUzs,
  type DebtReminderInput,
} from "@/lib/payment-reminder-utils";
import {
  DUE_SOON_WINDOW,
  formatScheduleStatus,
  formatTashkentClock,
  getPaymentDayOfMonth,
  getPaymentSchedule,
} from "@/lib/payment-due-schedule";
import type { Contract, ContractStatus, Payment, Tenant } from "@/types";

const OWNER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export function daysUntilPayment(dueDate?: Date | null) {
  const schedule = getPaymentSchedule(dueDate);
  if (!schedule) return null;
  if (schedule.overdueDays > 0) return -schedule.overdueDays;
  return schedule.daysLeft;
}

function formatDebtStatus(row: AdminTenantRow) {
  if (!row.hasDebt) {
    if (row.daysLeft === null) return "To'lov muddati kiritilmagan";
    if (row.daysLeft === 0) return "Bugun to'lov kuni";
    if (row.daysLeft > 0) return `To'lovga ${row.daysLeft} kun qoldi`;
    return "Qarzsiz";
  }
  const parts: string[] = [];
  if (row.debtAmount > 0) parts.push(formatUzs(row.debtAmount));
  if (row.overdueDays > 0) parts.push(`${row.overdueDays} kun kechikkan`);
  else if (row.monthsDue > 0) parts.push(`${row.monthsDue} oy qarzdor`);
  else parts.push("Qarzdor");
  return parts.join(" · ");
}

export async function verifyOwnerCredentials(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.isActive || !OWNER_ROLES.includes(user.role)) {
    return null;
  }
  const valid = await bcrypt.compare(password, user.password);
  return valid ? user : null;
}

export async function linkAdminChat(userId: string, chatId: string) {
  const { linkAdminDevice } = await import("@/lib/api-server/telegram-admin-auth");
  await linkAdminDevice(userId, chatId);
}

export async function unlinkAdminChat(chatId: string) {
  const { unlinkAdminDevice } = await import("@/lib/api-server/telegram-admin-auth");
  await unlinkAdminDevice(chatId);
}

export async function getOwnerByChatId(chatId: string) {
  const { getOwnerByAdminChatId } = await import("@/lib/api-server/telegram-admin-auth");
  return getOwnerByAdminChatId(chatId);
}

export type AdminTenantRow = {
  id: string;
  fullName: string;
  phone: string;
  room: string;
  paymentDueDate: Date | null;
  paymentDayOfMonth: number | null;
  daysLeft: number | null;
  overdueDays: number;
  monthsDue: number;
  debtAmount: number;
  hasDebt: boolean;
  isDueSoon: boolean;
};

/**
 * Saytdagi Qarzdorliklar / Arendatorlar bilan bir xil hisob:
 * to'lovlar bo'yicha computeContractDebt + Toshkent vaqti.
 */
export async function getAdminDashboardRows(): Promise<AdminTenantRow[]> {
  const now = new Date();
  const tenants = await prisma.tenant.findMany({
    where: { leftAt: null },
    orderBy: { fullName: "asc" },
    include: {
      contracts: {
        where: { status: { in: ["ACTIVE", "PENDING", "EXPIRED"] } },
        include: {
          property: true,
          payments: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return tenants.map((t) => {
    const contractRow =
      t.contracts.find((c) => c.status === "ACTIVE" || c.status === "PENDING") ??
      t.contracts[0];

    let debtAmount = 0;
    let overdueDays = 0;
    let monthsDue = 0;

    if (contractRow) {
      const contract: Contract = {
        id: contractRow.id,
        propertyId: contractRow.propertyId,
        tenantId: t.id,
        propertyName: contractRow.property.title,
        tenantName: t.fullName,
        startDate: contractRow.startDate.toISOString(),
        endDate: contractRow.endDate.toISOString(),
        monthlyPayment: contractRow.monthlyRent,
        deposit: contractRow.deposit ?? undefined,
        depositPaid: contractRow.depositPaid,
        status: contractRow.status.toLowerCase() as ContractStatus,
        notes: contractRow.notes ?? undefined,
        createdAt: contractRow.createdAt.toISOString(),
      };
      const tenant: Tenant = {
        id: t.id,
        fullName: t.fullName,
        phone: t.phone,
        passport: t.passport,
        rentAmount: t.rentAmount,
        paymentDueDate: t.paymentDueDate?.toISOString(),
        createdAt: t.createdAt.toISOString(),
      };
      const payments: Payment[] = contractRow.payments.map((p) => ({
        id: p.id,
        contractId: p.contractId,
        tenantId: t.id,
        amount: p.amount,
        date: p.paymentDate.toISOString(),
        periodYear: p.periodYear ?? undefined,
        periodMonth: p.periodMonth ?? undefined,
        method: p.paymentMethod.toLowerCase() as Payment["method"],
        note: p.notes ?? undefined,
        createdAt: p.createdAt.toISOString(),
      }));
      const result = computeContractDebt(contract, payments, tenant, now);
      debtAmount = result.debt;
      overdueDays = result.overdueDays;
      monthsDue = result.monthsDue;
    }

    const hasDebt = debtAmount > 0;
    const schedule = getPaymentSchedule(t.paymentDueDate, now);

    return {
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      room: contractRow?.property.title ?? "—",
      paymentDueDate: t.paymentDueDate,
      paymentDayOfMonth: t.paymentDueDate
        ? getPaymentDayOfMonth(t.paymentDueDate)
        : null,
      daysLeft: schedule
        ? schedule.overdueDays > 0
          ? -schedule.overdueDays
          : schedule.daysLeft
        : null,
      overdueDays: hasDebt ? overdueDays : 0,
      monthsDue,
      debtAmount,
      hasDebt,
      // Faqat qarzsiz va yaqin to'lov — saytdagi "yaqin" mantiq
      isDueSoon: !hasDebt && (schedule?.isDueSoon ?? false),
    };
  });
}

function chunkLines(lines: string[], maxLen = 3900) {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function buildAdminTenantsMessage(rows: AdminTenantRow[]) {
  if (rows.length === 0) {
    return "📋 <b>Arendatorlar</b>\n\nHozircha faol arendator yo'q.";
  }
  const lines = [
    `📋 <b>Arendatorlar</b> (${rows.length} ta)`,
    `🕐 ${formatTashkentClock()}\n`,
  ];
  rows.forEach((r, i) => {
    lines.push(
      `${i + 1}. <b>${r.fullName}</b> — ${r.room}`,
      `   📱 ${r.phone}`,
      `   ${r.hasDebt ? "⚠️" : "✅"} ${formatDebtStatus(r)}`,
      ""
    );
  });
  return lines.join("\n").trim();
}

export function buildAdminDebtorsMessage(rows: AdminTenantRow[]) {
  const debtors = rows
    .filter((r) => r.hasDebt)
    .sort((a, b) => b.debtAmount - a.debtAmount);
  if (debtors.length === 0) {
    return "✅ <b>Qarzdorlar</b>\n\nHozircha qarzdor arendator yo'q (sayt bilan bir xil).";
  }
  const totalDebt = debtors.reduce((s, r) => s + r.debtAmount, 0);
  const lines = [
    `⚠️ <b>Qarzdorlar</b> (${debtors.length} ta)`,
    `💰 Jami qarz: <b>${formatUzs(totalDebt)}</b>`,
    `🕐 ${formatTashkentClock()}\n`,
  ];
  debtors.forEach((r, i) => {
    lines.push(
      `${i + 1}. <b>${r.fullName}</b> — ${r.room}`,
      `   💰 ${formatDebtStatus(r)}`,
      `   📱 ${r.phone}`,
      ""
    );
  });
  return lines.join("\n").trim();
}

export function buildAdminDueSoonMessage(rows: AdminTenantRow[]) {
  const today = formatTashkentClock();
  const dueSoon = rows
    .filter((r) => r.isDueSoon && r.paymentDayOfMonth !== null)
    .sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99));

  if (dueSoon.length === 0) {
    return (
      `📅 <b>To'lov muddati yaqin kelganlar</b>\n` +
      `🕐 Toshkent: ${today}\n\n` +
      `Keyingi ${DUE_SOON_WINDOW} kun ichida to'lov muddati yaqinlashgan (qarzsiz) arendator yo'q.`
    );
  }

  const lines = [
    `📅 <b>To'lov muddati yaqin kelganlar</b> (${dueSoon.length} ta)`,
    `🕐 Toshkent: ${today}`,
    `ℹ️ Faqat qarzsiz, yaqin kunlarda to'lov qilishi kerak bo'lganlar\n`,
  ];

  dueSoon.forEach((r, i) => {
    const schedule = getPaymentSchedule(r.paymentDueDate);
    const status = schedule
      ? formatScheduleStatus(schedule)
      : formatDebtStatus(r);
    lines.push(
      `${i + 1}. <b>${r.fullName}</b> — ${r.room}`,
      `   📱 ${r.phone}`,
      `   📆 Har oyning <b>${r.paymentDayOfMonth}</b>-kuni to'lov`,
      `   ⏰ ${status}${schedule ? ` (${schedule.nextDueDate})` : ""}`,
      ""
    );
  });

  return lines.join("\n").trim();
}

export function buildAdminSummaryMessage(rows: AdminTenantRow[]) {
  const debtors = rows
    .filter((r) => r.hasDebt)
    .sort((a, b) => b.debtAmount - a.debtAmount);
  const dueSoon = rows.filter((r) => r.isDueSoon);
  const totalDebt = debtors.reduce((s, r) => s + r.debtAmount, 0);

  const lines = [
    "📊 <b>ArendaAi — Admin hisobot</b>",
    `🕐 ${formatTashkentClock()}`,
    "",
    `👥 Faol arendatorlar: <b>${rows.length}</b> ta`,
    `⚠️ Qarzdorlar: <b>${debtors.length}</b> ta`,
    `💰 Jami qarz: <b>${formatUzs(totalDebt)}</b>`,
    `📅 ${DUE_SOON_WINDOW} kun ichida to'lov: <b>${dueSoon.length}</b> ta`,
  ];

  if (debtors.length > 0) {
    lines.push("\n<b>Qarzdorlar (sayt bilan bir xil):</b>");
    debtors.slice(0, 15).forEach((r, i) => {
      lines.push(
        `${i + 1}. ${r.fullName} (${r.room}) — ${formatDebtStatus(r)}`
      );
    });
    if (debtors.length > 15) {
      lines.push(`… va yana ${debtors.length - 15} ta`);
    }
  } else {
    lines.push("\n✅ Hozircha qarzdor yo'q.");
  }

  return lines.join("\n");
}

export async function sendAdminMessage(chatId: string, text: string) {
  const chunks = chunkLines(text.split("\n"));
  for (const chunk of chunks) {
    await sendTelegramMessage(chatId, chunk, {
      reply_markup: ADMIN_MENU_KEYBOARD,
    });
  }
}

export const ADMIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: "📋 Arendatorlar" }, { text: "⚠️ Qarzdorlar" }],
    [{ text: "📅 To'lov muddati yaqin kelganlar" }],
    [{ text: "📊 Umumiy hisobot" }],
    [{ text: "🚪 Chiqish" }],
  ],
  resize_keyboard: true,
};

export async function sendAdminReportsToAll(slotLabel?: string) {
  const devices = await prisma.telegramAdminDevice.findMany({
    where: {
      user: { isActive: true, role: { in: OWNER_ROLES } },
    },
    select: { chatId: true },
  });

  const chatIds = [...new Set(devices.map((d) => d.chatId))];

  if (chatIds.length === 0) {
    const legacyOwners = await prisma.user.findMany({
      where: {
        telegramAdminChatId: { not: null },
        isActive: true,
        role: { in: OWNER_ROLES },
      },
      select: { telegramAdminChatId: true },
    });
    for (const o of legacyOwners) {
      if (o.telegramAdminChatId) chatIds.push(o.telegramAdminChatId);
    }
  }

  if (chatIds.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  const rows = await getAdminDashboardRows();
  const prefix = slotLabel ? `${slotLabel}\n\n` : "";
  const text = prefix + buildAdminSummaryMessage(rows);

  let sent = 0;
  let skipped = 0;
  for (const chatId of chatIds) {
    try {
      await sendAdminMessage(chatId, text);
      sent += 1;
    } catch {
      skipped += 1;
    }
  }
  return { sent, skipped };
}

/** Eslatma uchun — sayt qarzdorlari bilan bir xil */
export async function getAdminDebtReminderRows(): Promise<DebtReminderInput[]> {
  const rows = await getAdminDashboardRows();
  return rows
    .filter((r) => r.hasDebt)
    .map((r) => ({
      contractId: r.id,
      tenantId: r.id,
      tenantName: r.fullName,
      propertyName: r.room,
      debt: r.debtAmount,
      overdueDays: r.overdueDays,
      monthsDue: r.monthsDue,
    }));
}
