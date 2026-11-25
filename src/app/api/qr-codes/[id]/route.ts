import { NextRequest } from "next/server";

import {
  buildPrintCardSvg,
  buildRawQrPng,
  buildRawQrSvg,
} from "@/lib/api-server/qr-feedback/print-card";
import {
  mapQrForAdmin,
  updateQrCode,
} from "@/lib/api-server/qr-feedback/service";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

type Ctx = { params: Promise<{ id: string }> };

function safeFileBase(name: string) {
  return name.replace(/[^\w.-]+/g, "_") || "qr";
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "qr-codes", "PATCH");
  if (auth.error) return auth.error;
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    locationLabel?: string | null;
    roomNumber?: string | null;
    printInstruction?: string | null;
    active?: boolean;
  };
  try {
    await updateQrCode({
      workspaceId: wsCtx.workspace.id,
      id,
      name: body.name,
      locationLabel: body.locationLabel,
      roomNumber: body.roomNumber,
      printInstruction: body.printInstruction,
      active: body.active,
    });
    const row = await prisma.feedbackQrCode.findFirst({
      where: { id, workspaceId: wsCtx.workspace.id },
      include: { _count: { select: { feedbacks: true } } },
    });
    if (!row) return fail("QR topilmadi", 404);
    return ok(mapQrForAdmin(row));
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status) || 400
        : 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "qr-codes", "GET");
  if (auth.error) return auth.error;
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const { id } = await ctx.params;
  const format = (new URL(req.url).searchParams.get("format") || "png").toLowerCase();
  const row = await prisma.feedbackQrCode.findFirst({
    where: { id, workspaceId: wsCtx.workspace.id },
  });
  if (!row) return fail("QR topilmadi", 404);

  const fields = {
    publicToken: row.publicToken,
    name: row.name,
    roomNumber: row.roomNumber,
    locationLabel: row.locationLabel,
    printInstruction: row.printInstruction,
  };
  const base = safeFileBase(row.name);

  try {
    if (format === "svg" || format === "print-svg" || format === "png" || format === "print-png") {
      // Print PNG is produced client-side from this SVG (avoids sharp on Vercel).
      const svg = await buildPrintCardSvg(fields);
      const asPngHint = format === "png" || format === "print-png";
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "private, max-age=30",
          "X-Ijara-Print-Format": asPngHint ? "svg-for-png" : "svg",
          "Content-Disposition": `attachment; filename="${base}_print.svg"`,
        },
      });
    }

    if (format === "raw-svg") {
      const svg = await buildRawQrSvg(row.publicToken);
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "private, max-age=30",
          "Content-Disposition": `attachment; filename="${base}_raw.svg"`,
        },
      });
    }

    if (format === "raw" || format === "raw-png") {
      const bytes = await buildRawQrPng(row.publicToken);
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=30",
          "Content-Disposition": `attachment; filename="${base}_raw.png"`,
        },
      });
    }

    return fail("Noto‘g‘ri format", 400);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status) || 400
        : 400;
    return fail(err instanceof Error ? err.message : "QR URL xato", status);
  }
}
