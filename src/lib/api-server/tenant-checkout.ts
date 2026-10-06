import { ensureTenantClientNumber } from "@/lib/api-server/client-number";
import { DEBT_WRITE_OFF_REASON_CHECKOUT } from "@/lib/api-server/debt-adjustments";
import { prisma } from "@/lib/api-server/prisma";
import { computeServerDebts } from "@/lib/api-server/telegram-reminders";

export class TenantCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409
  ) {
    super(message);
  }
}

export const CHECKOUT_DEBT_DECISIONS = ["KEEP_DEBT", "WRITE_OFF"] as const;
export type CheckoutDebtDecision = (typeof CHECKOUT_DEBT_DECISIONS)[number];

export function parseCheckoutDebtDecision(value: unknown): CheckoutDebtDecision | null {
  return CHECKOUT_DEBT_DECISIONS.includes(value as CheckoutDebtDecision)
    ? (value as CheckoutDebtDecision)
    : null;
}

export type TenantCheckoutOptions = {
  debtDecision: CheckoutDebtDecision;
  /** Audit: write-off qilgan foydalanuvchi (server auth'dan). */
  actorUserId: string;
  now?: Date;
};

export type TenantCheckoutResult = {
  archive: Awaited<ReturnType<typeof prisma.tenantArchive.create>>;
  leaveDate: string;
  debtDecision: CheckoutDebtDecision;
  closedContractIds: string[];
  releasedPropertyIds: string[];
  /** Hisobdan chiqarilgan summa (server hisoblagan qarz). */
  writtenOffAmount: number;
  writeOffs: { contractId: string; amount: number }[];
  /** Checkoutdan keyin qolgan qarz (canonical debt calculator). */
  remainingDebt: number;
  unpaidMonths: number;
};

function formatUzs(amount: number) {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} UZS`;
}

/**
 * Ijarachini xonadan chiqarish (workspace bo'yicha):
 * - tenant.leftAt = bugun; tenant o'chirilmaydi
 * - ACTIVE/PENDING shartnomalar TERMINATED, endDate = min(endDate, bugun)
 * - xona boshqa faol shartnomasi bo'lmasa AVAILABLE
 * - KEEP_DEBT: qarz saqlanadi; WRITE_OFF: server hisoblagan qolgan qarz
 *   DebtAdjustment sifatida hisobdan chiqariladi (to'lov yaratilmaydi)
 * - checkoutdan keyingi oylar hisoblanmaydi
 */
export async function checkoutTenant(
  tenantId: string,
  workspaceId: string,
  options: TenantCheckoutOptions
): Promise<TenantCheckoutResult> {
  if (!workspaceId) throw new TenantCheckoutError("Workspace topilmadi", 404);
  const { debtDecision, actorUserId } = options;
  const now = options.now ?? new Date();

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, workspaceId } });
  if (!tenant) {
    throw new TenantCheckoutError("Arendator topilmadi", 404);
  }
  if (tenant.leftAt) {
    throw new TenantCheckoutError("Arendator allaqachon chiqib ketgan", 409);
  }

  const clientNumber = await ensureTenantClientNumber(tenantId);
  if (!clientNumber) {
    throw new TenantCheckoutError("Klient raqami berilmadi", 400);
  }

  const openContracts = await prisma.contract.findMany({
    where: { tenantId, workspaceId, status: { in: ["ACTIVE", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    include: { property: true, payments: true },
  });
  const contract = openContracts[0];

  const leaveDate = now;
  const totalPaid =
    contract?.payments.reduce((sum, p) => sum + (p.amount || 0), 0) ?? 0;
  const closedContractIds = openContracts.map((c) => c.id);
  const propertyIds = [...new Set(openContracts.map((c) => c.propertyId))];

  const { archive, releasedPropertyIds, writeOffs } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.tenant.updateMany({
      where: { id: tenantId, workspaceId, leftAt: null },
      data: { leftAt: leaveDate },
    });
    if (claimed.count === 0) {
      throw new TenantCheckoutError("Arendator allaqachon chiqib ketgan", 409);
    }

    for (const c of openContracts) {
      await tx.contract.update({
        where: { id: c.id },
        data: {
          status: "TERMINATED",
          endDate: c.endDate < leaveDate ? c.endDate : leaveDate,
        },
      });
    }

    const releasedPropertyIds: string[] = [];
    for (const propertyId of propertyIds) {
      const stillOccupied = await tx.contract.count({
        where: {
          propertyId,
          workspaceId,
          tenantId: { not: tenantId },
          status: { in: ["ACTIVE", "PENDING"] },
        },
      });
      if (stillOccupied > 0) continue;
      await tx.property.updateMany({
        where: { id: propertyId, workspaceId },
        data: { status: "AVAILABLE" },
      });
      releasedPropertyIds.push(propertyId);
    }

    await tx.client.updateMany({
      where: { tenantId, workspaceId },
      data: { status: "ARCHIVED" },
    });

    const writeOffs: { contractId: string; amount: number }[] = [];
    if (debtDecision === "WRITE_OFF") {
      const debts = await computeServerDebts({ workspaceId, tenantId, now }, tx);
      for (const d of debts) {
        if (d.debt <= 0) continue;
        try {
          await tx.debtAdjustment.create({
            data: {
              workspaceId,
              contractId: d.contractId,
              tenantId,
              amount: d.debt,
              type: "WRITE_OFF",
              reason: DEBT_WRITE_OFF_REASON_CHECKOUT,
              createdById: actorUserId,
            },
          });
        } catch (err) {
          if ((err as { code?: string })?.code === "P2002") {
            throw new TenantCheckoutError("Bu qarz allaqachon hisobdan chiqarilgan", 409);
          }
          throw err;
        }
        writeOffs.push({ contractId: d.contractId, amount: d.debt });
      }
    }
    const writtenOffTotal = writeOffs.reduce((s, w) => s + w.amount, 0);

    const archive = await tx.tenantArchive.create({
      data: {
        clientNumber,
        tenantId,
        contractId: contract?.id,
        fullName: tenant.fullName,
        phone: tenant.phone,
        passport: tenant.passport,
        propertyId: contract?.propertyId,
        propertyName: contract?.property.title ?? "—",
        entryDate: tenant.entryDate ?? contract?.startDate ?? leaveDate,
        leaveDate,
        contractStart: contract?.startDate ?? tenant.entryDate ?? leaveDate,
        contractEnd: leaveDate,
        monthlyRent: contract?.monthlyRent ?? tenant.rentAmount,
        deposit: contract?.deposit ?? tenant.depositAmount,
        depositPaid: contract?.depositPaid ?? tenant.depositPaid,
        contractDuration: tenant.contractDuration,
        totalPaid,
        paymentCount: contract?.payments.length ?? 0,
        notes:
          [
            contract?.notes,
            writtenOffTotal > 0
              ? `Checkoutda qarz hisobdan chiqarildi: ${formatUzs(writtenOffTotal)}`
              : null,
          ]
            .filter(Boolean)
            .join("\n") || undefined,
      },
    });

    return { archive, releasedPropertyIds, writeOffs };
  });

  const debts = await computeServerDebts({ workspaceId, tenantId, now });

  return {
    archive,
    leaveDate: leaveDate.toISOString(),
    debtDecision,
    closedContractIds,
    releasedPropertyIds,
    writtenOffAmount: writeOffs.reduce((s, w) => s + w.amount, 0),
    writeOffs,
    remainingDebt: debts.reduce((s, d) => s + d.debt, 0),
    unpaidMonths: debts.reduce((s, d) => s + (d.unpaidMonths ?? 0), 0),
  };
}
