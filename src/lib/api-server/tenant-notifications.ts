import { prisma } from "@/lib/api-server/prisma";
import { formatUzs } from "@/lib/payment-reminder-utils";

const TENANT_TYPES = ["LATE_PAYMENT", "SUCCESS", "WARNING", "INFO"] as const;

export type TenantNotificationType = (typeof TENANT_TYPES)[number];

export async function createTenantNotification(input: {
  tenantId: string;
  title: string;
  message: string;
  type: TenantNotificationType;
  meta?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      title: input.title,
      message: input.message,
      type: input.type,
      meta: {
        tenantId: input.tenantId,
        ...input.meta,
      },
    },
  });
}

export function buildPaymentReceivedMessage(
  tenantName: string,
  propertyName: string,
  amount: number
) {
  return `Assalomu alaykum, ${tenantName}! ${propertyName} bo'yicha ${formatUzs(amount)} to'lovingiz qabul qilindi. Rahmat! — ArendaAi`;
}

export async function notifyTenantPaymentReceived(payment: {
  id: string;
  amount: number;
  contract: {
    id: string;
    tenantId: string;
    tenant: { fullName: string };
    property: { title: string };
  };
}) {
  const { contract } = payment;
  return createTenantNotification({
    tenantId: contract.tenantId,
    title: "To'lov qabul qilindi",
    message: buildPaymentReceivedMessage(
      contract.tenant.fullName,
      contract.property.title,
      payment.amount
    ),
    type: "SUCCESS",
    meta: {
      paymentId: payment.id,
      contractId: contract.id,
      amount: payment.amount,
    },
  });
}

export async function getTenantNotifications(tenantId: string) {
  const rows = await prisma.notification.findMany({
    where: { type: { in: [...TENANT_TYPES] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.filter((n) => {
    const meta = n.meta as { tenantId?: string | null } | null;
    return meta?.tenantId === tenantId;
  });
}
