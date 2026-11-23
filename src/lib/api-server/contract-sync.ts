import type { Contract, ContractStatus, Tenant } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";

const TERMINAL_STATUSES: ContractStatus[] = ["TERMINATED", "EXPIRED"];
const OPEN_STATUSES: ContractStatus[] = ["ACTIVE", "PENDING"];

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export type UpsertContractFromTenantOptions = {
  /** Explicit room — never invent a default (e.g. G1). Required to create. */
  propertyId?: string;
};

export type ContractSyncResult = Contract & {
  property: { id: string; title: string; status: string } | null;
  tenant: Tenant;
};

/**
 * Tenant ↔ contract sync (safe):
 * - leftAt tenants are skipped (no create, no reopen)
 * - TERMINATED/EXPIRED never re-activated
 * - never invents a fallback room when propertyId is omitted
 * - creates only with explicit propertyId in the same workspace
 * - rejects a second open contract on an already-occupied room
 */
export async function upsertContractFromTenant(
  tenant: Tenant,
  options: UpsertContractFromTenantOptions = {}
): Promise<ContractSyncResult | null> {
  const workspaceId = tenant.workspaceId;
  if (!workspaceId) return null;
  if (tenant.leftAt) return null;

  const durationMonths =
    tenant.contractDuration && tenant.contractDuration > 0
      ? tenant.contractDuration
      : 12;
  const monthlyRent = tenant.rentAmount ?? 0;
  const notes = `Arendatordan avtomatik (${durationMonths} oy)`;

  const existing = await prisma.contract.findFirst({
    where: { tenantId: tenant.id, workspaceId },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (TERMINAL_STATUSES.includes(existing.status)) {
      return prisma.contract.findUniqueOrThrow({
        where: { id: existing.id },
        include: { property: true, tenant: true },
      });
    }

    // startDate locked — payment history periods stay intact
    const lockedStart = new Date(existing.startDate);
    return prisma.contract.update({
      where: { id: existing.id },
      data: {
        monthlyRent,
        deposit: tenant.depositAmount ?? 0,
        depositPaid: tenant.depositPaid ?? false,
        endDate: addMonths(lockedStart, durationMonths),
        // Never force ACTIVE; keep PENDING/ACTIVE as-is
        notes,
      },
      include: { property: true, tenant: true },
    });
  }

  const propertyId = options.propertyId;
  if (!propertyId) {
    // No silent G1 / first-property assignment
    return null;
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, workspaceId },
    select: { id: true },
  });
  if (!property) return null;

  const conflicting = await prisma.contract.findFirst({
    where: {
      workspaceId,
      propertyId,
      status: { in: OPEN_STATUSES },
      tenantId: { not: tenant.id },
    },
    select: { id: true },
  });
  if (conflicting) return null;

  const startDate = tenant.entryDate
    ? new Date(tenant.entryDate)
    : new Date(tenant.createdAt);
  const endDate = addMonths(startDate, durationMonths);

  return prisma.contract.create({
    data: {
      workspaceId,
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

/**
 * Workspace-scoped sync: only non-departed tenants; never invents rooms.
 * Creates nothing unless a prior path passed propertyId (this bulk path does not).
 */
export async function syncContractsFromTenants(workspaceId: string) {
  if (!workspaceId) return [];

  const tenants = await prisma.tenant.findMany({
    where: { workspaceId, leftAt: null },
    orderBy: { createdAt: "desc" },
  });

  const results: ContractSyncResult[] = [];
  for (const tenant of tenants) {
    const contract = await upsertContractFromTenant(tenant);
    if (contract) results.push(contract);
  }
  return results;
}
