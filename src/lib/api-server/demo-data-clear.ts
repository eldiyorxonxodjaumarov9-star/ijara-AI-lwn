import type { Prisma } from "@prisma/client";

import { resolveAccessPlan } from "@/lib/plan-features";

import {
  DEMO_SEED_CUSTOMER_NAMES,
  DEMO_SEED_NOTE,
  DEMO_SEED_TENANT_PHONE,
} from "./demo-seed-plan";

/**
 * Seeded rows are written in one transaction right after signup, so a record only
 * counts as demo when it carries the seed marker AND was created near the seed time.
 */
export const DEMO_WINDOW_BEFORE_MS = 5 * 60_000;
export const DEMO_WINDOW_AFTER_MS = 30 * 60_000;

export const DEMO_ENTITIES = [
  "sourcePayments",
  "payments",
  "bookings",
  "vehicleRentals",
  "contracts",
  "expenses",
  "tenants",
  "vehicles",
  "properties",
] as const;
export type DemoEntity = (typeof DEMO_ENTITIES)[number];
export type DemoCounts = Record<DemoEntity, number>;
type DemoIds = Record<DemoEntity, string[]>;

export const zeroDemoCounts = (): DemoCounts =>
  Object.fromEntries(DEMO_ENTITIES.map((k) => [k, 0])) as DemoCounts;

export type DemoWorkspace = {
  id: string;
  isInternal: boolean;
  createdAt: Date;
  demoSeededAt: Date | null;
  demoDataClearedAt: Date | null;
  subscription: { plan: string | null } | null;
};

export type DemoClearEligibility =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

/** Demo data and plan gating are separate: plan only decides who may use this action. */
export function demoClearEligibility(
  ws: Pick<DemoWorkspace, "isInternal" | "subscription">,
  membershipRole: string | null | undefined
): DemoClearEligibility {
  if (membershipRole !== "OWNER" && membershipRole !== "ADMIN") {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "Faqat workspace egasi yoki admin tozalay oladi" };
  }
  if (ws.isInternal || resolveAccessPlan(ws.subscription?.plan, { isInternal: ws.isInternal }) !== "DEMO") {
    return {
      ok: false,
      status: 403,
      code: "PLAN_NOT_ELIGIBLE",
      message: "Demo ma’lumotlarni tozalash faqat DEMO rejimidagi workspace uchun",
    };
  }
  return { ok: true };
}

type Db = Prisma.TransactionClient;

const toSet = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
const ids = (set: Set<string>) => [...set];

/**
 * Finds seeded demo records of ONE workspace that can be removed without touching
 * anything real: a record is kept if any non-demo row (or user-created link such as
 * maintenance, lock settings, archives, manual debts) still references it.
 */
