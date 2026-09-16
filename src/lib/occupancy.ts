import type { Contract, Property, Tenant } from "@/types";

/**
 * Bandlik foizi: band xonalar / jami xonalar × 100.
 * totalRooms = 0 bo'lsa 0 qaytariladi.
 */
export function occupancyRate(input: {
  totalRooms: number;
  occupiedRooms: number;
}): number {
  const total = input.totalRooms;
  if (total <= 0) return 0;
  const occupied = Math.max(0, Math.min(input.occupiedRooms, total));
  return Math.round((occupied / total) * 100);
}

export type OccupancyInputs = {
  totalRooms: number;
  occupiedRooms: number;
};

function isOccupiedPropertyStatus(status: Property["status"] | string): boolean {
  const s = String(status).toLowerCase();
  return s === "rented" || s === "occupied" || s === "busy";
}

/**
 * Dashboard bandlik manbasi (SoT) — mulk/xona statusi.
 * Dashboard "bo'sh xona" hisobi bilan bir xil: RENTED vs AVAILABLE.
 * Shartnoma/tenant soni bilan aralashtirilmaydi (eski 100% bug).
 */
export function countDashboardOccupancy(
  properties: Property[],
  _contracts: Contract[] = [],
  _tenants: Tenant[] = []
): OccupancyInputs {
  void _contracts;
  void _tenants;
  return occupancyFromPropertyStatuses(properties);
}

export function computeDashboardOccupancyRate(
  properties: Property[],
  contracts: Contract[] = [],
  tenants: Tenant[] = []
): number {
  return occupancyRate(countDashboardOccupancy(properties, contracts, tenants));
}

/** Mulklar ro'yxati bo'yicha bandlik (dashboard + LWN widget). */
export function occupancyFromPropertyStatuses(
  properties: Property[]
): OccupancyInputs {
  return {
    totalRooms: properties.length,
    occupiedRooms: properties.filter((p) =>
      isOccupiedPropertyStatus(p.status)
    ).length,
  };
}
