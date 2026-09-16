import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { requireAnyStaffUser } from "@/lib/api-server/rbac";
import {
  getListingTelegramJobs,
} from "@/lib/api-server/telegram-distribution/telegram-distribution-service";
import { getListingTelegramLogs } from "@/lib/api-server/telegram-distribution/telegram-logs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

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
