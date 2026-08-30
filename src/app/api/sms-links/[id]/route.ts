import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  deleteSmsLinkRow,
  findSmsLinkById,
  isSmsLinksDbReady,
  listSmsLinks,
  settingsFromBody,
  updateSmsLinkRow,
} from "@/lib/api-server/sms-links";
import type { SmsNotificationSettings } from "@/types/sms-notifications";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (!(await isSmsLinksDbReady())) {
    return fail("sms_tenant_links jadvalini yaratib bo'lmadi", 501);
  }

  const { id } = await ctx.params;
  if (!id) return fail("ID kerak", 400);

  try {
    const body = (await req.json()) as {
      smsEnabled?: boolean;
      settings?: Partial<SmsNotificationSettings>;
    };

    const existing = await findSmsLinkById(id);
    if (!existing) return fail("Biriktirish topilmadi", 404);

    const settings = body.settings
      ? settingsFromBody(body.settings, existing.settings)
      : existing.settings;

    const updated = await updateSmsLinkRow(id, {
      smsEnabled: body.smsEnabled,
      settings,
    });
    if (!updated) return fail("Biriktirish topilmadi", 404);
    return ok(updated);
  } catch {
    return fail("Yangilashda xatolik", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (!(await isSmsLinksDbReady())) {
    return fail("sms_tenant_links jadvalini yaratib bo'lmadi", 501);
  }

  const { id } = await ctx.params;
  if (!id) return fail("ID kerak", 400);

  try {
    const deleted = await deleteSmsLinkRow(id);
    if (!deleted) return fail("Biriktirish topilmadi", 404);
    return ok({ id, data: await listSmsLinks() });
  } catch {
    return fail("O'chirishda xatolik", 500);
  }
}
