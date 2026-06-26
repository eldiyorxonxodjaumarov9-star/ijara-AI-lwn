import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { computeServerDebts } from "@/lib/api-server/telegram-reminders";
import { sendTelegramMessage } from "@/lib/api-server/telegram-bot";
import {
  DUE_SOON_WINDOW,
  formatScheduleStatus,
  formatTashkentDateTime,
  getPaymentDayOfMonth,
  getPaymentSchedule,
} from "@/lib/payment-due-schedule";

const OWNER_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

function formatDateUz(value?: Date | null) {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

export function daysUntilPayment(dueDate?: Date | null) {
  const schedule = getPaymentSchedule(dueDate);
  if (!schedule) return null;
  if (schedule.overdueDays > 0) return -schedule.overdueDays;
  return schedule.daysLeft;
}

function formatDaysLeft(days: number | null) {
  if (days === null) return "To'lov muddati kiritilmagan";
  if (days < 0) return `Muddati o'tgan (${Math.abs(days)} kun)`;
  if (days === 0) return "Bugun to'lov kuni";
  return `To'lovga ${days} kun qoldi`;
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
  hasDebt: boolean;
  isDueSoon: boolean;
};

export async function getAdminDashboardRows(): Promise<AdminTenantRow[]> {
  const tenants = await prisma.tenant.findMany({
    orderBy: { fullName: "asc" },
    include: {
      contracts: {
        where: { status: { in: ["ACTIVE", "PENDING"] } },
        include: { property: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const debts = await computeServerDebts();
  const debtTenantIds = new Set(
    debts.filter((d) => d.tenantId).map((d) => d.tenantId as string)
  );

  return tenants.map((t) => {
    const schedule = getPaymentSchedule(t.paymentDueDate);
    return {
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      room: t.contracts[0]?.property.title ?? "—",
      paymentDueDate: t.paymentDueDate,
      paymentDayOfMonth: t.paymentDueDate
        ? getPaymentDayOfMonth(t.paymentDueDate)
        : null,
      daysLeft: schedule
        ? schedule.overdueDays > 0
          ? -schedule.overdueDays
          : schedule.daysLeft
        : null,
      overdueDays: schedule?.overdueDays ?? 0,
      hasDebt: debtTenantIds.has(t.id),
      isDueSoon: schedule?.isDueSoon ?? false,
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
    return "📋 <b>Arendatorlar</b>\n\nHozircha arendator yo'q.";
  }
  const lines = [`📋 <b>Arendatorlar</b> (${rows.length} ta)\n`];
  rows.forEach((r, i) => {
    lines.push(
      `${i + 1}. <b>${r.fullName}</b> — ${r.room}`,
      `   📱 ${r.phone}`,
      `   ⏰ ${formatDaysLeft(r.daysLeft)} (${formatDateUz(r.paymentDueDate)})`,
      r.hasDebt ? "   ⚠️ Qarzdor" : "   ✅ Qarzsiz",
      ""
    );
  });
  return lines.join("\n").trim();
}

export function buildAdminDebtorsMessage(rows: AdminTenantRow[]) {
  const debtors = rows.filter((r) => r.hasDebt);
  if (debtors.length === 0) {
    return "✅ <b>Qarzdorlar</b>\n\nHozircha qarzdor arendator yo'q.";
  }
  const lines = [`⚠️ <b>Qarzdorlar</b> (${debtors.length} ta)\n`];
  debtors.forEach((r, i) => {
    lines.push(
      `${i + 1}. <b>${r.fullName}</b> — ${r.room}`,
      `   ⏰ ${formatDaysLeft(r.daysLeft)}`,
      ""
    );
  });
  return lines.join("\n").trim();
}

export function buildAdminDueSoonMessage(rows: AdminTenantRow[]) {
  const today = formatTashkentDateTime();
  const dueSoon = rows
    .filter((r) => r.isDueSoon && r.paymentDayOfMonth !== null)
    .sort((a, b) => {
      const aSort = a.overdueDays > 0 ? -a.overdueDays : (a.daysLeft ?? 99);
      const bSort = b.overdueDays > 0 ? -b.overdueDays : (b.daysLeft ?? 99);
      return aSort - bSort;
    });

  if (dueSoon.length === 0) {
    return (
      `📅 <b>To'lov muddati yaqin kelganlar</b>\n` +
      `🕐 Toshkent: ${today}\n\n` +
      `Keyingi ${DUE_SOON_WINDOW} kun ichida to'lov muddati yaqinlashgan arendator yo'q.`
    );
  }

  const lines = [
    `📅 <b>To'lov muddati yaqin kelganlar</b> (${dueSoon.length} ta)`,
    `🕐 Toshkent: ${today}`,
    `📆 Sana oyning kuni bo'yicha avtomatik hisoblanadi\n`,
  ];

  dueSoon.forEach((r, i) => {
    const schedule = getPaymentSchedule(r.paymentDueDate);
    const status = schedule ? formatScheduleStatus(schedule) : formatDaysLeft(r.daysLeft);
    lines.push(
      `${i + 1}. <b>${r.fullName}</b> — ${r.room}`,
      `   📱 ${r.phone}`,
      `   📆 Har oyning <b>${r.paymentDayOfMonth}</b>-kuni to'lov`,
      `   ⏰ ${status}${schedule ? ` (${schedule.nextDueDate})` : ""}`,
      r.hasDebt ? "   ⚠️ Qarzdor" : "",
      ""
    );
  });

  return lines.join("\n").trim();
}

export function buildAdminSummaryMessage(rows: AdminTenantRow[]) {
  const debtors = rows.filter((r) => r.hasDebt);
  const dueSoon = rows.filter((r) => r.isDueSoon);
  const overdue = rows.filter((r) => r.daysLeft !== null && r.daysLeft < 0);

  const lines = [
    "📊 <b>ArendaAi — Admin hisobot</b>\n",
    `👥 Arendatorlar: <b>${rows.length}</b> ta`,
    `⚠️ Qarzdorlar: <b>${debtors.length}</b> ta`,
    `📅 7 kun ichida to'lov: <b>${dueSoon.length}</b> ta`,
    `🔴 Muddati o'tgan: <b>${overdue.length}</b> ta`,
  ];

  if (debtors.length > 0) {
    lines.push("\n<b>Qarzdorlar:</b>");
    debtors.slice(0, 15).forEach((r, i) => {
      lines.push(`${i + 1}. ${r.fullName} (${r.room}) — ${formatDaysLeft(r.daysLeft)}`);
    });
    if (debtors.length > 15) {
      lines.push(`… va yana ${debtors.length - 15} ta`);
    }
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
