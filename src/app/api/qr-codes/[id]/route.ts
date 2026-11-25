import { NextRequest } from "next/server";

import {
  generateQrPngDataUrl,
  generateQrSvg,
  updateQrCode,
} from "@/lib/api-server/qr-feedback/service";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

type Ctx = { params: Promise<{ id: string }> };

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
    active?: boolean;
  };
  try {
    const row = await updateQrCode({
      workspaceId: wsCtx.workspace.id,
      id,
      name: body.name,
      locationLabel: body.locationLabel,
      active: body.active,
    });
    return ok(row);
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
  const format = new URL(req.url).searchParams.get("format") || "png";
  const row = await prisma.feedbackQrCode.findFirst({
    where: { id, workspaceId: wsCtx.workspace.id },
  });
  if (!row) return fail("QR topilmadi", 404);

  try {
    if (format === "svg") {
      const svg = await generateQrSvg(row.publicToken);
      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "private, max-age=60",
          "Content-Disposition": `attachment; filename="${row.name.replace(/[^\w.-]+/g, "_")}.svg"`,
        },
      });
    }

    const dataUrl = await generateQrPngDataUrl(row.publicToken);
    const base64 = dataUrl.split(",")[1] || "";
    const bytes = Buffer.from(base64, "base64");
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `attachment; filename="${row.name.replace(/[^\w.-]+/g, "_")}.png"`,
      },
    });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status) || 400
        : 400;
    return fail(err instanceof Error ? err.message : "QR URL xato", status);
  }
}
