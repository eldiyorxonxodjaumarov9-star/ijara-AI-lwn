"use client";

import { useApiResource } from "@/hooks/use-api-resource";
import type { VehicleRental } from "@/lib/vehicle-rentals";

const EMPTY: VehicleRental[] = [];

/** Fetches only when `enabled` (CAR_RENTAL); the API enforces the same guard. */
export function useVehicleRentals(enabled: boolean) {
  const { data, loading, error, reload } = useApiResource<VehicleRental[]>("/vehicle-rentals", enabled);
  return { rentals: data ?? EMPTY, loading, error, reload };
}
