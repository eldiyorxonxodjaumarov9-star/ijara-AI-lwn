import { getCollectionApi } from "@/lib/data/store";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import type { Contract, Payment, PaymentMethod, Property, Tenant } from "@/types";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export type TenantPaymentStatus = "paid" | "debt";

export interface AssignTenantToRoomInput {
  tenant: Tenant;
  room: Property;
  paymentStatus: TenantPaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentAmount?: number;
  paymentDate?: string;
}

export async function assignTenantToRoom(input: AssignTenantToRoomInput) {
  const { tenant, room, paymentStatus } = input;
  const propertyApi = getCollectionApi<Property>("properties");
  const contractApi = getCollectionApi<Contract>("contracts");
  const paymentApi = getCollectionApi<Payment>("payments");
  const tenantApi = getCollectionApi<Tenant>("tenants");

  const contracts = await contractApi.list();
  const existing = contracts.find((c) => c.tenantId === tenant.id);

  if (existing && existing.propertyId !== room.id) {
    await propertyApi.update(existing.propertyId, { status: "available" });
  }

  await propertyApi.update(room.id, { status: "rented" });

  const durationMonths =
    tenant.contractDuration && tenant.contractDuration > 0
      ? tenant.contractDuration
      : 12;
  const startDate = tenant.entryDate
    ? new Date(tenant.entryDate)
    : new Date();
  const endDate = addMonths(startDate, durationMonths);
  const monthlyPayment = room.price > 0 ? room.price : tenant.rentAmount;

  const contractPayload = {
    propertyId: room.id,
    tenantId: tenant.id,
    propertyName: room.name,
    tenantName: tenant.fullName,
    startDate: existing?.startDate ?? startDate.toISOString(),
    endDate: endDate.toISOString(),
    monthlyPayment,
    deposit: tenant.depositAmount ?? 0,
    depositPaid: tenant.depositPaid ?? false,
    status: "active" as const,
    notes: `LWN xonaga biriktirildi (${room.name})`,
  };

  let contractId: string;
  if (existing) {
    // Kirish sanasi / startDate saqlanadi — eski to'lovlar oylari o'chmasin
    await contractApi.update(existing.id, {
      ...contractPayload,
      startDate: existing.startDate,
      endDate: addMonths(new Date(existing.startDate), durationMonths).toISOString(),
    });
    contractId = existing.id;
    await tenantApi.update(tenant.id, {
      ...tenant,
      leftAt: undefined,
    });
  } else {
    contractId = await contractApi.create(contractPayload);
  }

  if (paymentStatus === "paid") {
    const amount = input.paymentAmount ?? monthlyPayment;
    const date = input.paymentDate ?? new Date().toISOString().slice(0, 10);
    const period = getTashkentDateParts(date);
    await paymentApi.create({
      contractId,
      tenantId: tenant.id,
      tenantName: tenant.fullName,
      propertyName: room.name,
      amount,
      date,
      periodYear: period.year,
      periodMonth: period.month,
      method: input.paymentMethod ?? "cash",
      note: `${period.year}-${String(period.month).padStart(2, "0")} oyi uchun`,
    });
  }

  return contractId;
}

export function getTenantContract(
  tenantId: string,
  contracts: Contract[]
): Contract | undefined {
  return contracts.find(
    (c) =>
      c.tenantId === tenantId &&
      (c.status === "active" || c.status === "pending")
  );
}

function isActiveContract(c: Contract) {
  return c.status === "active" || c.status === "pending";
}

export function getTenantRoomMaps(contracts: Contract[]) {
  const byTenant = new Map<string, string>();
  const byProperty = new Map<string, string>();
  for (const c of contracts) {
    if (!isActiveContract(c)) continue;
    byTenant.set(c.tenantId, c.propertyName ?? "—");
    byProperty.set(c.propertyId, c.tenantName ?? "—");
  }
  return { byTenant, byProperty };
}
