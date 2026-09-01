import { LWN_ADDRESS, LWN_BUILDING } from "@/lib/constants";
import { isLwnRoom } from "@/lib/lwn-rooms";
import type { Contract, Property, Tenant } from "@/types";

export type RoomTenantRow = {
  contractId: string;
  tenantId: string;
  fullName: string;
  phone?: string;
  email?: string;
  contractStatus: Contract["status"];
  startDate: string;
  endDate: string;
};

const RELEVANT_CONTRACT_STATUSES = new Set<Contract["status"]>([
  "active",
  "pending",
  "expired",
]);

/** URL orqali kirish: faqat mavjud LWN xonasi */
export function resolveLwnRoomById(
  propertyId: string,
  properties: Property[]
): Property | null {
  const room = properties.find((p) => p.id === propertyId);
  if (!room || !isLwnRoom(room)) return null;
  return room;
}

export function getRoomObjectLabel(room: Property): string {
  return room.building?.trim() || room.district?.trim() || LWN_BUILDING;
}

export function getRoomAddressLabel(room: Property): string {
  return room.address?.trim() || LWN_ADDRESS;
}

/** Xonaga tegishli shartnomalar va arendatorlar */
export function getRoomContractTenants(
  propertyId: string,
  contracts: Contract[],
  tenants: Tenant[]
): RoomTenantRow[] {
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return contracts
    .filter(
      (c) =>
        c.propertyId === propertyId &&
        RELEVANT_CONTRACT_STATUSES.has(c.status)
    )
    .map((c) => {
      const tenant = tenantById.get(c.tenantId);
      return {
        contractId: c.id,
        tenantId: c.tenantId,
        fullName: c.tenantName?.trim() || tenant?.fullName || "—",
        phone: tenant?.phone,
        email: tenant?.email,
        contractStatus: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "uz"));
}
