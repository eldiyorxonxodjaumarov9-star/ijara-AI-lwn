export const VEHICLE_STATUSES = ["AVAILABLE", "RENTED", "MAINTENANCE", "INACTIVE"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  AVAILABLE: "Bo‘sh",
  RENTED: "Ijarada",
  MAINTENANCE: "Texnik xizmatda",
  INACTIVE: "Faol emas",
};

export type Vehicle = {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  status: VehicleStatus;
  dailyRate: number;
  color: string | null;
  vin: string | null;
  mileage: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Current ACTIVE rental, list endpoint only. */
  activeRental?: { customerName: string; endDate: string } | null;
};

export type VehicleInput = {
  name: string;
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  status: VehicleStatus;
  dailyRate: number;
  color: string | null;
  vin: string | null;
  mileage: number;
  notes: string | null;
};

export const VEHICLE_MIN_YEAR = 1980;
export const vehicleMaxYear = (now = new Date()) => now.getFullYear() + 1;

export function isVehicleStatus(value: unknown): value is VehicleStatus {
  return typeof value === "string" && (VEHICLE_STATUSES as readonly string[]).includes(value);
}

/** "01 a 123 bc" → "01 A 123 BC": duplicate checks compare this form. */
export function normalizePlateNumber(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const optionalText = (value: unknown, max: number) => text(value, max) || null;

type ParseResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/**
 * Validates a create body, or a PATCH body when `partial` (only present keys).
 * Unknown keys such as workspaceId are ignored.
 */
export function parseVehicleInput(
  body: unknown,
  opts: { partial: true; now?: Date }
): ParseResult<Partial<VehicleInput>>;
export function parseVehicleInput(
  body: unknown,
  opts?: { partial?: false; now?: Date }
): ParseResult<VehicleInput>;
export function parseVehicleInput(
  body: unknown,
  opts: { partial?: boolean; now?: Date } = {}
): ParseResult<Partial<VehicleInput>> {
  if (!body || typeof body !== "object") return { error: "Ma’lumotlar noto‘g‘ri" };
  const b = body as Record<string, unknown>;
  const partial = opts.partial === true;
  const has = (key: string) => !partial || b[key] !== undefined;
  const out: Partial<VehicleInput> = {};

  if (has("brand")) {
    out.brand = text(b.brand, 60);
    if (!out.brand) return { error: "Markani kiriting" };
  }
  if (has("model")) {
    out.model = text(b.model, 60);
    if (!out.model) return { error: "Modelni kiriting" };
  }
  if (has("plateNumber")) {
    out.plateNumber = normalizePlateNumber(b.plateNumber).slice(0, 20);
    if (!out.plateNumber) return { error: "Davlat raqamini kiriting" };
  }
  if (has("year")) {
    const year = Number(b.year);
    const max = vehicleMaxYear(opts.now);
    if (!Number.isInteger(year) || year < VEHICLE_MIN_YEAR || year > max) {
      return { error: `Yil ${VEHICLE_MIN_YEAR}–${max} oralig‘ida bo‘lishi kerak` };
    }
    out.year = year;
  }
  if (has("mileage")) {
    const mileage = b.mileage === "" || b.mileage == null ? 0 : Number(b.mileage);
    if (!Number.isFinite(mileage) || mileage < 0) return { error: "Probeg manfiy bo‘lishi mumkin emas" };
    out.mileage = Math.round(mileage);
  }
  if (has("dailyRate")) {
    const rate = b.dailyRate === "" || b.dailyRate == null ? 0 : Number(b.dailyRate);
    if (!Number.isFinite(rate) || rate < 0) return { error: "Kunlik narx manfiy bo‘lishi mumkin emas" };
    out.dailyRate = rate;
  }
  if (has("status")) {
    const status = b.status == null || b.status === "" ? "AVAILABLE" : b.status;
    if (!isVehicleStatus(status)) return { error: "Status noto‘g‘ri" };
    out.status = status;
  }
  if (has("color")) out.color = optionalText(b.color, 40);
  if (has("vin")) out.vin = optionalText(b.vin, 32)?.toUpperCase() ?? null;
  if (has("notes")) out.notes = optionalText(b.notes, 1000);
  const name = text(b.name, 120);
  if (name) out.name = name;
  else if (!partial) out.name = `${out.brand} ${out.model}`;

  return { data: out };
}

export function countVehicleInventory(vehicles: { status: string }[]) {
  const counts = { total: vehicles.length, available: 0, rented: 0, maintenance: 0 };
  for (const v of vehicles) {
    if (v.status === "AVAILABLE") counts.available += 1;
    else if (v.status === "RENTED") counts.rented += 1;
    else if (v.status === "MAINTENANCE") counts.maintenance += 1;
  }
  return counts;
}
