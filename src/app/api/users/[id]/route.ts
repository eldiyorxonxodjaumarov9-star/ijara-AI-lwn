import { NextRequest } from "next/server";

import { requireUser, sanitizeUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  if (auth.user.id !== id && auth.user.role !== "SUPER_ADMIN") {
    return fail("Ruxsat yo'q", 403);
  }

  try {
    const body = (await req.json()) as {
      fullName?: string;
      phone?: string;
      email?: string;
      avatarUrl?: string;
      language?: string;
    };

    if (body.email) {
      const taken = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase(), NOT: { id } },
      });
      if (taken) return fail("Bu email allaqachon band", 409);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(body.fullName != null ? { fullName: body.fullName } : {}),
        ...(body.phone != null ? { phone: body.phone } : {}),
        ...(body.email != null ? { email: body.email.toLowerCase() } : {}),
        ...(body.avatarUrl != null ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.language != null ? { language: body.language } : {}),
      },
    });

    return ok(sanitizeUser(updated));
  } catch {
    return fail("Yangilash xatosi", 500);
  }
}
