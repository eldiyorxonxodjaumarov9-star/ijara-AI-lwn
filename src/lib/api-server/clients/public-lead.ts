import { prisma } from "@/lib/api-server/prisma";

export const LEAD_FULLNAME_MAX = 120;
export const LEAD_PHONE_MAX = 32;

export type PublicLeadInput = {
  fullName: string;
  phone: string;
};

export function parsePublicLeadBody(body: Record<string, unknown>):
  | { ok: true; data: PublicLeadInput }
  | { ok: false } {
  const fullName = String(body.fullName ?? "")
    .trim()
    .slice(0, LEAD_FULLNAME_MAX);
  const phone = String(body.phone ?? "")
    .trim()
    .slice(0, LEAD_PHONE_MAX);

  if (fullName.length < 2) return { ok: false };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return { ok: false };

  return { ok: true, data: { fullName, phone } };
}

/** Honeypot fields — bots often fill hidden inputs. */
export function isLeadHoneypotTriggered(body: Record<string, unknown>): boolean {
  for (const key of ["website", "company_url", "_hp", "url"]) {
    const v = body[key];
    if (v != null && String(v).trim() !== "") return true;
  }
  return false;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Public portal lead — no tenantId, no status overwrite from untrusted callers.
 * Existing rows: touch login metadata only; never downgrade MATCHED → NEW.
 */
export async function upsertPublicClientLead(input: PublicLeadInput) {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const normPhone = normalizePhone(phone);
  const now = new Date();

  const existing = await prisma.client.findFirst({
    where: {
      AND: [
        { fullName: { equals: fullName, mode: "insensitive" } },
        { phone: { contains: normPhone.slice(-9) } },
      ],
    },
  });

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        lastLoginAt: now,
        loginCount: existing.loginCount + 1,
      },
      select: { id: true },
    });
  }

  return prisma.client.create({
    data: {
      fullName,
      phone,
      status: "NEW",
      loginCount: 1,
      firstLoginAt: now,
      lastLoginAt: now,
    },
    select: { id: true },
  });
}
