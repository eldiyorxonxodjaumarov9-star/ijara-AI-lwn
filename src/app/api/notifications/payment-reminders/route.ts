import { NextRequest } from "next/server";

import { requireStaffUser } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  groupDebtsByTenant,
  sendPaymentReminders,
} from "@/lib/api-server/payment-reminders";
import { computeManualDebtReminders } from "@/lib/api-server/manual-debts";
import { computeServerDebts } from "@/lib/api-server/telegram-reminders";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

/**
 * Admin: workspace'dagi barcha qarzdorlarga (joriy + o'tgan oylar) to'lov eslatmasi.
 * Qarzlar serverda shu workspace bo'yicha hisoblanadi — client yuborgan ro'yxatga ishonilmaydi.
 * `dryRun: true` — hech narsa yubormasdan kimga yuborilishini qaytaradi.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const ctx = await resolveUserWorkspaceContext(auth.user);
    if (!ctx.hasAccess) {
      return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
    }
    const workspaceId = ctx.workspace.id;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const debts = await computeServerDebts({ workspaceId });
    const manualDebts = await computeManualDebtReminders({ workspaceId });
    const recipients = groupDebtsByTenant(debts);

    if (body.dryRun === true) {
      return ok({
        dryRun: true,
        debtorContracts: debts.length,
        recipients: recipients.length + manualDebts.length,
        totalDebt:
          debts.reduce((s, d) => s + d.debt, 0) +
          manualDebts.reduce((s, m) => s + m.remainingAmount, 0),
        debts,
        manualDebts: manualDebts.map(({ chatId, ...m }) => ({ ...m, telegramLinked: !!chatId })),
      });
    }

    if (debts.length === 0 && manualDebts.length === 0) {
      return ok({
        sent: 0,
        telegramSent: 0,
        telegramSkipped: 0,
        telegramFailed: 0,
        message: "Qarzdorlar topilmadi",
      });
    }

    const { notifications, telegram } = await sendPaymentReminders(debts, {
      workspaceId,
      adminUserId: auth.user.id,
      manualDebts,
    });
    const tenantCount = notifications.filter(
      (n) => n.type === "LATE_PAYMENT"
    ).length;
    return ok({
      sent: tenantCount,
      telegramSent: telegram.sent,
      telegramSkipped: telegram.skipped,
      telegramFailed: telegram.failed,
      data: notifications,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Xabar yuborish xatosi";
    return fail(message, 500);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  return ok({
    sampleMessage: buildPaymentReminderMessage({
      tenantName: "Arendator",
      propertyName: "Live Work Network",
      debt: 1600000,
      unpaidMonths: 2,
      oldestUnpaidDueDate: "2026-08-05",
      overdueDays: 62,
    }),
  });
}