export async function findDemoRecords(
  db: Db,
  ws: Pick<DemoWorkspace, "id" | "createdAt" | "demoSeededAt">,
  opts: { lock?: boolean } = {}
): Promise<{ deletable: DemoIds; kept: DemoCounts }> {
  const anchor = (ws.demoSeededAt ?? ws.createdAt).getTime();
  const createdAt = {
    gte: new Date(anchor - DEMO_WINDOW_BEFORE_MS),
    lte: new Date(anchor + DEMO_WINDOW_AFTER_MS),
  };
  const base = { workspaceId: ws.id, createdAt };
  const marked = { ...base, notes: DEMO_SEED_NOTE };
  const idOnly = { id: true } as const;

  const [properties, tenantRows, contracts, payments, expenses, vehicles, rentals, bookings, sourcePayments] =
    await Promise.all([
      db.property.findMany({ where: { ...base, description: DEMO_SEED_NOTE }, select: idOnly }),
      db.tenant.findMany({
        where: { ...base, fullName: { in: [...DEMO_SEED_CUSTOMER_NAMES] }, phone: { startsWith: "+99890000" } },
        select: { id: true, phone: true },
      }),
      db.contract.findMany({ where: marked, select: idOnly }),
      db.payment.findMany({ where: marked, select: { id: true, contractId: true } }),
      db.expense.findMany({ where: marked, select: idOnly }),
      db.vehicle.findMany({ where: marked, select: idOnly }),
      db.vehicleRental.findMany({ where: marked, select: idOnly }),
      db.booking.findMany({ where: marked, select: idOnly }),
      db.sourcePayment.findMany({ where: marked, select: { id: true, bookingId: true, vehicleRentalId: true } }),
    ]);
  const tenants = tenantRows.filter((t) => DEMO_SEED_TENANT_PHONE.test(t.phone));

  const P = toSet(properties);
  const T = toSet(tenants);
  const C = toSet(contracts);
  const V = toSet(vehicles);
  const R = toSet(rentals);
  const B = toSet(bookings);
  const demoPayments = toSet(payments);
  const demoSourcePayments = toSet(sourcePayments);

  if (opts.lock) {
    // Parents are locked first so no new child row can attach to them before deletion.
    await lockRows(db, "properties", P);
    await lockRows(db, "tenants", T);
    await lockRows(db, "contracts", C);
    await lockRows(db, "vehicles", V);
    await lockRows(db, "vehicle_rentals", R);
    await lockRows(db, "bookings", B);
  }

  // Bookings / rentals: kept when any non-demo source payment points at them.
  const spRefs = await db.sourcePayment.findMany({
    where: { OR: [{ bookingId: { in: ids(B) } }, { vehicleRentalId: { in: ids(R) } }] },
    select: { id: true, bookingId: true, vehicleRentalId: true },
  });
  for (const sp of spRefs) {
    if (demoSourcePayments.has(sp.id)) continue;
    if (sp.bookingId) B.delete(sp.bookingId);
    if (sp.vehicleRentalId) R.delete(sp.vehicleRentalId);
  }
  const SP = new Set(
    sourcePayments
      .filter((sp) => (sp.bookingId ? B.has(sp.bookingId) : sp.vehicleRentalId ? R.has(sp.vehicleRentalId) : false))
      .map((sp) => sp.id)
  );

  // Contracts: kept when a real payment, debt adjustment or archive references them.
  const [payRefs, adjByContract, archByContract] = await Promise.all([
    db.payment.findMany({ where: { contractId: { in: ids(C) } }, select: { id: true, contractId: true } }),
    db.debtAdjustment.findMany({ where: { contractId: { in: ids(C) } }, select: { contractId: true } }),
    db.tenantArchive.findMany({ where: { contractId: { in: ids(C) } }, select: { contractId: true } }),
  ]);
  for (const p of payRefs) if (!demoPayments.has(p.id)) C.delete(p.contractId);
  for (const r of [...adjByContract, ...archByContract]) if (r.contractId) C.delete(r.contractId);
  const PAY = new Set(payments.filter((p) => C.has(p.contractId)).map((p) => p.id));

  // Vehicles, tenants, properties: kept when anything that stays references them.
  const [rentalRefs, bookingRefs, contractRefs] = await Promise.all([
    db.vehicleRental.findMany({
      where: { OR: [{ vehicleId: { in: ids(V) } }, { tenantId: { in: ids(T) } }] },
      select: { id: true, vehicleId: true, tenantId: true },
    }),
    db.booking.findMany({
      where: { OR: [{ propertyId: { in: ids(P) } }, { tenantId: { in: ids(T) } }] },
      select: { id: true, propertyId: true, tenantId: true },
    }),
    db.contract.findMany({
      where: { OR: [{ propertyId: { in: ids(P) } }, { tenantId: { in: ids(T) } }] },
      select: { id: true, propertyId: true, tenantId: true },
    }),
  ]);
  for (const r of rentalRefs) {
    if (R.has(r.id)) continue;
    V.delete(r.vehicleId);
    T.delete(r.tenantId);
  }
  for (const [refs, staying] of [[bookingRefs, B], [contractRefs, C]] as const) {
    for (const r of refs) {
      if (staying.has(r.id)) continue;
      P.delete(r.propertyId);
      T.delete(r.tenantId);
    }
  }

  const tenantIn = { tenantId: { in: ids(T) } };
  const tenantSel = { tenantId: true } as const;
  const tenantLinks = await Promise.all([
    db.debtAdjustment.findMany({ where: tenantIn, select: tenantSel }),
    db.client.findMany({ where: tenantIn, select: tenantSel }),
    db.tenantArchive.findMany({ where: tenantIn, select: tenantSel }),
    db.telegramBotUser.findMany({ where: tenantIn, select: tenantSel }),
    db.roomAccessGrant.findMany({ where: tenantIn, select: tenantSel }),
    db.contractRequest.findMany({ where: tenantIn, select: tenantSel }),
  ]);
  for (const rows of tenantLinks) for (const r of rows) if (r.tenantId) T.delete(r.tenantId);

  const propertyIn = { propertyId: { in: ids(P) } };
  const propertySel = { propertyId: true } as const;
  const propertyLinks = await Promise.all([
    db.manualDebt.findMany({ where: propertyIn, select: propertySel }),
    db.maintenance.findMany({ where: propertyIn, select: propertySel }),
    db.roomLockSettings.findMany({ where: propertyIn, select: propertySel }),
    db.roomAccessGrant.findMany({ where: propertyIn, select: propertySel }),
    db.roomAccessLogEvent.findMany({ where: propertyIn, select: propertySel }),
    db.ttlockRemoteCommand.findMany({ where: propertyIn, select: propertySel }),
    db.contractRequest.findMany({ where: propertyIn, select: propertySel }),
  ]);
  for (const rows of propertyLinks) for (const r of rows) if (r.propertyId) P.delete(r.propertyId);
  const media = await db.aiAgentMedia.findMany({ where: { roomId: { in: ids(P) } }, select: { roomId: true } });
  for (const m of media) if (m.roomId) P.delete(m.roomId);

  const deletable: DemoIds = {
    sourcePayments: ids(SP),
    payments: ids(PAY),
    bookings: ids(B),
    vehicleRentals: ids(R),
    contracts: ids(C),
    expenses: expenses.map((e) => e.id),
    tenants: ids(T),
    vehicles: ids(V),
    properties: ids(P),
  };
  const candidates: DemoCounts = {
    sourcePayments: sourcePayments.length,
    payments: payments.length,
    bookings: bookings.length,
    vehicleRentals: rentals.length,
    contracts: contracts.length,
    expenses: expenses.length,
    tenants: tenants.length,
    vehicles: vehicles.length,
    properties: properties.length,
  };
  const kept = Object.fromEntries(
    DEMO_ENTITIES.map((k) => [k, candidates[k] - deletable[k].length])
  ) as DemoCounts;
  return { deletable, kept };
}

