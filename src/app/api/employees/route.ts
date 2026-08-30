import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { normalizeEmployeePhone } from "@/lib/employee-units";

function assertStaffRole(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const { page, limit, skip, search, sortBy, order } = parsePagination(url);
  const activeOnly = url.searchParams.get("active") === "1";
  const companyId = url.searchParams.get("companyId")?.trim();

  const where: Record<string, unknown> = {};
  if (activeOnly) where.active = true;
  if (companyId) where.companyId = companyId;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" as const } },
      { phone: { contains: search, mode: "insensitive" as const } },
      { position: { contains: search, mode: "insensitive" as const } },
      {
        company: {
          name: { contains: search, mode: "insensitive" as const },
        },
      },
    ];
  }

  const allowedSort = new Set([
    "createdAt",
    "fullName",
    "monthlySalary",
    "updatedAt",
    "startedAt",
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
  if (!assertStaffRole(auth.user.role)) {
    return fail("Ruxsat yo'q", 403);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    if (!fullName) return fail("Ismni kiriting", 400);

    const companyId =
      body.companyId != null && body.companyId !== ""
        ? String(body.companyId)
        : null;
    if (!companyId) return fail("Kompaniyani tanlang (Sunnur yoki LWN)", 400);

    const company = await prisma.partnerCompany.findUnique({
      where: { id: companyId },
    });
    if (!company || !company.active) {
      return fail("Kompaniya topilmadi yoki nofaol", 400);
    }

    const position = String(body.position ?? "").trim();
    if (!position) return fail("Lavozimni tanlang", 400);

    const phone = normalizeEmployeePhone(
      body.phone != null ? String(body.phone) : null
    );
    if (phone) {
      const dup = await prisma.employee.findFirst({
        where: { phone },
        select: { id: true },
      });
      if (dup) return fail("Bu telefon raqam band", 409);
    }

    const monthlySalary = Number(body.monthlySalary ?? 0);
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      return fail("Oylik maosh manfiy bo'lishi mumkin emas", 400);
    }
    const hasSalary = monthlySalary > 0;
    const salaryPayDayRaw =
      body.salaryPayDay != null && body.salaryPayDay !== ""
        ? Math.min(31, Math.max(1, Number(body.salaryPayDay)))
        : null;

    const startedAtRaw =
      body.startedAt != null && String(body.startedAt).trim() !== ""
        ? new Date(String(body.startedAt))
        : null;
    const startedAt =
      startedAtRaw && !Number.isNaN(startedAtRaw.getTime())
        ? startedAtRaw
        : new Date();

    const created = await prisma.employee.create({
      data: {
        fullName,
        phone,
        position,
        monthlySalary: Number.isFinite(monthlySalary) ? monthlySalary : 0,
        salaryPayDay: hasSalary ? salaryPayDayRaw : null,
        active: body.active == null ? true : Boolean(body.active),
        notes: body.notes ? String(body.notes) : undefined,
        companyId,
        startedAt,
      },
      include: { company: true },
    });
    return ok(created, 201);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return fail("Bu telefon raqam band", 409);
    }
    return fail("Saqlash xatosi", 500);
  }
}
