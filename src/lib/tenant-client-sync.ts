import { getCollectionApi } from "@/lib/data/store";
import type { Client, Tenant } from "@/types";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function deleteTenantWithLinkedClients(tenantId: string) {
  const tenantApi = getCollectionApi<Tenant>("tenants");
  const clientApi = getCollectionApi<Client>("clients");
  const clients = await clientApi.list();
  await Promise.all(
    clients
      .filter((c) => c.tenantId === tenantId)
      .map((c) => clientApi.remove(c.id))
  );
  await tenantApi.remove(tenantId);
}

export async function deleteClientWithLinkedTenant(clientId: string) {
  const tenantApi = getCollectionApi<Tenant>("tenants");
  const clientApi = getCollectionApi<Client>("clients");
  const client = (await clientApi.list()).find((c) => c.id === clientId);
  if (!client) return;

  if (client.tenantId) {
    const tenantId = client.tenantId;
    const clients = await clientApi.list();
    await Promise.all(
      clients
        .filter((c) => c.tenantId === tenantId)
        .map((c) => clientApi.remove(c.id))
    );
    await tenantApi.remove(tenantId);
    return;
  }

  await clientApi.remove(clientId);
}

export async function syncLocalClientsFromTenants() {
  const tenantApi = getCollectionApi<Tenant>("tenants");
  const clientApi = getCollectionApi<Client>("clients");
  const tenants = await tenantApi.list();
  const clients = await clientApi.list();
  const tenantIds = new Set(tenants.map((t) => t.id));
  const now = new Date().toISOString();

  for (const tenant of tenants) {
    const existing = clients.find(
      (c) =>
        c.tenantId === tenant.id ||
        (c.fullName.trim().toLowerCase() === tenant.fullName.trim().toLowerCase() &&
          normalizePhone(c.phone) === normalizePhone(tenant.phone))
    );
    if (existing) {
      await clientApi.update(existing.id, {
        fullName: tenant.fullName,
        phone: tenant.phone,
        tenantId: tenant.id,
        status: "matched",
      });
    } else {
      await clientApi.create({
        fullName: tenant.fullName,
        phone: tenant.phone,
        tenantId: tenant.id,
        status: "matched",
        loginCount: 1,
        firstLoginAt: now,
        lastLoginAt: now,
      });
    }
  }

  for (const client of clients) {
    if (client.tenantId && !tenantIds.has(client.tenantId)) {
      await clientApi.remove(client.id);
      continue;
    }
    if (!client.tenantId && client.status === "matched") {
      const match = tenants.find(
        (t) =>
          t.fullName.trim().toLowerCase() === client.fullName.trim().toLowerCase() &&
          normalizePhone(t.phone) === normalizePhone(client.phone)
      );
      if (!match) {
        await clientApi.remove(client.id);
      }
    }
  }
}

export async function upsertLocalClientFromTenant(tenant: Tenant) {
  const clientApi = getCollectionApi<Client>("clients");
  const clients = await clientApi.list();
  const now = new Date().toISOString();
  const existing = clients.find(
    (c) =>
      c.tenantId === tenant.id ||
      (c.fullName.trim().toLowerCase() === tenant.fullName.trim().toLowerCase() &&
        normalizePhone(c.phone) === normalizePhone(tenant.phone))
  );

  if (existing) {
    await clientApi.update(existing.id, {
      fullName: tenant.fullName,
      phone: tenant.phone,
      tenantId: tenant.id,
      status: "matched",
    });
    return existing.id;
  }

  return clientApi.create({
    fullName: tenant.fullName,
    phone: tenant.phone,
    tenantId: tenant.id,
    status: "matched",
    loginCount: 1,
    firstLoginAt: now,
    lastLoginAt: now,
  });
}
