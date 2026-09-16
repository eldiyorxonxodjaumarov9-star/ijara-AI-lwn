import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { requireStaffUser } from "@/lib/api-server/rbac";
import {
  deleteTelegramChannel,
  updateTelegramChannel,
} from "@/lib/api-server/telegram-distribution/telegram-distribution-service";
import type { TelegramChannelInput } from "@/lib/telegram-distribution/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<TelegramChannelInput>;
    const channel = await updateTelegramChannel(id, body);
    return ok(channel);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Xato", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    await deleteTelegramChannel(id);
    return ok({ ok: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Xato", 500);
  }
}
