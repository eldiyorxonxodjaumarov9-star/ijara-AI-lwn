import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { getCollectionApi } from "@/lib/data/store";
import { syncLocalClientsFromTenants } from "@/lib/tenant-client-sync";
import type { Client } from "@/types";

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export async function recordClientLead(
  fullName: string,
  phone: string,
  tenantId?: string
) {
  const trimmedName = fullName.trim();
  const trimmedPhone = phone.trim();
  const normName = trimmedName.toLowerCase();
  const normPhone = normalizePhone(trimmedPhone);
  const now = new Date().toISOString();

  if (isApiConfigured) {
    await apiFetch("/clients/lead", {
      method: "POST",
      auth: false,
      body: { fullName: trimmedName, phone: trimmedPhone, tenantId },
    });
    return tenantId ?? trimmedPhone;
  }

  const api = getCollectionApi<Client>("clients");
  const list = await api.list();
  const existing = list.find(
    (c) =>
      c.fullName.trim().toLowerCase() === normName &&
      normalizePhone(c.phone) === normPhone
  );

  if (existing) {
    await api.update(existing.id, {
      lastLoginAt: now,
      loginCount: (existing.loginCount ?? 1) + 1,
      tenantId: tenantId ?? existing.tenantId,
      status: tenantId ? "matched" : existing.status,
    });
    return existing.id;
  }

  return api.create({
    fullName: trimmedName,
    phone: trimmedPhone,
    status: tenantId ? "matched" : "new",
    tenantId,
    loginCount: 1,
    firstLoginAt: now,
    lastLoginAt: now,
  });
}

export async function syncClientsFromTenants() {
  if (!isApiConfigured) {
    await syncLocalClientsFromTenants();
    return 0;
  }
  const res = await apiFetch<{ synced: number }>("/clients", {
    method: "PUT",
  });
  return res.synced ?? 0;
}
