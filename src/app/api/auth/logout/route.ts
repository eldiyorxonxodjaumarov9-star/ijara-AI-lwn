import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { refreshTokenHash: null },
  });

  return ok({ message: "Chiqildi" });
}
