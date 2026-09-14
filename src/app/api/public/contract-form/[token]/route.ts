import { NextRequest } from "next/server";

import { processPendingContractDeliveries } from "@/lib/api-server/contract-draft/bot";
import { finalizeContractFromClientForm } from "@/lib/api-server/contract-draft/finalize";
import { hashTokenForLookup } from "@/lib/api-server/contract-draft/bot";
import { recordStatusEvent } from "@/lib/api-server/contract-draft/queries";
import { checkRateLimit } from "@/lib/api-server/contract-draft/rate-limit";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ token: string }> };

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function publicFormView(row: {
  id: string;
  status: string;
  partyCategory: string;
  partySubtype: string;
  serviceName: string;
  areaSqm: number;
  ratePerSqm: number;
  monthCount: number;
  monthlyAmount: number;
  totalAmount: number;
  paymentDueDay: number;
  depositAmount: number;
  startDate: Date;
  endDate: Date;
  contractNumber: string | null;
  clientSnapshot: unknown;
  property: { title: string; address: string };
  tenant: { fullName: string };
}) {
  return {
    status: row.status,
    partyCategory: row.partyCategory,
    partySubtype: row.partySubtype,
    serviceName: row.serviceName,
    areaSqm: row.areaSqm,
    ratePerSqm: row.ratePerSqm,
    monthCount: row.monthCount,
    monthlyAmount: row.monthlyAmount,
    totalAmount: row.totalAmount,
    paymentDueDay: row.paymentDueDay,
    depositAmount: row.depositAmount,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    contractNumber: row.contractNumber,
    propertyTitle: row.property.title,
    propertyAddress: row.property.address,
    tenantNameHint: row.tenant.fullName,
    clientSnapshot:
      row.status === "CREATED" || row.status === "FAILED"
        ? row.clientSnapshot
        : null,
    readOnly: row.status === "CREATED",
  };
}

async function loadByToken(token: string) {
  const tokenHash = hashTokenForLookup(token);
  return prisma.contractRequest.findFirst({
    where: { tokenHash },
    include: {
      property: { select: { title: true, address: true } },
      tenant: { select: { fullName: true } },
    },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { token } = await ctx.params;
  const rl = checkRateLimit(`cfg:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return fail("Juda ko‘p so‘rov", 429);

  const row = await loadByToken(token);
  if (!row) return fail("Havola yaroqsiz", 404);
  if (row.tokenExpiresAt.getTime() < Date.now() && row.status !== "CREATED") {
    return fail("Havola muddati tugagan", 410);
  }

  if (row.status === "AWAITING_CLIENT") {
    await prisma.contractRequest.update({
      where: { id: row.id },
      data: { status: "CLIENT_FORM_OPENED" },
    });
    await recordStatusEvent({
      requestId: row.id,
      fromStatus: "AWAITING_CLIENT",
      toStatus: "CLIENT_FORM_OPENED",
      actorKind: "CLIENT",
    });
    row.status = "CLIENT_FORM_OPENED";
  }

  return ok(publicFormView(row));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { token } = await ctx.params;
  const rl = checkRateLimit(`cfp:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return fail("Juda ko‘p so‘rov", 429);

  const idem = req.headers.get("idempotency-key")?.trim();
  const row = await loadByToken(token);
  if (!row) return fail("Havola yaroqsiz", 404);

  if (row.status === "CREATED") {
    return ok({
      alreadyCreated: true,
      status: "CREATED",
      contractNumber: row.contractNumber,
      userMessage: "Shartnoma allaqachon yaratilgan.",
    });
  }

  try {
    const body = await req.json();
    void idem;
    const result = await finalizeContractFromClientForm({
      request: row,
      clientBody: body,
    });
    await processPendingContractDeliveries(3);
    return ok({
      ...result,
      status: "CREATED",
      userMessage: "Shartnoma yaratildi. Hujjat bot orqali yuboriladi.",
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return fail(
      err instanceof Error ? err.message : "Yuborib bo‘lmadi",
      status
    );
  }
}
