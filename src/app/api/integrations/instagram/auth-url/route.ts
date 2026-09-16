import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  getInstagramAuthUrl,
  InstagramError,
} from "@/lib/api-server/integrations/instagram-service";
import { requireStaffUser } from "@/lib/api-server/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const state = new URL(req.url).searchParams.get("state") ?? undefined;
    const url = getInstagramAuthUrl(state);
    return ok({ url });
  } catch (err) {
    const message =
      err instanceof InstagramError ? err.message : "Auth URL yaratilmadi";
    return fail(message, 400);
  }
}
