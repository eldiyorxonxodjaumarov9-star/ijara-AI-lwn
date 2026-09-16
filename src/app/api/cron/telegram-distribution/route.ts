import { assertFailClosedCronAuth } from "@/lib/api-server/cron-auth";
import { fail, ok } from "@/lib/api-server/http";
import { processTelegramQueue } from "@/lib/api-server/telegram-distribution/telegram-queue";

export async function GET(req: Request) {
  const denied = assertFailClosedCronAuth(req);
  if (denied) return denied;

  try {
    const results = await processTelegramQueue({ limit: 20 });
    return ok({
      processed: results.length,
      timezone: "Asia/Tashkent",
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Cron xatosi", 500);
  }
}
