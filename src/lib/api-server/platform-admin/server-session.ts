import { cookies } from "next/headers";

import { resolvePlatformAdminSession, toPublicPlatformAdmin, type PublicPlatformAdmin } from "./guard";
import { PLATFORM_ADMIN_COOKIE } from "./session";

/** For Server Components: the signed-in platform admin, or null. */
export async function getCurrentPlatformAdmin(): Promise<PublicPlatformAdmin | null> {
  try {
    const store = await cookies();
    const admin = await resolvePlatformAdminSession(store.get(PLATFORM_ADMIN_COOKIE)?.value);
    return admin ? toPublicPlatformAdmin(admin) : null;
  } catch {
    return null;
  }
}
