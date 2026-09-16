import { NextRequest } from "next/server";

import { ok } from "@/lib/api-server/http";
import { getInstagramStaffStatus } from "@/lib/api-server/integrations/instagram-service";
import { requireAnyStaffUser } from "@/lib/api-server/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

  return ok(await getInstagramStaffStatus());
}
