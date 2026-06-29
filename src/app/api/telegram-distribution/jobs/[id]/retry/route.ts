import { fail, ok } from "@/lib/api-server/http";
import { retryTelegramJob } from "@/lib/api-server/telegram-distribution/telegram-distribution-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const job = await retryTelegramJob(id);
    return ok(job);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Qayta yuborish xatosi", 500);
  }
}
