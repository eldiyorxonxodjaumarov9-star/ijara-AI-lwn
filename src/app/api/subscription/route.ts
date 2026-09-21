import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { PLANS, normalizePlan } from "@/lib/api-server/plans";
import { getPlanUsage, planErrorResponse, selectPlan } from "@/lib/api-server/plan-service";
import { resolveUserWorkspaceContext, toPublicSubscriptionView } from "@/lib/api-server/workspace";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const ctx = await resolveUserWorkspaceContext(auth.user);
  return ok({ catalog: Object.values(PLANS), workspace: toPublicSubscriptionView(ctx), usage: await getPlanUsage(ctx.workspace.id) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Object.keys(body).some(key => key !== "plan") || !("plan" in body) || typeof body.plan !== "string") return fail("Faqat tarifni tanlang", 400);
  const plan = normalizePlan(body.plan);
  if (!plan) return fail("Tarif noto‘g‘ri", 400);
  const ctx = await resolveUserWorkspaceContext(auth.user);
  try { return ok(await selectPlan(ctx, plan)); }
  catch (error) { return planErrorResponse(error) ?? fail("Tarifni saqlashda xatolik", 500); }
}
