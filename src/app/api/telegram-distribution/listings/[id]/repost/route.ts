import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { requireStaffUser } from "@/lib/api-server/rbac";
import { bulkRepostListing } from "@/lib/api-server/telegram-distribution/telegram-distribution-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const jobs = await bulkRepostListing(id);
    return ok(jobs);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Qayta tarqatish xatosi", 500);
  }
}
