import { fail, ok } from "@/lib/api-server/http";
import { processTelegramQueue } from "@/lib/api-server/telegram-distribution/telegram-queue";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && auth !== `Bearer ${secret}`) {
    return fail("Unauthorized", 401);
  }

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
