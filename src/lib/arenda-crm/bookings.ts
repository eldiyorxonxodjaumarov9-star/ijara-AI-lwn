export type BookingStatus = "available" | "reserved" | "booked" | "maintenance";

export type CrmBooking = {
  id: string;
  propertyTitle: string;
  clientName: string;
  clientPhone: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
};

const KEY = "arenda:crm-bookings";

function read(): CrmBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CrmBooking[]) : [];
  } catch {
    return [];
  }
}

function write(data: CrmBooking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function getCrmBookings(): CrmBooking[] {
  return read().sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
}

export function saveCrmBooking(
  booking: Omit<CrmBooking, "id" | "createdAt"> & { id?: string }
): CrmBooking {
  const all = read();
  const now = new Date().toISOString();
  if (booking.id) {
    const idx = all.findIndex((b) => b.id === booking.id);
    const updated: CrmBooking = { ...booking, id: booking.id, createdAt: all[idx]?.createdAt ?? now };
    if (idx >= 0) all[idx] = updated;
    else all.unshift(updated);
    write(all);
    return updated;
  }
  const created: CrmBooking = { ...booking, id: crypto.randomUUID(), createdAt: now };
  all.unshift(created);
  write(all);
  return created;
}

export function deleteCrmBooking(id: string) {
  write(read().filter((b) => b.id !== id));
}
