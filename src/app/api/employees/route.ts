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
          { position: { contains: search, mode: "insensitive" as const } },
          {
            company: {
              name: { contains: search, mode: "insensitive" as const },
            },
          },
        ],
      }
    : {};

  const allowedSort = new Set([
    "createdAt",
    "fullName",
    "monthlySalary",
    "updatedAt",
  ]);
  const sortField = allowedSort.has(sortBy) ? sortBy : "createdAt";

  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: order },
      include: { company: true },
    }),
    prisma.employee.count({ where }),
  ]);

  return ok(paginated(data, total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    if (!fullName) return fail("Ismni kiriting", 400);

    const companyId =
      body.companyId != null && body.companyId !== ""
        ? String(body.companyId)
        : undefined;

    const monthlySalary = Number(body.monthlySalary ?? 0);
    const hasSalary = Number.isFinite(monthlySalary) && monthlySalary > 0;
    const salaryPayDayRaw =
      body.salaryPayDay != null && body.salaryPayDay !== ""
        ? Math.min(31, Math.max(1, Number(body.salaryPayDay)))
        : undefined;

    const created = await prisma.employee.create({
      data: {
        fullName,
        phone: body.phone ? String(body.phone) : undefined,
        position: body.position ? String(body.position) : undefined,
        monthlySalary: Number.isFinite(monthlySalary) ? monthlySalary : 0,
        salaryPayDay: hasSalary ? salaryPayDayRaw : null,
        active: body.active == null ? true : Boolean(body.active),
        notes: body.notes ? String(body.notes) : undefined,
        companyId,
      },
      include: { company: true },
    });
    return ok(created, 201);
  } catch {
    return fail("Saqlash xatosi", 500);
  }
}
