import type { Prisma } from "@prisma/client";

import {
  BLOCKING_RENTAL_STATUSES,
  fromStoredDate,
  initialRentalStatus,
  rentalDays,
  rentalTotal,
  tashkentToday,
  toStoredDate,
  type RentalInput,
  type RentalUpdateInput,
  type VehicleRental,
} from "@/lib/vehicle-rentals";

import { fail } from "./http";
import { syncVehicleRentalStatus, VehicleError } from "./vehicles";

export type RentalDb = Pick<
  Prisma.TransactionClient,
  "vehicle" | "vehicleRental" | "tenant" | "sourcePayment" | "$queryRaw"
>;

const RENTAL_NOT_FOUND = () => new VehicleError("Ijara topilmadi", 404, "NOT_FOUND");
const VEHICLE_NOT_FOUND = () => new VehicleError("Avtomobil topilmadi", 404, "NOT_FOUND");
const CUSTOMER_NOT_FOUND = () => new VehicleError("Mijoz topilmadi", 404, "CUSTOMER_NOT_FOUND");

const RENTAL_INCLUDE = {
  vehicle: { select: { name: true, plateNumber: true } },
  tenant: { select: { fullName: true } },
} as const;

type RentalRow = {
  id: string;
  vehicleId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  days: number;
  dailyRate: number;
  totalAmount: number;
  status: VehicleRental["status"];
  notes: string | null;
  createdAt: Date;
  vehicle?: { name: string; plateNumber: string } | null;
  tenant?: { fullName: string } | null;
};

export function toRentalView(row: RentalRow): VehicleRental {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    tenantId: row.tenantId,
    startDate: fromStoredDate(row.startDate),
    endDate: fromStoredDate(row.endDate),
    days: row.days,
    dailyRate: row.dailyRate,
    totalAmount: row.totalAmount,
    status: row.status,
    notes: row.notes,
    vehicleName: row.vehicle?.name ?? "—",
    plateNumber: row.vehicle?.plateNumber ?? "",
    customerName: row.tenant?.fullName ?? "—",
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/** Serializes rentals per vehicle and proves the vehicle belongs to the workspace. */
async function lockVehicle(db: RentalDb, workspaceId: string, vehicleId: string) {
  await db.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicleId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, workspaceId },
    select: { id: true, status: true },
  });
  if (!vehicle) throw VEHICLE_NOT_FOUND();
  return vehicle;
}

async function assertCustomer(db: RentalDb, workspaceId: string, tenantId: string) {
  const tenant = await db.tenant.findFirst({ where: { id: tenantId, workspaceId }, select: { id: true } });
  if (!tenant) throw CUSTOMER_NOT_FOUND();
}

