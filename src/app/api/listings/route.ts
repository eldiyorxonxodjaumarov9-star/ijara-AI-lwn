import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { getListingsByEmail } from "@/lib/api-server/posting/posting-service";

export async function GET(req: NextRequest) {
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
