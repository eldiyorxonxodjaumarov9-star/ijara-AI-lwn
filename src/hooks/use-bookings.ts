"use client";

import { useApiResource } from "@/hooks/use-api-resource";
import type { Booking } from "@/lib/bookings";

const EMPTY: Booking[] = [];

/** Fetches only when `enabled` (HOTEL_HOSTEL / VILLA_RENTAL); the API enforces the same guard. */
export function useBookings(enabled: boolean) {
  const { data, loading, error, reload } = useApiResource<Booking[]>("/bookings", enabled);
  return { bookings: data ?? EMPTY, loading, error, reload };
}
