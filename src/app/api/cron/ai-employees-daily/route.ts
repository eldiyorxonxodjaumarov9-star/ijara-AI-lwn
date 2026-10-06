import { usageLoaderFor, workspaceContextForCron } from "@/lib/api-server/ai-agents/access";
import { readDeepSeekConfig } from "@/lib/api-server/ai-agents/deepseek";
import { runDailyReport } from "@/lib/api-server/ai-agents/run-agent";
import { assertFailClosedCronAuth } from "@/lib/api-server/cron-auth";
import { fail, ok } from "@/lib/api-server/http";
import { planEntitlements } from "@/lib/api-server/plans";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export const maxDuration = 300;

function tashkentHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "numeric", hour12: false }).format(now));
}

/**
 * Scheduled at 03:00 UTC (08:00 Asia/Tashkent): each workspace whose AI
 * Employees are on and whose report hour is now gets a DeepSeek report built
 * from its own current data. Idempotent per workspace per day.
 */
export async function GET(req: Request) {
  const denied = assertFailClosedCronAuth(req);
  if (denied) return denied;
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  if (!readDeepSeekConfig()) return ok({ processed: 0, skipped: "DEEPSEEK_NOT_CONFIGURED" });

  const hour = tashkentHour();
  const due = await prisma.agentSettings.findMany({
    where: { workspaceId: { not: null }, masterEnabled: true, dailyReportHour: hour },
  });

  const results: { status: string }[] = [];
  for (const settings of due) {
    const workspaceId = settings.workspaceId!;
    try {
      const wsCtx = await workspaceContextForCron(workspaceId);
      if (!wsCtx || !wsCtx.hasAccess || !planEntitlements(wsCtx).features.aiEmployees) {
        results.push({ status: "skipped" });
        continue;
      }
      const outcome = await runDailyReport({
        workspaceId,
        trigger: "SCHEDULE",
        dryRun: settings.dryRunDefault,
        settings,
        loadUsageAnalytics: usageLoaderFor(wsCtx),
      });
      results.push({ status: outcome.status });
    } catch (err) {
      console.error("[cron/ai-employees-daily] workspace failed", err instanceof Error ? err.message : "unknown");
      results.push({ status: "error" });
    }
  }

  return ok({
    hour,
    timezone: "Asia/Tashkent",
    processed: results.length,
    completed: results.filter((r) => r.status === "completed").length,
    failed: results.filter((r) => r.status === "failed" || r.status === "error").length,
  });
}
