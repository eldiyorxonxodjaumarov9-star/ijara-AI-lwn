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
          { fullName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { clientNumber: { contains: search, mode: "insensitive" as const } },
          { propertyName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    prisma.tenantArchive.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy === "createdAt" ? "leaveDate" : sortBy]: order },
    }),
    prisma.tenantArchive.count({ where }),
  ]);

  return ok(paginated(data, total, page, limit));
}
