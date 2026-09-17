import { NextRequest } from "next/server";

import { requireAnyStaffUser } from "@/lib/api-server/rbac";
import {
  interestToApi,
  mapContactLead,
} from "@/lib/api-server/client-database";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  resolveUserWorkspaceContext,
  workspaceWhere,
} from "@/lib/api-server/workspace";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const ws = workspaceWhere(wsCtx.workspace.id);

  const { page, limit, skip, search, sortBy, order } = parsePagination(
    new URL(req.url)
  );

  const where = {
    ...ws,
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { notes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.contactLead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: order },
    }),
    prisma.contactLead.count({ where }),
  ]);

  return ok(paginated(data.map(mapContactLead), total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (!fullName || !phone) {
      return fail("Ism va telefon majburiy", 400);
    }

    const created = await prisma.contactLead.create({
      data: {
        workspaceId: wsCtx.workspace.id,
        fullName,
        phone,
        interest: interestToApi(String(body.interest ?? "called")),
        notes: body.notes ? String(body.notes).trim() || null : null,
        source: body.source ? String(body.source).trim() || null : "telefon",
      },
    });

    return ok(mapContactLead(created), 201);
  } catch {
    return fail("Kontakt saqlanmadi", 500);
  }
}
