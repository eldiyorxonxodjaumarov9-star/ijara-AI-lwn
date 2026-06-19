import type { Prisma } from "@prisma/client";

function parseDate(value: unknown) {
  if (value == null || String(value).trim() === "") return undefined;
  return new Date(String(value));
}

export function mapTenantBody(body: Record<string, unknown>) {
  const emailRaw = body.email != null ? String(body.email).trim() : "";
  const data: Prisma.TenantUpdateInput = {
    ...(body.fullName != null ? { fullName: String(body.fullName) } : {}),
    ...(body.phone != null ? { phone: String(body.phone) } : {}),
    ...(body.passport != null ? { passport: String(body.passport) } : {}),
    ...(body.telegram != null
      ? { telegram: String(body.telegram).trim() || null }
      : {}),
    ...(body.email !== undefined
      ? { email: emailRaw === "" ? null : emailRaw }
      : {}),
    ...(body.address != null
      ? { address: String(body.address).trim() || null }
      : {}),
    ...(body.rentAmount != null
      ? { rentAmount: Number(body.rentAmount) }
      : {}),
    ...(body.contractDuration != null
      ? { contractDuration: Number(body.contractDuration) || null }
      : {}),
    ...(body.entryDate != null
      ? { entryDate: parseDate(body.entryDate) ?? null }
      : {}),
    ...(body.paymentDueDate != null
      ? { paymentDueDate: parseDate(body.paymentDueDate) ?? null }
      : {}),
  };
  return data;
}

export function mapTenantCreate(body: Record<string, unknown>) {
  const emailRaw = body.email != null ? String(body.email).trim() : "";
  return {
    fullName: String(body.fullName ?? ""),
    phone: String(body.phone ?? ""),
    passport: String(body.passport ?? ""),
    telegram: body.telegram ? String(body.telegram).trim() || undefined : undefined,
    email: emailRaw === "" ? undefined : emailRaw,
    address: body.address ? String(body.address).trim() || undefined : undefined,
    rentAmount: Number(body.rentAmount ?? 0),
    contractDuration:
      body.contractDuration != null
        ? Number(body.contractDuration) || undefined
        : undefined,
    entryDate: parseDate(body.entryDate),
    paymentDueDate: parseDate(body.paymentDueDate),
  };
}
