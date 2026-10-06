import type { Prisma, Workspace } from "@prisma/client";
import { prisma } from "@/lib/api-server/prisma";
import {
  DEMO_SEED_CUSTOMER_NAMES,
  DEMO_SEED_NOTE,
} from "@/lib/api-server/demo-seed-plan";
import { computeServerDebts } from "@/lib/api-server/telegram-reminders";
import type { DataDetectableFeature } from "@/lib/usage-analytics";

const DEMO_WINDOW_BEFORE_MS = 5 * 60 * 1000;
const DEMO_WINDOW_AFTER_MS = 30 * 60 * 1000;
const DEMO_TENANT_PHONE_PREFIX = "+99890000";

type DemoWorkspace = Pick<Workspace, "id" | "createdAt" | "demoSeededAt">;

/**
 * Real-record predicates per model. A row counts as demo seed only when it
 * carries the seed marker AND was created inside the seeding window — the same
 * rule `clearWorkspaceDemoData` uses. Marker columns are nullable, so NULL is
 * matched explicitly (SQL `NOT (col = x)` would silently drop NULL rows).
 */
type CreatedAtClause = { createdAt: { lt?: Date; gt?: Date } };
type NotesWhere = { OR?: Array<{ notes: null } | { notes: { not: string } } | CreatedAtClause> };

export function realRecordFilters(ws: DemoWorkspace): {
  property: Prisma.PropertyWhereInput;
  tenant: Prisma.TenantWhereInput;
  notes: NotesWhere;
} {
  if (!ws.demoSeededAt) return { property: {}, tenant: {}, notes: {} };
  const anchor = ws.demoSeededAt.getTime();
  const outsideWindow: CreatedAtClause[] = [
    { createdAt: { lt: new Date(anchor - DEMO_WINDOW_BEFORE_MS) } },
    { createdAt: { gt: new Date(anchor + DEMO_WINDOW_AFTER_MS) } },
  ];
  return {
    property: {
      OR: [{ description: null }, { description: { not: DEMO_SEED_NOTE } }, ...outsideWindow],
    },
    tenant: {
      OR: [
        { fullName: { notIn: [...DEMO_SEED_CUSTOMER_NAMES] } },
        { NOT: { phone: { startsWith: DEMO_TENANT_PHONE_PREFIX } } },
        ...outsideWindow,
      ],
    },
    notes: {
      OR: [{ notes: null }, { notes: { not: DEMO_SEED_NOTE } }, ...outsideWindow],
    },
  };
}

const EXISTS = { select: { id: true } } as const;

/**
 * Which feature keys have at least one real (non-demo) record in this workspace.
 * One bounded `findFirst` per requested feature, all in a single `Promise.all`;
 * the canonical-debt fallback runs only when no explicit debt rows exist.
 */
export async function detectDataFeatures(
  ws: DemoWorkspace,
  wanted: readonly DataDetectableFeature[],
  db = prisma
): Promise<Set<DataDetectableFeature>> {
  const workspaceId = ws.id;
  const f = realRecordFilters(ws);
  const want = new Set(wanted);

  const checks: Record<DataDetectableFeature, () => Promise<boolean>> = {
    properties: async () =>
      !!(await db.property.findFirst({ where: { workspaceId, ...f.property }, ...EXISTS })),
    tenants: async () =>
      !!(await db.tenant.findFirst({ where: { workspaceId, ...f.tenant }, ...EXISTS })),
    contracts: async () =>
      !!(await db.contract.findFirst({ where: { workspaceId, ...f.notes }, ...EXISTS })),
    bookings: async () =>
      !!(await db.booking.findFirst({ where: { workspaceId, ...f.notes }, ...EXISTS })),
    vehicles: async () =>
      !!(await db.vehicle.findFirst({ where: { workspaceId, ...f.notes }, ...EXISTS })),
    vehicle_rentals: async () =>
      !!(await db.vehicleRental.findFirst({ where: { workspaceId, ...f.notes }, ...EXISTS })),
    payments: async () => {
      const [payment, sourcePayment] = await Promise.all([
        db.payment.findFirst({ where: { workspaceId, ...f.notes }, ...EXISTS }),
        db.sourcePayment.findFirst({ where: { workspaceId, ...f.notes }, ...EXISTS }),
      ]);
      return !!(payment || sourcePayment);
    },
    debts: async () => {
      const [manualDebt, adjustment] = await Promise.all([
        db.manualDebt.findFirst({ where: { workspaceId }, ...EXISTS }),
        db.debtAdjustment.findFirst({ where: { workspaceId }, ...EXISTS }),
      ]);
      if (manualDebt || adjustment) return true;
      try {
        const debts = (await computeServerDebts({ workspaceId }, db)).filter((d) => d.debt > 0);
        if (debts.length === 0 || !ws.demoSeededAt) return debts.length > 0;
        const real = await db.contract.findMany({
          where: { workspaceId, id: { in: debts.map((d) => d.contractId) }, ...f.notes },
          select: { id: true },
        });
        return real.length > 0;
      } catch (error) {
        console.error("[usage-analytics] canonical debt detection failed", error);
        return false;
      }
    },
    expenses: async () =>
      !!(await db.expense.findFirst({ where: { workspaceId, ...f.notes }, ...EXISTS })),
    tasks: async () =>
      !!(await db.workTask.findFirst({ where: { workspaceId }, ...EXISTS })),
  };

  const keys = [...want];
  const results = await Promise.all(keys.map((key) => checks[key]()));
  return new Set(keys.filter((_, i) => results[i]));
}
