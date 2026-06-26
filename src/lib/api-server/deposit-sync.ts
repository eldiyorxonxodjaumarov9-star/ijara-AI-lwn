import { prisma } from "@/lib/api-server/prisma";

/** Klient/arendator depozitini shartnomaga ham yozish */
export async function syncDepositForTenant(
  tenantId: string,
  depositPaid: boolean,
  depositAmount: number
) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { depositPaid, depositAmount },
  });

  await prisma.contract.updateMany({
    where: {
      tenantId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    data: { deposit: depositAmount, depositPaid },
  });

  await prisma.client.updateMany({
    where: { tenantId },
    data: { depositPaid, depositAmount },
  });
}

export async function syncDepositFromClient(
  clientId: string,
  depositPaid: boolean,
  depositAmount: number
) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  await prisma.client.update({
    where: { id: clientId },
    data: { depositPaid, depositAmount },
  });

  if (client.tenantId) {
    await syncDepositForTenant(client.tenantId, depositPaid, depositAmount);
  }
}
