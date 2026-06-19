import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { mapClientUpdate, deleteTenantAndClientsForClient } from "@/lib/api-server/clients";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return ok(
      await prisma.client.update({ where: { id }, data: mapClientUpdate(body) })
    );
  } catch {
    return fail("Yangilash xatosi", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(_req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  try {
    await deleteTenantAndClientsForClient(id);
    return ok({ ok: true });
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
