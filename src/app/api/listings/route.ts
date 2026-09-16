import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { getListingsByEmail } from "@/lib/api-server/posting/posting-service";
import { requireAnyStaffUser } from "@/lib/api-server/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

  const email = new URL(req.url).searchParams.get("landlordEmail");
  if (!email?.trim()) {
    return fail("landlordEmail parametri kerak", 400);
  }

  try {
    const listings = await getListingsByEmail(email.trim());
    return ok(listings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Yuklash xatosi";
    return fail(message, 500);
  }
}
