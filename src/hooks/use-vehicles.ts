"use client";

import { useApiResource } from "@/hooks/use-api-resource";
import type { Vehicle } from "@/lib/vehicles";

const EMPTY: Vehicle[] = [];

/** Fetches only when `enabled` (CAR_RENTAL); the API enforces the same guard. */
export function useVehicles(enabled: boolean) {
  const { data, loading, error, reload } = useApiResource<Vehicle[]>("/vehicles", enabled);
  return { vehicles: data ?? EMPTY, loading, error, reload };
}
