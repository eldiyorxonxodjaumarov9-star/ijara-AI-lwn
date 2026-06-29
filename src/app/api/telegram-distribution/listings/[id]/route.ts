import { fail, ok } from "@/lib/api-server/http";
import {
  getListingTelegramJobs,
} from "@/lib/api-server/telegram-distribution/telegram-distribution-service";
import { getListingTelegramLogs } from "@/lib/api-server/telegram-distribution/telegram-logs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [jobs, logs] = await Promise.all([
      getListingTelegramJobs(id),
      getListingTelegramLogs(id),
    ]);
    return ok({ jobs, logs });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Xato", 500);
  }
}
