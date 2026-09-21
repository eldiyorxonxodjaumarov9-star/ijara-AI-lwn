import type { Prisma, User } from "@prisma/client";
import { prisma } from "./prisma";
import { evaluateSubscriptionAccess, resolveUserWorkspaceContext, type WorkspaceContext } from "./workspace";
import { assertPlanFeature, assertPlanLimit, featureForApiPath, PLANS, PlanError, type Plan, type Quota } from "./plans";
import { fail } from "./http";

export function planErrorResponse(error: unknown) {
  return error instanceof PlanError ? fail(error.message, error.status, error.code) : null;
}

export async function checkRequestFeature(user: User, pathname: string) {
  const feature = featureForApiPath(pathname);
  if (!feature) return null;
  const ctx = await resolveUserWorkspaceContext(user);
  try { assertPlanFeature(ctx, feature); } catch (error) { return planErrorResponse(error); }
  return null;
}

export async function getPlanUsage(workspaceId: string, db: Prisma.TransactionClient = prisma) {
  const where = { workspaceId };
  const [properties, tenants, employees] = await Promise.all([
    db.property.count({ where }), db.tenant.count({ where }), db.employee.count({ where }),
  ]);
  return { properties, tenants, employees };
}

async function lockSubscription(db: Prisma.TransactionClient, workspaceId: string) {
  // Both quota writes and plan changes serialize on the same row.
  await db.$queryRaw`SELECT id FROM workspace_subscriptions WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
  return db.workspaceSubscription.findUnique({ where: { workspaceId } });
}

export async function createWithinPlanLimit<T>(ctx: WorkspaceContext, resource: Quota, create: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async db => {
    const subscription = await lockSubscription(db, ctx.workspace.id);
    const access = evaluateSubscriptionAccess({ isInternal: ctx.isInternal, subscription });
    const usage = await getPlanUsage(ctx.workspace.id, db);
    assertPlanLimit({ ...ctx, subscription, ...access }, resource, usage[resource]);
    return create(db);
  });
}

export async function selectPlan(ctx: WorkspaceContext, plan: Plan) {
  if (ctx.isInternal) return { nextUrl: "/dashboard", paymentRequired: false };
  if (ctx.membershipRole !== "OWNER") throw new PlanError("Tarifni faqat workspace egasi tanlaydi", "FORBIDDEN");
  if (plan !== "FREE") {
    // No payment provider exists yet. This is navigation, never an activation.
    return { nextUrl: `/settings?tab=subscription&pending=${plan}`, paymentRequired: true };
  }
  await prisma.$transaction(async db => {
    const subscription = await lockSubscription(db, ctx.workspace.id);
    if (subscription?.status === "ACTIVE" && subscription.plan === "FREE") return;
    const usage = await getPlanUsage(ctx.workspace.id, db);
    // Reject an over-limit downgrade; never remove existing data to make it fit.
    for (const resource of ["properties", "tenants", "employees"] as const) {
      if (usage[resource] > PLANS.FREE.limits[resource]!) {
        throw new PlanError("Mavjud ma’lumotlar Free limitidan oshadi. Pro yoki Premium tarifini tanlang; ma’lumotlaringiz saqlanadi.", "PLAN_LIMIT_REACHED");
      }
    }
    const now = new Date();
    await db.workspaceSubscription.upsert({
      where: { workspaceId: ctx.workspace.id },
      create: { workspaceId: ctx.workspace.id, plan: "FREE", status: "ACTIVE", currentPeriodStart: now },
      update: { plan: "FREE", status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: null },
    });
  });
  return { nextUrl: "/dashboard", paymentRequired: false };
}
