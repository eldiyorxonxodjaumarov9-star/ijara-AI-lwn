import type { Prisma, User } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";

import { fromStoredDate } from "@/lib/vehicle-rentals";
import type { VehicleInput } from "@/lib/vehicles";

import { fail } from "./http";
import { planErrorResponse } from "./plan-service";
import { requireResourceAccess, type RbacMethod } from "./rbac";
import { resolveUserWorkspaceContext, type WorkspaceContext } from "./workspace";

export const VEHICLE_INDUSTRY = "CAR_RENTAL";

export class VehicleError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const NOT_FOUND = () => new VehicleError("Avtomobil topilmadi", 404, "NOT_FOUND");
const DUPLICATE_PLATE = () =>
  new VehicleError("Bu davlat raqamli avtomobil allaqachon mavjud", 409, "DUPLICATE_PLATE");

/** Industry comes from the DB workspace row, never from the request. */
export function assertVehicleIndustry(ctx: Pick<WorkspaceContext, "workspace">) {
  if (ctx.workspace.industry !== VEHICLE_INDUSTRY) {
    throw new VehicleError(
      "Avtomobillar bo‘limi faqat avtomobil ijarasi biznesi uchun",
      403,
      "INDUSTRY_NOT_SUPPORTED"
    );
  }
}

type GuardOk = { user: User; ctx: WorkspaceContext; error?: undefined };
type GuardErr = { error: NextResponse; user?: undefined; ctx?: undefined };

export async function requireVehicleWorkspace(
  req: NextRequest,
  method: RbacMethod
): Promise<GuardOk | GuardErr> {
  const auth = await requireResourceAccess(req, "vehicles", method);
  if (auth.error) return { error: auth.error };
  const ctx = await resolveUserWorkspaceContext(auth.user);
  if (!ctx.hasAccess) {
    return { error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") };
  }
  try {
    assertVehicleIndustry(ctx);
  } catch (err) {
    return { error: vehicleErrorResponse(err)! };
  }
  return { user: auth.user, ctx };
}

function isUniqueViolation(err: unknown) {
  return !!err && typeof err === "object" && (err as { code?: string }).code === "P2002";
}

export function vehicleErrorResponse(err: unknown) {
  if (err instanceof VehicleError) return fail(err.message, err.status, err.code);
  if (isUniqueViolation(err)) {
    const e = DUPLICATE_PLATE();
    return fail(e.message, e.status, e.code);
  }
  if (err && typeof err === "object" && (err as { code?: string }).code === "P2003") {
    return fail("Avtomobilning ijara tarixi bor", 409, "VEHICLE_HAS_HISTORY");
  }
  return planErrorResponse(err);
}

type VehicleDb = Pick<Prisma.TransactionClient, "vehicle" | "vehicleRental">;

const PUBLIC_SELECT = {
  id: true,
  name: true,
  brand: true,
  model: true,
  year: true,
  plateNumber: true,
  status: true,
  dailyRate: true,
  color: true,
  vin: true,
  mileage: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ActiveRentalRow = { endDate: Date; tenant: { fullName: string } | null };

/** List rows also carry the current ACTIVE rental (customer + return day), if any. */
export async function listVehicles(db: VehicleDb, workspaceId: string) {
  const rows = await db.vehicle.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      ...PUBLIC_SELECT,
      rentals: {
        where: { status: "ACTIVE" },
        orderBy: { endDate: "asc" },
        take: 1,
        select: { endDate: true, tenant: { select: { fullName: true } } },
      },
    },
  });
  return rows.map(({ rentals, ...vehicle }) => {
    const active = (rentals as ActiveRentalRow[] | undefined)?.[0];
    return {
      ...vehicle,
      activeRental: active
        ? { customerName: active.tenant?.fullName ?? "—", endDate: fromStoredDate(active.endDate) }
        : null,
    };
  });
}

export async function getVehicle(db: VehicleDb, workspaceId: string, id: string) {
  const vehicle = await db.vehicle.findFirst({ where: { id, workspaceId }, select: PUBLIC_SELECT });
  if (!vehicle) throw NOT_FOUND();
  return vehicle;
}

