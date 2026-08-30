import { ensureTenantClientNumber } from "@/lib/api-server/client-number";
import { prisma } from "@/lib/api-server/prisma";

/** Chiqishda yopiladigan shartnoma holatlari (to'lovlar saqlanadi). */
const OPEN_CONTRACT_STATUSES = ["ACTIVE", "PENDING", "EXPIRED"] as const;

export async function checkoutTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error("Arendator topilmadi");
  }
  if (tenant.leftAt) {
    throw new Error("Arendator allaqachon chiqib ketgan");
  }

  const clientNumber = await ensureTenantClientNumber(tenantId);
  if (!clientNumber) {
    throw new Error("Klient raqami berilmadi");
  }

  const openContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      status: { in: [...OPEN_CONTRACT_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
    include: { property: true, payments: true },
  });

  // Arxiv snapshot uchun eng so'nggi ACTIVE/PENDING, yo'q bo'lsa EXPIRED
  const contract =
    openContracts.find((c) => c.status === "ACTIVE" || c.status === "PENDING") ??
    openContracts[0] ??
    null;

  const leaveDate = new Date();
  const totalPaid =
    contract?.payments.reduce((sum, p) => sum + (p.amount || 0), 0) ?? 0;

  const archive = await prisma.tenantArchive.create({
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

  if (openContracts.length > 0) {
    await prisma.contract.updateMany({
      where: { id: { in: openContracts.map((c) => c.id) } },
      data: { status: "TERMINATED", endDate: leaveDate },
    });

    const propertyIds = [
      ...new Set(openContracts.map((c) => c.propertyId).filter(Boolean)),
    ];
    if (propertyIds.length > 0) {
      await prisma.property.updateMany({
        where: { id: { in: propertyIds } },
        data: { status: "AVAILABLE" },
      });
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { leftAt: leaveDate },
  });

  await prisma.client.updateMany({
    where: { tenantId },
    data: { status: "ARCHIVED" },
  });

  return archive;
}
