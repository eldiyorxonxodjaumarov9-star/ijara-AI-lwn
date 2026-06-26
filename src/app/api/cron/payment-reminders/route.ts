import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  computeServerDebts,
  sendTelegramPaymentReminders,
} from "@/lib/api-server/telegram-reminders";
import { sendAdminReportsToAll } from "@/lib/api-server/telegram-admin";
import type { ReminderTimeSlot } from "@/lib/payment-reminder-utils";

const VALID_SLOTS: ReminderTimeSlot[] = ["morning", "lunch", "evening"];

const SLOT_LABEL: Record<ReminderTimeSlot, string> = {
  morning: "08:00 (ertalab)",
  lunch: "13:00 (abet)",
  evening: "20:00 (kechqurun)",
};

function parseSlot(req: NextRequest): ReminderTimeSlot | null {
  const raw = req.nextUrl.searchParams.get("slot")?.trim();
  if (!raw) return null;
  return VALID_SLOTS.includes(raw as ReminderTimeSlot)
    ? (raw as ReminderTimeSlot)
    : null;
}

/** Kunlik avtomatik to'lov eslatmasi — Telegram bot (Vercel Cron, Toshkent vaqti) */
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

  const slot = parseSlot(req);
  if (!slot) {
    return fail("slot=morning|lunch|evening kerak", 400);
  }

  try {
    const debts = await computeServerDebts();
    const telegram = await sendTelegramPaymentReminders(debts, slot);
    const adminTelegram = await sendAdminReportsToAll(SLOT_LABEL[slot]);

    return ok({
      slot,
      timeLabel: SLOT_LABEL[slot],
      timezone: "Asia/Tashkent",
      debtors: debts.length,
      telegram,
      adminTelegram,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron xatosi";
    return fail(message, 500);
  }
}
