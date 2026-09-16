import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { testInstagramConnection } from "@/lib/api-server/integrations/instagram-service";
import { requireStaffUser } from "@/lib/api-server/rbac";

export async function POST(req: NextRequest) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  const result = await testInstagramConnection();
  if (!result.ok) {
    return fail(result.message, 400);
  }
  return ok(result);
}
