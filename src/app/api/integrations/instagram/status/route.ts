import { NextRequest } from "next/server";

import { ok } from "@/lib/api-server/http";
import { getInstagramPublicStatus } from "@/lib/api-server/integrations/instagram-service";

export async function GET() {
  const status = await getInstagramPublicStatus();
  return ok(status);
}
