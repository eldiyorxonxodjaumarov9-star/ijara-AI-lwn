import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { requireStaffUser } from "@/lib/api-server/rbac";
import { verifyChannelBotAdmin } from "@/lib/api-server/telegram-distribution/telegram-distribution-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const result = await verifyChannelBotAdmin(id);
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Tekshirish xatosi", 500);
  }
}
