"use client";

import { useApiResource } from "@/hooks/use-api-resource";
import type { HotelGuestList } from "@/lib/hotel-guests";

const EMPTY: HotelGuestList = { rows: [], unplaced: [] };

/** HOTEL_HOSTEL only; the API enforces the same industry guard. */
export function useHotelGuests(enabled: boolean) {
  const { data, loading, error, reload } = useApiResource<HotelGuestList>("/hotel-guests", enabled);
  return { list: data ?? EMPTY, loading, error, reload };
}
