import { prisma } from "@/lib/api-server/prisma";

const DEDUPE_WINDOW_MS = 45_000;

/**
 * Bir xil to'lov 45 soniya ichida qayta yuborilsa — yangi yozuv yaratmaydi.
 * (Ikki marta bosish / tarmoq qayta urinishi)
 */
export async function findRecentDuplicatePayment(input: {
  contractId: string;
  amount: number;
  paymentDate: Date;
  periodYear?: number;
  periodMonth?: number;
  paymentMethod?: string;
}) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);

  return prisma.payment.findFirst({
    where: {
      contractId: input.contractId,
      amount: input.amount,
      createdAt: { gte: since },
      ...(input.periodYear != null ? { periodYear: input.periodYear } : {}),
      ...(input.periodMonth != null ? { periodMonth: input.periodMonth } : {}),
      ...(input.paymentMethod
        ? { paymentMethod: input.paymentMethod as never }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      contract: { include: { property: true, tenant: true } },
    },
  });
}
