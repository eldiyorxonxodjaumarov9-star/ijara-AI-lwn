import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  computeServerDebts,
} from "@/lib/api-server/telegram-reminders";
import { sendPaymentReminders } from "@/lib/api-server/payment-reminders";

/** Kunlik avtomatik to'lov eslatmasi (Vercel Cron) */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return fail("Ruxsat yo'q", 403);
    }
  }

  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    const debts = await computeServerDebts();
    const platform = await sendPaymentReminders(debts);

    return ok({
      debtors: debts.length,
      platformNotifications: platform.filter((n) => n.type === "LATE_PAYMENT")
        .length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron xatosi";
    return fail(message, 500);
  }
}
