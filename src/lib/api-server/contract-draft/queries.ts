import { randomUUID } from "crypto";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { resolveTenantAssignedProperty } from "@/lib/api-server/contract-draft/resolve-tenant-property";
import { ACTIVE_REQUEST_STATUSES } from "@/lib/api-server/contract-draft/status";

export function assertContractStaff(user: User) {
  if (
    user.role !== "SUPER_ADMIN" &&
    user.role !== "ADMIN" &&
    user.role !== "MANAGER"
  ) {
    throw Object.assign(new Error("Ruxsat yo‘q"), { status: 403 });
  }
}

const LEASE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Amaldagi",
  PENDING: "Kutilmoqda",
  EXPIRED: "Muddati tugagan",
  TERMINATED: "Tugatilgan",
};

export async function listEligibleTenants() {
  const activeStatuses = ACTIVE_REQUEST_STATUSES;
  const tenants = await prisma.tenant.findMany({
    where: {
      leftAt: null,
      // Formal ContractRequest yo‘q bo‘lsa yetadi.
      // Operatsion lease Contract (xona biriktirish) alohida — u yerda propertyId olinadi.
      NOT: {
        contractRequests: {
          some: { status: { in: activeStatuses } },
        },
      },
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      clientNumber: true,
      telegramChatId: true,
      contracts: {
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          updatedAt: true,
          property: {
            select: { id: true, title: true, address: true, area: true },
          },
        },
      },
    },
  });
  return tenants.map((t) => {
    const resolved = resolveTenantAssignedProperty(t.contracts);
    return {
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      clientNumber: t.clientNumber,
      telegramChatId: t.telegramChatId,
      propertyId: resolved.propertyId,
      propertyAddress: resolved.propertyAddress,
      propertyTitle: resolved.propertyTitle,
      propertyArea: resolved.propertyArea,
      assignedProperties: resolved.assignedProperties,
      leaseStatus: resolved.leaseStatus,
      leaseStatusLabel: resolved.leaseStatus
        ? LEASE_STATUS_LABEL[resolved.leaseStatus] ?? resolved.leaseStatus
        : "Shartnoma yo‘q",
    };
  });
}

export async function listContractRequests(limit = 50) {
  return prisma.contractRequest.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      tenant: { select: { id: true, fullName: true, phone: true } },
      property: { select: { id: true, title: true, address: true } },
      document: { select: { id: true, originalName: true, generatedAt: true } },
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });
}

export async function recordStatusEvent(input: {
  requestId: string;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId?: string | null;
  actorKind?: string;
  reason?: string | null;
}) {
  await prisma.contractStatusEvent.create({
    data: {
      id: randomUUID(),
      requestId: input.requestId,
      fromStatus: (input.fromStatus as never) ?? null,
      toStatus: input.toStatus as never,
      actorUserId: input.actorUserId ?? null,
      actorKind: input.actorKind ?? "SYSTEM",
      reason: input.reason ?? null,
    },
  });
}

export function publicAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "https://ijaraai.uz"
  );
}

export function contractFormUrl(rawToken: string): string {
  return `${publicAppOrigin()}/contract-form/${rawToken}`;
}

export function toPublicRequestView(
  row: Awaited<ReturnType<typeof listContractRequests>>[number] & {
    rawToken?: never;
  }
) {
  const deliveryStatus =
    "deliveries" in row && Array.isArray(row.deliveries) && row.deliveries[0]
      ? row.deliveries[0].status
      : null;
  return {
    id: row.id,
    status: row.status,
    partyCategory: row.partyCategory,
    partySubtype: row.partySubtype,
    templateKind: row.templateKind,
    phoneDisplay: row.phoneDisplay,
    contractNumber: row.contractNumber,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    serviceName: row.serviceName,
    areaSqm: row.areaSqm,
    ratePerSqm: row.ratePerSqm,
    monthCount: row.monthCount,
    monthlyAmount: row.monthlyAmount,
    totalAmount: row.totalAmount,
    paymentDueDay: row.paymentDueDay,
    depositAmount: row.depositAmount,
    failReasonSafe: row.failReasonSafe,
    telegramChatId: row.telegramChatId,
    deliveryStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tenant: row.tenant,
    property: row.property,
    hasDocument: Boolean(row.document),
    documentName: row.document?.originalName ?? null,
  };
}
