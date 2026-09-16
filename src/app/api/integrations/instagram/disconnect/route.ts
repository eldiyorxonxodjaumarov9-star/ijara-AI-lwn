import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { disconnectInstagram } from "@/lib/api-server/integrations/instagram-service";
import { requireStaffUser } from "@/lib/api-server/rbac";

export async function POST(req: NextRequest) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    await disconnectInstagram();
    return ok({ disconnected: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Uzish xatosi";
    return fail(message, 500);
  }
}
