import { createWithinPlanLimit, planErrorResponse } from "@/lib/api-server/plan-service";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  resolveUserWorkspaceContext,
  workspaceWhere,
} from "@/lib/api-server/workspace";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "properties", "GET");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const ws = workspaceWhere(wsCtx.workspace.id);

  const url = new URL(req.url);
  const { page, limit, skip, search, sortBy, order } = parsePagination(url);
  const status = url.searchParams.get("status") ?? undefined;
  const region = url.searchParams.get("region") ?? undefined;

  const where: Prisma.PropertyWhereInput = {
    ...ws,
    ...(status ? { status: status as Prisma.PropertyWhereInput["status"] } : {}),
    ...(region ? { region } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
            { district: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: order },
    }),
    prisma.property.count({ where }),
  ]);

  return ok(paginated(data, total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "properties", "POST");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const created = await createWithinPlanLimit(wsCtx, "properties", db => db.property.create({
      data: {
        workspaceId: wsCtx.workspace.id,
        title: String(body.title ?? body.name ?? ""),
        address: String(body.address ?? ""),
        region: String(body.region ?? ""),
        district: String(body.district ?? ""),
        rentPrice: Number(body.rentPrice ?? body.price ?? 0),
        rooms: Number(body.rooms ?? 0),
        area: Number(body.area ?? 0),
        building: body.building ? String(body.building) : undefined,
        description: body.description ? String(body.description) : undefined,
        status: (body.status as Prisma.PropertyCreateInput["status"]) ?? "AVAILABLE",
        images: (body.images as string[]) ?? [],
      },
    }));
    return ok(created, 201);
  } catch (error) {
    const planError = planErrorResponse(error);
    if (planError) return planError;
    return fail("Saqlash xatosi", 500);
  }
}
