import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  buildEmployeeSalaryMessage,
  sendEmployeeSalaryRemindersToAll,
} from "@/lib/api-server/telegram-admin";

function allowCronOrUser(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${cronSecret}`) return { ok: true as const };
  }
  return null;
}

/** Admin/bot: ishchilar oyligi jadvalini Telegramga yuborish (test ham) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  const cronOk = allowCronOrUser(req);
  if (!cronOk) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const withinDays =
      body.withinDays != null ? Number(body.withinDays) : 31;
    const result = await sendEmployeeSalaryRemindersToAll(
      Number.isFinite(withinDays) ? withinDays : 31
    );

    if (result.chatIds === 0) {
      return ok({
        ...result,
        message:
          "Admin Telegram chat topilmadi. Botda /start qilib admin sifatida kiring.",
      });
    }

    return ok({
      ...result,
      message: `${result.sent} ta chatga oylik jadvali yuborildi (${result.dueCount} ta ishchi).`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Oylik xabarini yuborish xatosi";
    return fail(message, 500);
  }
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  const cronOk = allowCronOrUser(req);
  if (!cronOk) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
  }

  const within = Number(req.nextUrl.searchParams.get("withinDays") ?? 31);
  const preview = await buildEmployeeSalaryMessage(
    Number.isFinite(within) ? within : 31
  );
  return ok({ preview });
}
