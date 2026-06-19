import { prisma } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  groupDebtsByTenant,
  type DebtReminderInput,
} from "@/lib/payment-reminder-utils";

export type { DebtReminderInput };
export { buildPaymentReminderMessage, groupDebtsByTenant };

export async function sendPaymentReminders(
  debts: DebtReminderInput[],
  adminUserId?: string
) {
  const grouped = groupDebtsByTenant(debts);
  const results = [];

  for (const debt of grouped) {
    const message = buildPaymentReminderMessage(debt);
    const created = await prisma.notification.create({
      data: {
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
        },
      },
    });
    results.push(created);
  }

  if (results.length > 0 && adminUserId) {
    const summary = await prisma.notification.create({
      data: {
        userId: adminUserId,
        title: "To'lov eslatmalari yuborildi",
        message: `${results.length} ta arendatorga to'lov qilish bo'yicha eslatma yuborildi.`,
        type: "INFO",
        meta: { sentCount: results.length },
      },
    });
    results.unshift(summary);
  }

  return results;
}

export async function getTenantNotifications(tenantId: string) {
  const rows = await prisma.notification.findMany({
    where: { type: "LATE_PAYMENT" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.filter((n) => {
    const meta = n.meta as { tenantId?: string | null } | null;
    return meta?.tenantId === tenantId;
  });
}
