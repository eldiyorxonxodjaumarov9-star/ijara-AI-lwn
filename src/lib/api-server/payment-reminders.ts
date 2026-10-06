import { prisma } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  groupDebtsByTenant,
  type DebtReminderInput,
} from "@/lib/payment-reminder-utils";
import { getTenantNotifications } from "@/lib/api-server/tenant-notifications";
import { sendTelegramPaymentReminders } from "@/lib/api-server/telegram-reminders";
import type { ManualDebtReminderTarget } from "@/lib/api-server/manual-debts";
import { buildManualDebtReminderMessage } from "@/lib/manual-debts";

export type { DebtReminderInput };
export { buildPaymentReminderMessage, groupDebtsByTenant, getTenantNotifications };

/** Shu workspace'dagi eski to'lov eslatmalarini tozalash (yangi yuborishdan oldin) */
export async function clearPreviousPaymentReminderNotifications(workspaceId: string) {
  await prisma.notification.deleteMany({
    where: {
      workspaceId,
      OR: [
        { type: "LATE_PAYMENT" },
        { type: "INFO", title: "To'lov eslatmalari yuborildi" },
      ],
    },
  });
}

export async function sendPaymentReminders(
  debts: DebtReminderInput[],
  opts: { workspaceId: string; adminUserId?: string; manualDebts?: ManualDebtReminderTarget[] }
) {
  const { workspaceId, adminUserId } = opts;
  const manualDebts = (opts.manualDebts ?? []).filter((m) => m.workspaceId === workspaceId);
  await clearPreviousPaymentReminderNotifications(workspaceId);

  const grouped = groupDebtsByTenant(debts);
  const results = [];

  for (const debt of grouped) {
    const message = buildPaymentReminderMessage(debt);
    const created = await prisma.notification.create({
      data: {
        workspaceId,
        userId: adminUserId ?? null,
        title: "To'lov eslatmasi",
        message,
        type: "LATE_PAYMENT",
        meta: {
          tenantId: debt.tenantId ?? null,
          contractId: debt.contractId,
          tenantName: debt.tenantName,
          propertyName: debt.propertyName,
          debt: debt.debt,
          propertyCount: debt.propertyCount,
          unpaidMonths: debt.unpaidMonths ?? null,
          oldestUnpaidDueDate: debt.oldestUnpaidDueDate ?? null,
          overdueDays: debt.overdueDays ?? null,
        },
      },
    });
    results.push(created);
  }

  for (const m of manualDebts) {
    const created = await prisma.notification.create({
      data: {
        workspaceId,
        userId: adminUserId ?? null,
        title: "To'lov eslatmasi",
        message: buildManualDebtReminderMessage([m]),
        type: "LATE_PAYMENT",
        meta: {
          manualDebtId: m.manualDebtId,
          tenantName: m.debtorName,
          propertyName: m.propertyName,
          debt: m.remainingAmount,
          debtDate: m.debtDate,
          telegramLinked: !!m.chatId,
        },
      },
    });
    results.push(created);
  }

  if (results.length > 0 && adminUserId) {
    const summary = await prisma.notification.create({
      data: {
        workspaceId,
        userId: adminUserId,
        title: "To'lov eslatmalari yuborildi",
        message: `${results.length} ta arendatorga to'lov qilish bo'yicha eslatma yuborildi.`,
        type: "INFO",
        meta: { sentCount: results.length },
      },
    });
    results.unshift(summary);
  }

  const telegram = await sendTelegramPaymentReminders(debts, undefined, manualDebts);

  return { notifications: results, telegram };
}
