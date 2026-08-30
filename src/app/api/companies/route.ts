import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { page, limit, skip, search, sortBy, order } = parsePagination(
    new URL(req.url)
  );
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const allowedSort = new Set(["createdAt", "name", "updatedAt"]);
  const sortField = allowedSort.has(sortBy) ? sortBy : "name";

  const [data, total] = await Promise.all([
    prisma.partnerCompany.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: order },
    }),
    prisma.partnerCompany.count({ where }),
  ]);

  return ok(paginated(data, total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!name) return fail("Kompaniya nomini kiriting", 400);

    const created = await prisma.partnerCompany.create({
      data: {
        name,
        phone: body.phone ? String(body.phone) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        active: body.active == null ? true : Boolean(body.active),
      },
    });
    return ok(created, 201);
  } catch {
    return fail("Saqlash xatosi", 500);
  }
}