async function lockRows(db: Db, table: string, set: Set<string>) {
  if (set.size === 0) return;
  // Table names are fixed literals above; ids are bound parameters.
  await db.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = ANY($1::text[]) FOR UPDATE`, ids(set));
}

export type DemoClearResult = {
  alreadyCleared: boolean;
  deleted: DemoCounts;
  kept: DemoCounts;
  demoDataClearedAt: string;
};

/**
 * Deletes seeded demo data of the given workspace in FK-safe order and marks the
 * workspace so the seed never runs again. Workspace, users, industry and plan stay.
 */
export async function clearDemoData(
  db: Db,
  workspaceId: string,
  now: Date = new Date()
): Promise<DemoClearResult | { error: "NO_DEMO_DATA" | "NOT_FOUND" }> {
  // Same lock the seed takes, so seed and clear can never interleave.
  await db.$queryRaw`SELECT id FROM workspace_subscriptions WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, createdAt: true, demoSeededAt: true, demoDataClearedAt: true },
  });
  if (!ws) return { error: "NOT_FOUND" };
  if (ws.demoDataClearedAt) {
    return {
      alreadyCleared: true,
      deleted: zeroDemoCounts(),
      kept: zeroDemoCounts(),
      demoDataClearedAt: ws.demoDataClearedAt.toISOString(),
    };
  }

  const { deletable, kept } = await findDemoRecords(db, ws, { lock: true });
  const total = DEMO_ENTITIES.reduce((s, k) => s + deletable[k].length + kept[k], 0);
  if (total === 0 && !ws.demoSeededAt) return { error: "NO_DEMO_DATA" };

  const scoped = (list: string[]) => ({ id: { in: list }, workspaceId });
  const deleted = zeroDemoCounts();
  deleted.sourcePayments = (await db.sourcePayment.deleteMany({ where: scoped(deletable.sourcePayments) })).count;
  deleted.payments = (await db.payment.deleteMany({ where: scoped(deletable.payments) })).count;
  deleted.bookings = (await db.booking.deleteMany({ where: scoped(deletable.bookings) })).count;
  deleted.vehicleRentals = (await db.vehicleRental.deleteMany({ where: scoped(deletable.vehicleRentals) })).count;
  deleted.contracts = (await db.contract.deleteMany({ where: scoped(deletable.contracts) })).count;
  deleted.expenses = (await db.expense.deleteMany({ where: scoped(deletable.expenses) })).count;
  deleted.tenants = (await db.tenant.deleteMany({ where: scoped(deletable.tenants) })).count;
  deleted.vehicles = (await db.vehicle.deleteMany({ where: scoped(deletable.vehicles) })).count;
  deleted.properties = (await db.property.deleteMany({ where: scoped(deletable.properties) })).count;

  await db.workspace.update({ where: { id: workspaceId }, data: { demoDataClearedAt: now } });
  return { alreadyCleared: false, deleted, kept, demoDataClearedAt: now.toISOString() };
}
