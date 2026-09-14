import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import {
  enqueueContractDeliveryResend,
  processPendingContractDeliveries,
} from "@/lib/api-server/contract-draft/bot";
import { finalizeContractFromClientForm } from "@/lib/api-server/contract-draft/finalize";
import {
  assertContractStaff,
  recordStatusEvent,
  toPublicRequestView,
} from "@/lib/api-server/contract-draft/queries";
import {
  createContractToken,
  contractTokenExpiresAt,
} from "@/lib/api-server/contract-draft/phone-token";
import { loadContractDocxBytes } from "@/lib/api-server/contract-draft/storage";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    assertContractStaff(auth.user);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    if (url.searchParams.get("download") === "1") {
      const doc = await prisma.contractGeneratedDocument.findUnique({
        where: { requestId: id },
      });
      if (!doc) return fail("Hujjat topilmadi", 404);
      const { body, contentType } = await loadContractDocxBytes({
        storageUrl: doc.storageUrl,
        storageKey: doc.storageKey,
      });
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${doc.originalName.replace(/[^\w.\-]+/g, "_")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const row = await prisma.contractRequest.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, fullName: true, phone: true } },
        property: { select: { id: true, title: true, address: true } },
        document: {
          select: { id: true, originalName: true, generatedAt: true },
        },
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            attempts: true,
            lastErrorSafe: true,
            sentAt: true,
            nextRetryAt: true,
          },
        },
      },
    });
    if (!row) return fail("So‘rov topilmadi", 404);
    return ok({
      ...toPublicRequestView(row),
      deliveries: row.deliveries,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(err instanceof Error ? err.message : "Xato", status);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    assertContractStaff(auth.user);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      force?: boolean;
    };
    const action = String(body.action ?? "");
    const row = await prisma.contractRequest.findUnique({ where: { id } });
    if (!row) return fail("So‘rov topilmadi", 404);

    if (action === "cancel") {
      if (row.status === "CREATED") {
        return fail("Yaratilgan shartnomani bekor qilib bo‘lmaydi", 400);
      }
      await prisma.contractRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await recordStatusEvent({
        requestId: id,
        fromStatus: row.status,
        toStatus: "CANCELLED",
        actorUserId: auth.user.id,
        actorKind: "ADMIN",
      });
      return ok({ ok: true });
    }

    if (action === "regenerate-link") {
      if (
        row.status !== "AWAITING_CLIENT" &&
        row.status !== "CLIENT_FORM_OPENED" &&
        row.status !== "FAILED"
      ) {
        return fail("Havolani yangilab bo‘lmaydi", 400);
      }
      const { rawToken, tokenHash } = createContractToken();
      await prisma.contractRequest.update({
        where: { id },
        data: {
          tokenHash,
          tokenExpiresAt: contractTokenExpiresAt(),
          status: "AWAITING_CLIENT",
        },
      });
      return ok({
        formPath: `/contract-form/${rawToken}`,
        userMessage: "Yangi havola yaratildi (faqat bir marta ko‘rsatiladi).",
      });
    }

    if (action === "retry") {
      if (row.status !== "FAILED") return fail("Qayta urinish mumkin emas", 400);
      if (!row.clientSnapshot) {
        await prisma.contractRequest.update({
          where: { id },
          data: { status: "AWAITING_CLIENT", failReasonSafe: null },
        });
        return ok({ userMessage: "Mijoz formasi qayta kutilmoqda" });
      }
      const full = await prisma.contractRequest.findUniqueOrThrow({
        where: { id },
        include: {
          property: { select: { title: true, address: true } },
          tenant: { select: { fullName: true } },
        },
      });
      const result = await finalizeContractFromClientForm({
        request: full,
        clientBody: row.clientSnapshot,
      });
      await processPendingContractDeliveries(5, { inlineRetries: 2 });
      return ok(result);
    }

    if (action === "retry-delivery") {
      const queued = await enqueueContractDeliveryResend({
        requestId: id,
        force: Boolean(body.force),
      });
      if (queued.queued) {
        await processPendingContractDeliveries(5, { inlineRetries: 2 });
      }
      return ok({ userMessage: queued.message, queued: queued.queued });
    }

    return fail("Noma’lum amal", 400);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(err instanceof Error ? err.message : "Xato", status);
  }
}
