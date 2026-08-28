"use client";

import { useMemo } from "react";

import { getTenantRoomMaps } from "@/lib/tenant-room-assign";
import type { Contract, Tenant } from "@/types";

/** Arendatorlar sahifasi bilan bir xil qator */
export type TenantRow = Tenant & { assignedRoom: string };

/** Faol arendatorlar + shartnoma orqali xona/mulk (Arendatorlar sahifasi mantiq) */
export function buildTenantRows(
  tenants: Tenant[],
  contracts: Contract[]
): TenantRow[] {
  const { byTenant } = getTenantRoomMaps(contracts);
  return tenants
    .filter((t) => !t.leftAt)
    .map((t) => ({
      ...t,
      assignedRoom: byTenant.get(t.id) ?? "",
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "uz"));
}

export function useTenantRows(tenants: Tenant[], contracts: Contract[]) {
  return useMemo(
    () => buildTenantRows(tenants, contracts),
    [tenants, contracts]
  );
}

/** Xona/mulk filtri uchun haqiqiy qiymatlar */
export function collectAssignedRooms(rows: TenantRow[]): string[] {
  const rooms = new Set<string>();
  for (const r of rows) {
    if (r.assignedRoom.trim()) rooms.add(r.assignedRoom);
  }
  return Array.from(rooms).sort((a, b) => a.localeCompare(b, "uz"));
}
