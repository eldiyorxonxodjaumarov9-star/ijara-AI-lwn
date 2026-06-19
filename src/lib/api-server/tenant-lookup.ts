import bcrypt from "bcryptjs";

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export interface TenantRecord {
  id: string;
  fullName: string;
  phone: string;
  login?: string | null;
  password?: string | null;
}

export function findTenantByCredentials<
  T extends TenantRecord,
>(tenants: T[], fullName: string, phone: string): T | undefined {
  const wantedName = fullName.trim().toLowerCase();
  const wantedPhone = normalizePhone(phone);
  return tenants.find(
    (t) =>
      t.fullName.trim().toLowerCase() === wantedName &&
      normalizePhone(t.phone) === wantedPhone
  );
}

export async function findTenantByLogin<
  T extends TenantRecord,
>(tenants: T[], login: string, password: string): Promise<T | undefined> {
  const wantedLogin = login.trim().toLowerCase();
  if (!wantedLogin || !password) return undefined;

  for (const tenant of tenants) {
    if (!tenant.login || tenant.login.trim().toLowerCase() !== wantedLogin) {
      continue;
    }
    if (!tenant.password) continue;
    const match = await bcrypt.compare(password, tenant.password);
    if (match) return tenant;
  }

  return undefined;
}
