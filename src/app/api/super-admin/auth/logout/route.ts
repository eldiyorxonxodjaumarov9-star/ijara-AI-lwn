import { ok } from "@/lib/api-server/http";
import {
  PLATFORM_ADMIN_COOKIE,
  platformAdminCookieOptions,
} from "@/lib/api-server/platform-admin/session";

export async function POST() {
  const res = ok({ loggedOut: true });
  res.cookies.set(PLATFORM_ADMIN_COOKIE, "", { ...platformAdminCookieOptions(0), expires: new Date(0) });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
