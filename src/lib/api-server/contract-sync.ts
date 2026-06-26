import type { Tenant } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function defaultPropertyId() {
  const property = await prisma.property.findFirst({
    orderBy: { createdAt: "asc" },
  });
  return property?.id ?? null;
}

export async function upsertContractFromTenant(tenant: Tenant) {
  const propertyId = await defaultPropertyId();
  if (!propertyId) return null;

  const durationMonths =
    tenant.contractDuration && tenant.contractDuration > 0
      ? tenant.contractDuration
      : 12;
  const startDate = tenant.entryDate
    ? new Date(tenant.entryDate)
    : new Date(tenant.createdAt);
  const endDate = addMonths(startDate, durationMonths);
  const monthlyRent = tenant.rentAmount ?? 0;

  const existing = await prisma.contract.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  const notes = `Arendatordan avtomatik (${durationMonths} oy)`;

  if (existing) {
    const startDate = tenant.entryDate
      ? new Date(tenant.entryDate)
      : new Date(existing.startDate);
    return prisma.contract.update({
      where: { id: existing.id },
      data: {
        propertyId,
        monthlyRent,
        deposit: tenant.depositAmount ?? 0,
        depositPaid: tenant.depositPaid ?? false,
        startDate,
        endDate: addMonths(startDate, durationMonths),
        status: monthlyRent > 0 ? "ACTIVE" : existing.status,
        notes,
      },
      include: { property: true, tenant: true },
    });
  }

  return prisma.contract.create({
    data: {
      propertyId,
      tenantId: tenant.id,
      startDate,
      endDate,
      monthlyRent,
      deposit: tenant.depositAmount ?? 0,
      depositPaid: tenant.depositPaid ?? false,
      status: "ACTIVE",
      notes,
    },
    include: { property: true, tenant: true },
  });
}

export async function syncContractsFromTenants() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const results = [];
  for (const tenant of tenants) {
    const contract = await upsertContractFromTenant(tenant);
    if (contract) results.push(contract);
  }
  return results;
}
