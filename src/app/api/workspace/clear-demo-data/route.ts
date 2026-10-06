import { NextRequest } from "next/server";

import {
  DEMO_ENTITIES,
  clearDemoData,
  demoClearEligibility,
  findDemoRecords,
} from "@/lib/api-server/demo-data-clear";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { requireAdminUser } from "@/lib/api-server/rbac";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

/** Workspace always comes from the session; any workspaceId in the request is ignored. */
async function guard(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if (auth.error) return { error: auth.error };
  const ctx = await resolveUserWorkspaceContext(auth.user);
  const eligibility = demoClearEligibility(
    { isInternal: ctx.isInternal, subscription: ctx.subscription },
    ctx.membershipRole
  );
  return { ctx, eligibility };
}

/** Whether the "clear demo data" action applies, and how much demo data remains. */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const g = await guard(req);
  if (g.error) return g.error;
  const { ctx, eligibility } = g;
  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspace.id },
    select: { id: true, createdAt: true, demoSeededAt: true, demoDataClearedAt: true },
  });
  if (!ws) return fail("Workspace topilmadi", 404);
  if (!eligibility.ok || ws.demoDataClearedAt) {
    return ok({
      eligible: false,
      hasDemoData: false,
      demoDataClearedAt: ws.demoDataClearedAt?.toISOString() ?? null,
      ...(eligibility.ok ? {} : { reason: eligibility.code }),
    });
  }
  const { deletable } = await prisma.$transaction((tx) => findDemoRecords(tx, ws));
  const counts = Object.fromEntries(DEMO_ENTITIES.map((k) => [k, deletable[k].length]));
  const hasDemoData = Object.values(counts).some((n) => n > 0);
  return ok({ eligible: true, hasDemoData, demoDataClearedAt: null, counts });
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const g = await guard(req);
  if (g.error) return g.error;
  const { ctx, eligibility } = g;
  if (!eligibility.ok) return fail(eligibility.message, eligibility.status, eligibility.code);

  try {
    const result = await prisma.$transaction((tx) => clearDemoData(tx, ctx.workspace.id), {
      timeout: 30_000,
    });
    if ("error" in result) {
      return result.error === "NOT_FOUND"
        ? fail("Workspace topilmadi", 404, "NOT_FOUND")
        : fail("Bu workspace’da demo ma’lumotlar topilmadi", 409, "NO_DEMO_DATA");
    }
    return ok(result);
  } catch (err) {
    console.error("[workspace/clear-demo-data] failed", err instanceof Error ? err.name : "unknown");
    return fail("Demo ma’lumotlarni tozalashda xatolik", 500);
  }
}