async function assertAvailable(
  db: RentalDb,
  workspaceId: string,
  vehicleId: string,
  range: { startDate: string; endDate: string },
  exceptId?: string
) {
  const clash = await db.vehicleRental.findFirst({
    where: {
      workspaceId,
      vehicleId,
      status: { in: [...BLOCKING_RENTAL_STATUSES] },
      startDate: { lte: toStoredDate(range.endDate) },
      endDate: { gte: toStoredDate(range.startDate) },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new VehicleError(
      "Avtomobil bu sanalarda band. Boshqa sana yoki avtomobil tanlang.",
      409,
      "VEHICLE_NOT_AVAILABLE"
    );
  }
}

export const syncVehicleStatus = syncVehicleRentalStatus;

/** Guard for tenant/client delete routes: rental history is kept (FK is NO ACTION). Null = safe. */
export async function tenantRentalHistoryResponse(db: Pick<Prisma.TransactionClient, "vehicleRental">, tenantId: string) {
  const n = await db.vehicleRental.count({ where: { tenantId } });
  return n > 0
    ? fail("Bu mijozning avtomobil ijarasi tarixi bor, uni o‘chirib bo‘lmaydi.", 409, "TENANT_HAS_RENTAL_HISTORY")
    : null;
}

/** Lowering a total below what was already paid would hide an overpayment. */
async function assertTotalNotBelowPaid(db: RentalDb, workspaceId: string, rentalId: string, newTotal: number) {
  await db.$queryRaw`SELECT id FROM vehicle_rentals WHERE id = ${rentalId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  const agg = await db.sourcePayment.aggregate({
    where: { workspaceId, vehicleRentalId: rentalId },
    _sum: { amount: true },
  });
  const paid = agg._sum.amount ?? 0;
  if (newTotal < paid) {
    throw new VehicleError(
      `Jami summa allaqachon to‘langan summadan (${paid}) kam bo‘lishi mumkin emas`,
      409,
      "TOTAL_BELOW_PAID"
    );
  }
}

/** PLANNED rentals whose start day has arrived become ACTIVE (lazy, no cron). */
export async function promoteDueRentals(db: RentalDb, workspaceId: string, now = new Date()) {
  const due = await db.vehicleRental.findMany({
    where: { workspaceId, status: "PLANNED", startDate: { lte: toStoredDate(tashkentToday(now)) } },
    select: { id: true, vehicleId: true },
  });
  if (due.length === 0) return 0;
  await db.vehicleRental.updateMany({
    where: { workspaceId, id: { in: due.map((r) => r.id) } },
    data: { status: "ACTIVE" },
  });
  for (const vehicleId of new Set(due.map((r) => r.vehicleId))) {
    await syncVehicleStatus(db, workspaceId, vehicleId);
  }
  return due.length;
}

export async function listRentals(db: RentalDb, workspaceId: string) {
  const rows = await db.vehicleRental.findMany({
    where: { workspaceId },
    orderBy: { startDate: "desc" },
    include: RENTAL_INCLUDE,
  });
  return rows.map(toRentalView);
}

export async function getRental(db: RentalDb, workspaceId: string, id: string) {
  const row = await db.vehicleRental.findFirst({ where: { id, workspaceId }, include: RENTAL_INCLUDE });
  if (!row) throw RENTAL_NOT_FOUND();
  return toRentalView(row);
}

export async function createRental(db: RentalDb, workspaceId: string, input: RentalInput, now = new Date()) {
  const vehicle = await lockVehicle(db, workspaceId, input.vehicleId);
  if (vehicle.status === "MAINTENANCE" || vehicle.status === "INACTIVE") {
    throw new VehicleError(
      "Texnik xizmatdagi yoki faol bo‘lmagan avtomobilni ijaraga berib bo‘lmaydi",
      409,
      "VEHICLE_NOT_RENTABLE"
    );
  }
  await assertCustomer(db, workspaceId, input.tenantId);

  const status = initialRentalStatus(input.startDate, input.endDate, tashkentToday(now));
  if (status !== "COMPLETED") await assertAvailable(db, workspaceId, vehicle.id, input);

  const days = rentalDays(input.startDate, input.endDate)!;
  const created = await db.vehicleRental.create({
    data: {
      workspaceId,
      vehicleId: vehicle.id,
      tenantId: input.tenantId,
      startDate: toStoredDate(input.startDate),
      endDate: toStoredDate(input.endDate),
      days,
      dailyRate: input.dailyRate,
      totalAmount: rentalTotal(days, input.dailyRate),
      status,
      notes: input.notes,
    },
    select: { id: true },
  });
  await syncVehicleStatus(db, workspaceId, vehicle.id);
  return getRental(db, workspaceId, created.id);
}

export async function updateRental(
  db: RentalDb,
  workspaceId: string,
  id: string,
  input: RentalUpdateInput,
  now = new Date()
) {
  const existing = await db.vehicleRental.findFirst({ where: { id, workspaceId } });
  if (!existing) throw RENTAL_NOT_FOUND();
  await lockVehicle(db, workspaceId, existing.vehicleId);

  const isOpen = existing.status === "PLANNED" || existing.status === "ACTIVE";
  if (!isOpen) {
    throw new VehicleError("Yakunlangan yoki bekor qilingan ijarani o‘zgartirib bo‘lmaydi", 409, "RENTAL_CLOSED");
  }

  const data: Prisma.VehicleRentalUncheckedUpdateManyInput = {};
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.tenantId !== undefined) {
    await assertCustomer(db, workspaceId, input.tenantId);
    data.tenantId = input.tenantId;
  }

  if (input.status === "COMPLETED") {
    if (existing.status !== "ACTIVE") {
      throw new VehicleError("Faqat faol ijarani yakunlash mumkin", 409, "INVALID_TRANSITION");
    }
    data.status = "COMPLETED";
  } else if (input.status === "CANCELLED") {
    data.status = "CANCELLED";
  } else if (input.startDate || input.dailyRate !== undefined) {
    const startDate = input.startDate ?? fromStoredDate(existing.startDate);
    const endDate = input.endDate ?? fromStoredDate(existing.endDate);
    const dailyRate = input.dailyRate ?? existing.dailyRate;
    const status = initialRentalStatus(startDate, endDate, tashkentToday(now));
    if (status !== "COMPLETED") {
      await assertAvailable(db, workspaceId, existing.vehicleId, { startDate, endDate }, id);
    }
    const days = rentalDays(startDate, endDate)!;
    const totalAmount = rentalTotal(days, dailyRate);
    if (totalAmount < existing.totalAmount) await assertTotalNotBelowPaid(db, workspaceId, id, totalAmount);
    Object.assign(data, {
      startDate: toStoredDate(startDate),
      endDate: toStoredDate(endDate),
      days,
      dailyRate,
      totalAmount,
      status,
    });
  }

  const { count } = await db.vehicleRental.updateMany({ where: { id, workspaceId }, data });
  if (count === 0) throw RENTAL_NOT_FOUND();
  await syncVehicleStatus(db, workspaceId, existing.vehicleId);
  return getRental(db, workspaceId, id);
}

export async function deleteRental(db: RentalDb, workspaceId: string, id: string) {
  const existing = await db.vehicleRental.findFirst({ where: { id, workspaceId }, select: { vehicleId: true } });
  if (!existing) throw RENTAL_NOT_FOUND();
  await lockVehicle(db, workspaceId, existing.vehicleId);
  const { count } = await db.vehicleRental.deleteMany({ where: { id, workspaceId } });
  if (count === 0) throw RENTAL_NOT_FOUND();
  await syncVehicleStatus(db, workspaceId, existing.vehicleId);
  return { id };
}
