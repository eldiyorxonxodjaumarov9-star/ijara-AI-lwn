import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

function parseDate(value: unknown) {
  if (value == null || String(value).trim() === "") return undefined;
  return new Date(String(value));
}

async function hashPassword(value: string) {
  return bcrypt.hash(value, 10);
}

export function stripTenantSecret<T extends { password?: string | null }>(tenant: T) {
  const { password: _password, ...rest } = tenant;
  return rest;
}

export async function mapTenantBody(body: Record<string, unknown>) {
  const emailRaw = body.email != null ? String(body.email).trim() : "";
  const data: Prisma.TenantUpdateInput = {
    ...(body.fullName != null ? { fullName: String(body.fullName) } : {}),
    ...(body.phone != null ? { phone: String(body.phone) } : {}),
    ...(body.passport != null ? { passport: String(body.passport) } : {}),
    ...(body.login != null
      ? { login: String(body.login).trim() || null }
      : {}),
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
    ...(body.depositPaid != null
      ? { depositPaid: Boolean(body.depositPaid) }
      : {}),
    ...(body.depositAmount != null
      ? { depositAmount: Number(body.depositAmount) }
      : {}),
  };

  if (body.password != null && String(body.password).trim() !== "") {
    data.password = await hashPassword(String(body.password));
  }

  return data;
}

export async function mapTenantCreate(body: Record<string, unknown>) {
  const emailRaw = body.email != null ? String(body.email).trim() : "";
  const passwordRaw = body.password != null ? String(body.password) : "";

  return {
    fullName: String(body.fullName ?? ""),
    phone: String(body.phone ?? ""),
    passport: String(body.passport ?? ""),
    login: String(body.login ?? "").trim() || undefined,
    password: passwordRaw ? await hashPassword(passwordRaw) : undefined,
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
    depositPaid: Boolean(body.depositPaid ?? false),
    depositAmount: Number(body.depositAmount ?? 0),
  };
}
