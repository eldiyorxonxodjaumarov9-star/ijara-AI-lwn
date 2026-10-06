import { ensureTenantClientNumber } from "@/lib/api-server/client-number";
import { prisma } from "@/lib/api-server/prisma";
import { computeServerDebts } from "@/lib/api-server/telegram-reminders";

export class TenantCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409
  ) {
    super(message);
  }
}

export type TenantCheckoutResult = {
  archive: Awaited<ReturnType<typeof prisma.tenantArchive.create>>;
  leaveDate: string;
  closedContractIds: string[];
  releasedPropertyIds: string[];
  /** Checkoutdan keyin qolgan qarz (canonical debt calculator). */
  remainingDebt: number;
  unpaidMonths: number;
};

/**
 * Ijarachini xonadan chiqarish (workspace bo'yicha):
 * - tenant.leftAt = bugun; tenant o'chirilmaydi
 * - ACTIVE/PENDING shartnomalar TERMINATED, endDate = min(endDate, bugun)
 * - xona boshqa faol shartnomasi bo'lmasa AVAILABLE
 * - qarz tarixi saqlanadi; checkoutdan keyingi oylar hisoblanmaydi
 */
export async function checkoutTenant(
  tenantId: string,
  workspaceId: string,
  now: Date = new Date()
): Promise<TenantCheckoutResult> {
  if (!workspaceId) throw new TenantCheckoutError("Workspace topilmadi", 404);

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, workspaceId } });
  if (!tenant) {
    throw new TenantCheckoutError("Arendator topilmadi", 404);
  }
  if (tenant.leftAt) {
    throw new TenantCheckoutError("Arendator allaqachon chiqib ketgan", 409);
  }

  const clientNumber = await ensureTenantClientNumber(tenantId);
  if (!clientNumber) {
    throw new TenantCheckoutError("Klient raqami berilmadi", 400);
  }

  const openContracts = await prisma.contract.findMany({
    where: { tenantId, workspaceId, status: { in: ["ACTIVE", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    include: { property: true, payments: true },
  });
  const contract = openContracts[0];

  const leaveDate = now;
  const totalPaid =
    contract?.payments.reduce((sum, p) => sum + (p.amount || 0), 0) ?? 0;
  const closedContractIds = openContracts.map((c) => c.id);
  const propertyIds = [...new Set(openContracts.map((c) => c.propertyId))];

  const { archive, releasedPropertyIds } = await prisma.$transaction(async (tx) => {
    const archive = await tx.tenantArchive.create({
      data: {
        clientNumber,
        tenantId,
        contractId: contract?.id,
        fullName: tenant.fullName,
        phone: tenant.phone,
        passport: tenant.passport,
        propertyId: contract?.propertyId,
        propertyName: contract?.property.title ?? "—",
        entryDate: tenant.entryDate ?? contract?.startDate ?? leaveDate,
        leaveDate,
        contractStart: contract?.startDate ?? tenant.entryDate ?? leaveDate,
        contractEnd: leaveDate,
        monthlyRent: contract?.monthlyRent ?? tenant.rentAmount,
        deposit: contract?.deposit ?? tenant.depositAmount,
        depositPaid: contract?.depositPaid ?? tenant.depositPaid,
        contractDuration: tenant.contractDuration,
        totalPaid,
        paymentCount: contract?.payments.length ?? 0,
        notes: contract?.notes ?? undefined,
      },
    });

    for (const c of openContracts) {
      await tx.contract.update({
        where: { id: c.id },
        data: {
          status: "TERMINATED",
          endDate: c.endDate < leaveDate ? c.endDate : leaveDate,
        },
      });
    }

    const releasedPropertyIds: string[] = [];
    for (const propertyId of propertyIds) {
      const stillOccupied = await tx.contract.count({
        where: {
          propertyId,
          workspaceId,
          tenantId: { not: tenantId },
          status: { in: ["ACTIVE", "PENDING"] },
        },
      });
      if (stillOccupied > 0) continue;
      await tx.property.updateMany({
        where: { id: propertyId, workspaceId },
        data: { status: "AVAILABLE" },
      });
      releasedPropertyIds.push(propertyId);
    }

    await tx.tenant.update({
      where: { id: tenantId },
      data: { leftAt: leaveDate },
    });

    await tx.client.updateMany({
      where: { tenantId, workspaceId },
      data: { status: "ARCHIVED" },
    });

    return { archive, releasedPropertyIds };
  });

  const debts = await computeServerDebts({ workspaceId, tenantId, now });

  return {
    archive,
    leaveDate: leaveDate.toISOString(),
    closedContractIds,
    releasedPropertyIds,
    remainingDebt: debts.reduce((s, d) => s + d.debt, 0),
    unpaidMonths: debts.reduce((s, d) => s + (d.unpaidMonths ?? 0), 0),
  };
}
