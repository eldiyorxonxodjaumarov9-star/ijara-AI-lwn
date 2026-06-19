export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export interface TenantRecord {
  id: string;
  fullName: string;
  phone: string;
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
