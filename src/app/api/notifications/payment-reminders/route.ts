import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  buildPaymentReminderMessage,
  sendPaymentReminders,
  type DebtReminderInput,
} from "@/lib/api-server/payment-reminders";

function monthsBetween(from: Date, to: Date) {
  if (to < from) return 0;
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

function computeServerDebts(): Promise<DebtReminderInput[]> {
  return prisma.contract
    .findMany({
      where: { status: { in: ["ACTIVE", "EXPIRED"] } },
      include: { property: true, tenant: true, payments: true },
    })
    .then((contracts) => {
      const now = new Date();
      return contracts
        .map((c) => {
          const start = new Date(c.startDate);
          const end = new Date(c.endDate);
          const until = now < end ? now : end;
          const monthsDue = Math.max(1, monthsBetween(start, until) + 1);
          const expected = monthsDue * c.monthlyRent;
          const paid = c.payments.reduce((sum, p) => sum + p.amount, 0);
          return {
            contractId: c.id,
            tenantId: c.tenantId,
            tenantName: c.tenant.fullName,
            propertyName: c.property.title,
            debt: expected - paid,
          };
        })
        .filter((d) => d.debt > 0);
    });
}

function parseClientDebts(body: Record<string, unknown>): DebtReminderInput[] | null {
  if (!Array.isArray(body.debts)) return null;
  return body.debts
    .map((row) => {
      const d = row as Record<string, unknown>;
      return {
        contractId: String(d.contractId ?? ""),
        tenantId: d.tenantId ? String(d.tenantId) : undefined,
        tenantName: String(d.tenantName ?? ""),
        propertyName: String(d.propertyName ?? ""),
        debt: Number(d.debt ?? 0),
      };
    })
    .filter((d) => d.debt > 0 && d.tenantName);
}

/** Admin: barcha qarzdorlarga to'lov eslatmasi yuborish */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const debts = parseClientDebts(body) ?? (await computeServerDebts());

    if (debts.length === 0) {
      return ok({ sent: 0, message: "Qarzdorlar topilmadi" });
    }

    const sent = await sendPaymentReminders(debts, auth.user.id);
    const tenantCount = sent.filter(
      (n) => n.type === "LATE_PAYMENT"
    ).length;
    return ok({ sent: tenantCount, data: sent });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Xabar yuborish xatosi";
    return fail(message, 500);
  }
}

export async function GET() {
  return ok({
    sampleMessage: buildPaymentReminderMessage({
      tenantName: "Arendator",
      propertyName: "Live Work Network",
      debt: 5000000,
    }),
  });
}
