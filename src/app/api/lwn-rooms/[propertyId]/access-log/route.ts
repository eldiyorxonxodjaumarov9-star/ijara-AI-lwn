import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import {
  findLwnPropertyOrFail,
  mapAccessLogEvent,
} from "@/lib/api-server/lwn-room-lock";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { assertTtlockOwnerRole } from "@/lib/api-server/ttlock/service";

type Ctx = { params: Promise<{ propertyId: string }> };

function failFromErr(err: unknown) {
  if (err instanceof TtlockError) {
    return fail(err.message, err.httpStatus, err.code);
  }
  return fail("Kirish tarixini yuklab bo'lmadi", 500);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    assertTtlockOwnerRole(auth.user);
  } catch (err) {
    return failFromErr(err);
  }

  const { propertyId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId, auth.user);
  if ("error" in found && found.error) return found.error;

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const eventType = url.searchParams.get("eventType");

  const occurredAt: Prisma.DateTimeFilter | undefined =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
          ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
        }
      : undefined;

  const rows = await prisma.roomAccessLogEvent.findMany({
    where: {
      propertyId,
      ...(occurredAt ? { occurredAt } : {}),
      ...(eventType && eventType !== "all"
        ? { eventType: { equals: eventType, mode: "insensitive" } }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  return ok(rows.map(mapAccessLogEvent));
}
