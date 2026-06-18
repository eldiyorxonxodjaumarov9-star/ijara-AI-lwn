import { getCollectionApi } from "@/lib/data/store";
import type { Client } from "@/types";

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export async function recordClientLead(
  fullName: string,
  phone: string,
  tenantId?: string
) {
  const api = getCollectionApi<Client>("clients");
  const trimmedName = fullName.trim();
  const trimmedPhone = phone.trim();
  const normName = trimmedName.toLowerCase();
  const normPhone = normalizePhone(trimmedPhone);
  const now = new Date().toISOString();

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
