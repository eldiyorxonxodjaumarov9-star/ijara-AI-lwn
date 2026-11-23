import { NextRequest, NextResponse } from "next/server";

import {
  ensureAttendanceSelfieStored,
  readAttendanceSelfieBytes,
} from "@/lib/api-server/attendance-bot/media";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Authenticated selfie proxy. Never exposes Telegram bot token or file URLs.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "attendance", "GET");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  const row = await prisma.attendanceCheckIn.findFirst({
    where: { id, workspaceId: wsCtx.workspace.id },
  });
  if (!row) return fail("Topilmadi", 404);

  let storageKey = row.selfieStorageKey;
  let storageUrl = row.selfieStorageUrl;
  let mimeType = row.selfieMimeType;
  if (!storageKey) {
    const restored = await ensureAttendanceSelfieStored(row.id);
    storageKey = restored?.selfieStorageKey ?? null;
    storageUrl = restored?.selfieStorageUrl ?? null;
    mimeType = restored?.selfieMimeType ?? mimeType;
  }
  if (!storageKey) {
    return fail("Rasm mavjud emas", 404);
  }

  try {
    const loaded = await readAttendanceSelfieBytes({
      storageKey,
      storageUrl,
      mimeType,
    });
    return new NextResponse(new Uint8Array(loaded.body), {
      status: 200,
      headers: {
        "Content-Type": loaded.contentType,
        "Content-Length": String(loaded.body.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="selfie.jpg"',
      },
    });
  } catch {
    return fail("Rasm mavjud emas", 404);
  }
}
