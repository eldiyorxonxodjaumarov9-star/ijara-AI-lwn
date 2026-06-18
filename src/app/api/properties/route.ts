import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const { page, limit, skip, search, sortBy, order } = parsePagination(url);
  const status = url.searchParams.get("status") ?? undefined;
  const region = url.searchParams.get("region") ?? undefined;

  const where: Prisma.PropertyWhereInput = {
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
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const created = await prisma.property.create({
      data: {
        title: String(body.title ?? body.name ?? ""),
        address: String(body.address ?? ""),
        region: String(body.region ?? ""),
        district: String(body.district ?? ""),
        rentPrice: Number(body.rentPrice ?? body.price ?? 0),
        rooms: Number(body.rooms ?? 0),
        area: Number(body.area ?? 0),
        description: body.description ? String(body.description) : undefined,
        status: (body.status as Prisma.PropertyCreateInput["status"]) ?? "AVAILABLE",
        images: (body.images as string[]) ?? [],
      },
    });
    return ok(created, 201);
  } catch {
    return fail("Saqlash xatosi", 500);
  }
}
