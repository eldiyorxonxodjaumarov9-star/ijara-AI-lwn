import { NextRequest, NextResponse } from "next/server";

import { readFeedbackPhotoBytes } from "@/lib/api-server/qr-feedback/media";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

type Ctx = { params: Promise<{ id: string }> };

/** Authenticated private photo proxy — never exposes Blob/Telegram credentials. */
export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "qr-codes", "GET");
  if (auth.error) return auth.error;
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const { id } = await ctx.params;
  const photo = await prisma.cleanlinessFeedbackPhoto.findFirst({
    where: {
      id,
      feedback: { workspaceId: wsCtx.workspace.id },
    },
  });
  if (!photo) return fail("Rasm topilmadi", 404);

  try {
    const loaded = await readFeedbackPhotoBytes({
      storageKey: photo.storageKey,
      storageUrl: photo.storageUrl,
      mimeType: photo.mimeType,
    });
    return new NextResponse(new Uint8Array(loaded.body), {
      status: 200,
      headers: {
        "Content-Type": loaded.contentType,
        "Content-Length": String(loaded.body.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fail("Rasm mavjud emas", 404);
  }
}
