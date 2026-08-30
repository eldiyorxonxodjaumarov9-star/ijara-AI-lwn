import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  EMPLOYEE_UNIT,
  isLwnCompanyName,
  isSunnurCompanyName,
} from "@/lib/employee-units";

function assertStaffRole(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

/** Sunnur va LWN PartnerCompany yozuvlarini kafolatlaydi */
async function ensureUnitCompanies() {
  const all = await prisma.partnerCompany.findMany({
    where: { active: true },
  });
  let sunnur = all.find((c) => isSunnurCompanyName(c.name));
  let lwn = all.find((c) => isLwnCompanyName(c.name));

  if (!sunnur) {
    sunnur = await prisma.partnerCompany.create({
      data: { name: EMPLOYEE_UNIT.SUNNUR, active: true },
    });
  }
  if (!lwn) {
    lwn = await prisma.partnerCompany.create({
      data: { name: EMPLOYEE_UNIT.LWN, active: true },
    });
  }
  return { sunnur, lwn };
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  if (url.searchParams.get("ensureUnits") === "1") {
    if (!assertStaffRole(auth.user.role)) {
      return fail("Ruxsat yo'q", 403);
    }
    const units = await ensureUnitCompanies();
    return ok({
      sunnur: units.sunnur,
      lwn: units.lwn,
      data: [units.sunnur, units.lwn],
    });
  }

  const { page, limit, skip, search, sortBy, order } = parsePagination(url);
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
  if (!assertStaffRole(auth.user.role)) {
    return fail("Ruxsat yo'q", 403);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!name) return fail("Kompaniya nomini kiriting", 400);
    if (!isSunnurCompanyName(name) && !isLwnCompanyName(name)) {
      return fail("Faqat Sunnur yoki LWN kompaniyasi qo'shiladi", 400);
    }

    const created = await prisma.partnerCompany.create({
      data: {
        name: isSunnurCompanyName(name)
          ? EMPLOYEE_UNIT.SUNNUR
          : EMPLOYEE_UNIT.LWN,
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
