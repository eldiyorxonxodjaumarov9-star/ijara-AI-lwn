import { NextRequest } from "next/server";

import { ok } from "@/lib/api-server/http";
import { requirePlatformAdmin, toPublicPlatformAdmin } from "@/lib/api-server/platform-admin/guard";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;

  const res = ok({ admin: toPublicPlatformAdmin(auth.admin) });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