async function assertPlateFree(db: VehicleDb, workspaceId: string, plateNumber: string, exceptId?: string) {
  const dup = await db.vehicle.findFirst({
    where: { workspaceId, plateNumber, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw DUPLICATE_PLATE();
}

export async function createVehicle(db: VehicleDb, workspaceId: string, input: VehicleInput) {
  await assertPlateFree(db, workspaceId, input.plateNumber);
  // A new vehicle has no ACTIVE rental, so RENTED is never a valid starting state.
  const status = input.status === "RENTED" ? "AVAILABLE" : input.status;
  return db.vehicle.create({ data: { ...input, status, workspaceId }, select: PUBLIC_SELECT });
}

export async function updateVehicle(
  db: VehicleDb,
  workspaceId: string,
  id: string,
  input: Partial<VehicleInput>
) {
  await getVehicle(db, workspaceId, id);
  if (input.plateNumber) await assertPlateFree(db, workspaceId, input.plateNumber, id);
  const { count } = await db.vehicle.updateMany({ where: { id, workspaceId }, data: input });
  if (count === 0) throw NOT_FOUND();
  if (input.status === "AVAILABLE" || input.status === "RENTED") {
    await syncVehicleRentalStatus(db, workspaceId, id);
  }
  return getVehicle(db, workspaceId, id);
}

type StatusDb = Pick<Prisma.TransactionClient, "vehicle" | "vehicleRental">;

/**
 * Single source of truth for AVAILABLE/RENTED: RENTED iff an ACTIVE rental exists
 * (future PLANNED rentals keep it AVAILABLE). MAINTENANCE / INACTIVE are manual and never overwritten.
 */
export async function syncVehicleRentalStatus(db: StatusDb, workspaceId: string, vehicleId: string) {
  const vehicle = await db.vehicle.findFirst({ where: { id: vehicleId, workspaceId }, select: { status: true } });
  if (!vehicle || (vehicle.status !== "AVAILABLE" && vehicle.status !== "RENTED")) return;
  const active = await db.vehicleRental.count({ where: { workspaceId, vehicleId, status: "ACTIVE" } });
  const next = active > 0 ? "RENTED" : "AVAILABLE";
  if (next !== vehicle.status) {
    await db.vehicle.updateMany({ where: { id: vehicleId, workspaceId }, data: { status: next } });
  }
}

/** Workspace-wide repair of stale AVAILABLE/RENTED rows (two set-based updates, no per-row queries). */
export async function reconcileVehicleStatuses(db: Pick<Prisma.TransactionClient, "vehicle">, workspaceId: string) {
  const [freed, rented] = await Promise.all([
    db.vehicle.updateMany({
      where: { workspaceId, status: "RENTED", rentals: { none: { status: "ACTIVE" } } },
      data: { status: "AVAILABLE" },
    }),
    db.vehicle.updateMany({
      where: { workspaceId, status: "AVAILABLE", rentals: { some: { status: "ACTIVE" } } },
      data: { status: "RENTED" },
    }),
  ]);
  return freed.count + rented.count;
}

/** Open rentals block deletion; closed ones are history and keep the vehicle row. */
export async function deleteVehicle(db: VehicleDb, workspaceId: string, id: string) {
  const vehicle = await db.vehicle.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!vehicle) throw NOT_FOUND();
  const open = await db.vehicleRental.count({
    where: { workspaceId, vehicleId: id, status: { in: ["PLANNED", "ACTIVE"] } },
  });
  if (open > 0) {
    throw new VehicleError(
      "Avtomobil faol yoki rejalashtirilgan ijaraga bog‘langan. Avval ijarani yakunlang yoki bekor qiling.",
      409,
      "VEHICLE_IN_USE"
    );
  }
  const history = await db.vehicleRental.count({ where: { workspaceId, vehicleId: id } });
  if (history > 0) {
    throw new VehicleError(
      "Avtomobilning ijara tarixi bor. Tarix saqlanishi uchun uni «Faol emas» holatiga o‘tkazing.",
      409,
      "VEHICLE_HAS_HISTORY"
    );
  }
  const { count } = await db.vehicle.deleteMany({ where: { id, workspaceId } });
  if (count === 0) throw NOT_FOUND();
  return { id };
}
