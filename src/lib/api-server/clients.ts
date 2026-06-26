import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function mapClientCreate(body: Record<string, unknown>) {
  const now = new Date();
  return {
    fullName: String(body.fullName ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    status: (body.status as Prisma.ClientCreateInput["status"]) ?? "NEW",
    tenantId: body.tenantId ? String(body.tenantId) : undefined,
    loginCount: Number(body.loginCount ?? 1),
    firstLoginAt: body.firstLoginAt ? new Date(String(body.firstLoginAt)) : now,
    lastLoginAt: body.lastLoginAt ? new Date(String(body.lastLoginAt)) : now,
  };
}

export function mapClientUpdate(body: Record<string, unknown>) {
  const data: Prisma.ClientUpdateInput = {};
  if (body.fullName != null) data.fullName = String(body.fullName).trim();
  if (body.phone != null) data.phone = String(body.phone).trim();
  if (body.status != null) {
    data.status = body.status as Prisma.ClientUpdateInput["status"];
  }
  if (body.tenantId !== undefined) {
    data.tenant = body.tenantId
      ? { connect: { id: String(body.tenantId) } }
      : { disconnect: true };
  }
  if (body.loginCount != null) data.loginCount = Number(body.loginCount);
  if (body.lastLoginAt != null) data.lastLoginAt = new Date(String(body.lastLoginAt));
  if (body.depositPaid != null) data.depositPaid = Boolean(body.depositPaid);
  if (body.depositAmount != null) data.depositAmount = Number(body.depositAmount);
  return data;
}

export async function upsertClientLead(input: {
  fullName: string;
  phone: string;
  tenantId?: string;
}) {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const normPhone = normalizePhone(phone);
  const now = new Date();

  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        ...(input.tenantId ? [{ tenantId: input.tenantId }] : []),
        {
          AND: [
            { fullName: { equals: fullName, mode: "insensitive" } },
            { phone: { contains: normPhone.slice(-9) } },
          ],
        },
      ],
    },
  });

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        fullName,
        phone,
        lastLoginAt: now,
        loginCount: existing.loginCount + 1,
        tenantId: input.tenantId ?? existing.tenantId,
        status: input.tenantId ? "MATCHED" : existing.status,
      },
    });
  }

  return prisma.client.create({
    data: {
      fullName,
      phone,
      status: input.tenantId ? "MATCHED" : "NEW",
      tenantId: input.tenantId,
      loginCount: 1,
      firstLoginAt: now,
      lastLoginAt: now,
    },
  });
}

export async function upsertClientFromTenant(tenant: {
  id: string;
  fullName: string;
  phone: string;
  depositPaid?: boolean;
  depositAmount?: number;
}) {
  const row = await upsertClientLead({
    fullName: tenant.fullName,
    phone: tenant.phone,
    tenantId: tenant.id,
  });
  if (tenant.depositPaid != null || tenant.depositAmount != null) {
    return prisma.client.update({
      where: { id: row.id },
      data: {
        depositPaid: tenant.depositPaid ?? false,
        depositAmount: tenant.depositAmount ?? 0,
      },
    });
  }
  return row;
}

export async function deleteClientsByTenantId(tenantId: string) {
  return prisma.client.deleteMany({ where: { tenantId } });
}

export async function deleteTenantAndClientsForClient(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { deletedClient: false, deletedTenant: false };

  if (client.tenantId) {
    await deleteClientsByTenantId(client.tenantId);
    await prisma.tenant.delete({ where: { id: client.tenantId } });
    return { deletedClient: true, deletedTenant: true };
  }

  await prisma.client.delete({ where: { id: clientId } });
  return { deletedClient: true, deletedTenant: false };
}

export async function deleteTenantAndLinkedClients(tenantId: string) {
  await deleteClientsByTenantId(tenantId);
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export async function syncClientsFromTenants() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const tenantIds = new Set(tenants.map((t) => t.id));
  const results = [];

  for (const tenant of tenants) {
    results.push(await upsertClientFromTenant(tenant));
  }

  if (tenantIds.size > 0) {
    await prisma.client.deleteMany({
      where: { tenantId: { notIn: [...tenantIds] } },
    });
  } else {
    await prisma.client.deleteMany({ where: { tenantId: { not: null } } });
  }

  const staleClients = await prisma.client.findMany({
    where: { tenantId: null, status: "MATCHED" },
  });
  for (const client of staleClients) {
    const stillTenant = tenants.find(
      (t) =>
        t.fullName.trim().toLowerCase() === client.fullName.trim().toLowerCase() &&
        normalizePhone(t.phone) === normalizePhone(client.phone)
    );
    if (!stillTenant) {
      await prisma.client.delete({ where: { id: client.id } });
    }
  }

  return results;
}
