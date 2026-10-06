import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { loadPlatformDashboard } from "@/lib/api-server/platform-admin/dashboard";
import { requirePlatformAdmin } from "@/lib/api-server/platform-admin/guard";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (auth.error) return auth.error;

  try {
    const res = ok(await loadPlatformDashboard());
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("[super-admin/dashboard] failed", (err as Error)?.message ?? "unknown");
    return fail("Dashboard ma’lumotlarini yuklab bo‘lmadi", 500);
  }
}
