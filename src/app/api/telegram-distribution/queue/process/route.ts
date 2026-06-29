import { fail, ok } from "@/lib/api-server/http";
import { processTelegramQueue } from "@/lib/api-server/telegram-distribution/telegram-queue";

export async function POST() {
  try {
    const results = await processTelegramQueue({ limit: 10 });
    return ok({ processed: results.length });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Navbat xatosi", 500);
  }
}
