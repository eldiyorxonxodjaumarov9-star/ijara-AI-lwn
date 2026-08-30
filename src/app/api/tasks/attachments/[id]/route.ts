import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { loadTaskAttachmentBytes } from "@/lib/api-server/tasks/task-attachments";
import { assertStaffCanManageTasks } from "@/lib/api-server/tasks/task-service";
import { isStaffRole } from "@/lib/tasks/task-shared";

type Ctx = { params: Promise<{ id: string }> };

function safeContentDisposition(name: string | null | undefined) {
  const base = (name || "attachment")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/["\r\n]/g, "")
    .slice(0, 120);
  return `inline; filename="${base || "attachment"}"`;
}

/**
 * Authenticated proxy for private task attachments.
 * Streams bytes via @vercel/blob get({ access: "private" }).
 * Never returns raw private Blob URLs or tokens.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const attachment = await prisma.workTaskAttachment.findUnique({
    where: { id },
    include: {
      report: {
        include: {
          task: true,
        },
      },
    },
  });
  if (!attachment) return fail("Topilmadi", 404);

  const staff = isStaffRole(auth.user.role);
  if (!staff) {
    return fail("Ruxsat yo‘q", 403);
  }
  try {
    await assertStaffCanManageTasks(auth.user);
  } catch {
    return fail("Ruxsat yo‘q", 403);
  }

  try {
    const loaded = await loadTaskAttachmentBytes({
      storageUrl: attachment.storageUrl,
      storageKey: attachment.storageKey,
      mimeType: attachment.mimeType,
    });

    const headers = new Headers({
      "Content-Type": loaded.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": safeContentDisposition(attachment.originalName),
    });
    if (typeof loaded.size === "number" && loaded.size >= 0) {
      headers.set("Content-Length", String(loaded.size));
    }

    return new NextResponse(loaded.body as BodyInit, {
      status: 200,
      headers,
    });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status) || 500
        : 500;
    const message =
      err instanceof Error ? err.message : "Faylni yuklab bo‘lmadi";
    // Never echo storage URLs or tokens
    const safe = message
      .replace(/https?:\/\/\S+/gi, "[url]")
      .replace(/vercel_blob_rw_[A-Za-z0-9_]+/g, "[token]");
    return fail(safe, status);
  }
}
