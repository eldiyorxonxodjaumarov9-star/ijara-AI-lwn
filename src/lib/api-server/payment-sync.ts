import type { Contract } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";

const AUTO_NOTE = "Shartnomadan avtomatik";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export async function upsertPaymentFromContract(contract: Contract) {
  const amount = contract.monthlyRent ?? 0;
  if (amount <= 0) return null;
  if (contract.status !== "ACTIVE") return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const existing = await prisma.payment.findFirst({
    where: {
      contractId: contract.id,
      paymentDate: { gte: monthStart, lte: monthEnd },
    },
  });

  if (existing) {
    return prisma.payment.update({
      where: { id: existing.id },
      data: { amount, notes: AUTO_NOTE },
      include: { contract: { include: { property: true, tenant: true } } },
    });
  }

  return prisma.payment.create({
    data: {
      contractId: contract.id,
      amount,
      paymentDate: now,
      paymentMethod: "CASH",
      notes: AUTO_NOTE,
    },
    include: { contract: { include: { property: true, tenant: true } } },
  });
}

export async function syncPaymentsFromContracts() {
  const contracts = await prisma.contract.findMany({
    where: { status: "ACTIVE", monthlyRent: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });
  const results = [];
  for (const contract of contracts) {
    const payment = await upsertPaymentFromContract(contract);
    if (payment) results.push(payment);
  }
  return results;
}

export { monthKey, AUTO_NOTE };
