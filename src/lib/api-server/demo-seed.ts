import { randomInt, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

import { resolveAccessPlan } from "@/lib/plan-features";

import { buildDemoSeedPlan, type DemoSeedPlan } from "./demo-seed-plan";
import { getPlanLimits } from "./plans";
import { prisma } from "./prisma";

export type DemoSeedResult =
  | { seeded: true; industry: DemoSeedPlan["industry"]; counts: Record<string, number> }
  | { seeded: false; reason: "NOT_FOUND" | "NOT_DEMO" | "NOT_EMPTY" };

type SeedClient = Pick<PrismaClient, "$transaction">;

/**
 * Seeds industry demo data into a freshly created DEMO workspace.
 * Industry and plan are read from the database, never from the caller.
 * Idempotent: the workspace must be empty (incl. vehicles), checked under a row lock.
 */
export async function seedDemoWorkspace(
  { workspaceId, now = new Date() }: { workspaceId: string; now?: Date },
  client: SeedClient = prisma
): Promise<DemoSeedResult> {
  return client.$transaction(
    async (db) => {
      await db.$queryRaw`SELECT id FROM workspace_subscriptions WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, industry: true, isInternal: true, subscription: { select: { status: true, plan: true } } },
      });
      if (!workspace) return { seeded: false, reason: "NOT_FOUND" };

      const sub = workspace.subscription;
      const isDemo =
        !workspace.isInternal &&
        sub?.status === "DEMO" &&
        resolveAccessPlan(sub.plan, { isInternal: workspace.isInternal }) === "DEMO";
      if (!isDemo) return { seeded: false, reason: "NOT_DEMO" };

      if (await hasBusinessData(db, workspaceId)) return { seeded: false, reason: "NOT_EMPTY" };

      const plan = buildDemoSeedPlan(workspace.industry, now, getPlanLimits("FREE"), randomInt(1_000_000));
      const counts = await writePlan(db, workspaceId, plan);
      return { seeded: true, industry: plan.industry, counts };
    },
    { timeout: 20_000 }
  );
}

async function hasBusinessData(db: Prisma.TransactionClient, workspaceId: string) {
  const where = { workspaceId };
  const counts = await Promise.all([
    db.property.count({ where }),
    db.tenant.count({ where }),
    db.contract.count({ where }),
    db.payment.count({ where }),
    db.expense.count({ where }),
    db.vehicle.count({ where }),
    db.vehicleRental.count({ where }),
    db.booking.count({ where }),
    db.sourcePayment.count({ where }),
  ]);
  return counts.some((n) => n > 0);
}

async function writePlan(db: Prisma.TransactionClient, workspaceId: string, plan: DemoSeedPlan) {
  const ids = new Map<string, string>();
  const idFor = (key: string) => {
    let id = ids.get(key);
    if (!id) {
      id = randomUUID();
      ids.set(key, id);
    }
    return id;
  };

  if (plan.properties.length) {
    await db.property.createMany({
      data: plan.properties.map(({ key, ...p }) => ({ ...p, id: idFor(key), workspaceId })),
    });
  }
  if (plan.tenants.length) {
    await db.tenant.createMany({
      data: plan.tenants.map(({ key, ...t }) => ({ ...t, id: idFor(key), workspaceId })),
    });
  }
  if (plan.contracts.length) {
    await db.contract.createMany({
      data: plan.contracts.map(({ key, propertyKey, tenantKey, ...c }) => ({
        ...c,
        id: idFor(key),
        propertyId: idFor(propertyKey),
        tenantId: idFor(tenantKey),
        workspaceId,
      })),
    });
  }
  if (plan.payments.length) {
    await db.payment.createMany({
      data: plan.payments.map(({ contractKey, ...p }) => ({
        ...p,
        contractId: idFor(contractKey),
        workspaceId,
      })),
    });
  }
  if (plan.expenses.length) {
    await db.expense.createMany({
      data: plan.expenses.map((e) => ({ ...e, workspaceId })),
    });
  }

  if (plan.vehicles.length) {
    await db.vehicle.createMany({
      data: plan.vehicles.map(({ key, ...v }) => ({ ...v, id: idFor(key), workspaceId })),
    });
  }
  if (plan.rentals.length) {
    await db.vehicleRental.createMany({
      data: plan.rentals.map(({ key, vehicleKey, tenantKey, ...r }) => ({
        ...r,
        id: idFor(key),
        vehicleId: idFor(vehicleKey),
        tenantId: idFor(tenantKey),
        workspaceId,
      })),
    });
  }

  if (plan.bookings.length) {
    await db.booking.createMany({
      data: plan.bookings.map(({ key, propertyKey, tenantKey, ...b }) => ({
        ...b,
        id: idFor(key),
        propertyId: idFor(propertyKey),
        tenantId: idFor(tenantKey),
        workspaceId,
      })),
    });
  }

  if (plan.sourcePayments.length) {
    await db.sourcePayment.createMany({
      data: plan.sourcePayments.map(({ sourceKey, ...p }) => ({
        ...p,
        ...(p.sourceType === "VEHICLE_RENTAL"
          ? { vehicleRentalId: idFor(sourceKey) }
          : { bookingId: idFor(sourceKey) }),
        workspaceId,
      })),
    });
  }

  return {
    properties: plan.properties.length,
    tenants: plan.tenants.length,
    contracts: plan.contracts.length,
    payments: plan.payments.length,
    expenses: plan.expenses.length,
    vehicles: plan.vehicles.length,
    rentals: plan.rentals.length,
    bookings: plan.bookings.length,
    sourcePayments: plan.sourcePayments.length,
  };
}
