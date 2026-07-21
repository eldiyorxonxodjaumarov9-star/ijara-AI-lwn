import { ensureTenantClientNumber } from "@/lib/api-server/client-number";
import { prisma } from "@/lib/api-server/prisma";
import type { ClientDatabaseRow, ContactInterest } from "@/types";

function interestFromApi(v: string): ContactInterest {
  return String(v ?? "CALLED").toLowerCase() as ContactInterest;
}

export async function ensureAllTenantClientNumbers() {
  const missing = await prisma.tenant.findMany({
    where: { clientNumber: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  for (const t of missing) {
    await ensureTenantClientNumber(t.id);
  }
}

export async function buildClientDatabaseRows(): Promise<ClientDatabaseRow[]> {
  await ensureAllTenantClientNumbers();

  const [tenants, archives, contacts] = await Promise.all([
    prisma.tenant.findMany({
      where: { leftAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        contracts: {
          where: { status: { in: ["ACTIVE", "PENDING"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            property: true,
            payments: { select: { amount: true } },
          },
        },
      },
    }),
    prisma.tenantArchive.findMany({ orderBy: { leaveDate: "desc" } }),
    prisma.contactLead.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const activeRows: ClientDatabaseRow[] = tenants.map((t) => {
    const contract = t.contracts[0];
    const totalPaid =
      contract?.payments.reduce((s, p) => s + (p.amount || 0), 0) ?? 0;
    return {
      id: `tenant-${t.id}`,
      kind: "active" as const,
      clientNumber: t.clientNumber ?? undefined,
      fullName: t.fullName,
      phone: t.phone,
      propertyName: contract?.property.title,
      entryDate: (t.entryDate ?? contract?.startDate)?.toISOString(),
      totalPaid,
      passport: t.passport,
      monthlyRent: contract?.monthlyRent ?? t.rentAmount,
      contractDuration: t.contractDuration ?? undefined,
      depositPaid: contract?.depositPaid ?? t.depositPaid,
      deposit: contract?.deposit ?? t.depositAmount,
      paymentCount: contract?.payments.length ?? 0,
      contractStart: contract?.startDate?.toISOString(),
      contractEnd: contract?.endDate?.toISOString(),
      notes: contract?.notes ?? undefined,
    };
  });

  const leftRows: ClientDatabaseRow[] = archives.map((a) => ({
    id: `archive-${a.id}`,
    kind: "left" as const,
    clientNumber: a.clientNumber,
    fullName: a.fullName,
    phone: a.phone,
    propertyName: a.propertyName,
    entryDate: a.entryDate?.toISOString(),
    leaveDate: a.leaveDate.toISOString(),
    totalPaid: a.totalPaid,
    passport: a.passport ?? undefined,
    monthlyRent: a.monthlyRent,
    contractDuration: a.contractDuration ?? undefined,
    depositPaid: a.depositPaid,
    deposit: a.deposit,
    paymentCount: a.paymentCount,
    contractStart: a.contractStart.toISOString(),
    contractEnd: a.contractEnd.toISOString(),
    notes: a.notes ?? undefined,
  }));

  const contactRows: ClientDatabaseRow[] = contacts.map((c) => ({
    id: `contact-${c.id}`,
    kind: "contact" as const,
    fullName: c.fullName,
    phone: c.phone,
    interest: interestFromApi(c.interest),
    notes: c.notes ?? undefined,
    entryDate: c.createdAt.toISOString(),
  }));

  return [...activeRows, ...leftRows, ...contactRows];
}

export function mapContactLead(row: {
  id: string;
  fullName: string;
  phone: string;
  interest: string;
  notes: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    interest: interestFromApi(row.interest),
    notes: row.notes ?? undefined,
    source: row.source ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const INTEREST_TO_API: Record<ContactInterest, string> = {
  interested: "INTERESTED",
  called: "CALLED",
  thinking: "THINKING",
  visited: "VISITED",
  follow_up: "FOLLOW_UP",
  not_interested: "NOT_INTERESTED",
};

export function interestToApi(value: string) {
  const key = value.toLowerCase().replace(/-/g, "_") as ContactInterest;
  return (INTEREST_TO_API[key] ?? "CALLED") as
    | "INTERESTED"
    | "CALLED"
    | "THINKING"
    | "VISITED"
    | "FOLLOW_UP"
    | "NOT_INTERESTED";
}
