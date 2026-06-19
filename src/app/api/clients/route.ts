import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import {
  mapClientCreate,
  mapClientUpdate,
  syncClientsFromTenants,
} from "@/lib/api-server/clients";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { page, limit, skip, search, sortBy, order } = parsePagination(new URL(req.url));
  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: order },
    }),
    prisma.client.count({ where }),
  ]);

  return ok(paginated(data, total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const created = await prisma.client.create({ data: mapClientCreate(body) });
    return ok(created, 201);
  } catch {
    return fail("Saqlash xatosi", 500);
  }
}

export async function PUT(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const synced = await syncClientsFromTenants();
    return ok({ synced: synced.length, data: synced });
  } catch {
    return fail("Sinxronlash xatosi", 500);
  }
}
