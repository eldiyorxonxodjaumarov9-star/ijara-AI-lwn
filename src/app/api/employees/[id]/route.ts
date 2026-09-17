import { NextRequest } from "next/server";

import { sanitizeEmployeeForRole } from "@/lib/api-server/employees/sanitize";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { normalizeEmployeePhone } from "@/lib/employee-units";
import {
  isRecordInWorkspace,
  resolveUserWorkspaceContext,
  workspaceWhere,
} from "@/lib/api-server/workspace";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "employees", "GET");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  const item = await prisma.employee.findUnique({
    where: { id, workspaceId: wsCtx.workspace.id },
    include: { company: true },
  });
  if (!isRecordInWorkspace(item, wsCtx.workspace.id)) {
    return fail("Xodim topilmadi", 404);
  }
  return ok(sanitizeEmployeeForRole(item, auth.user.role));
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "employees", "PATCH");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const ws = workspaceWhere(wsCtx.workspace.id);

  const { id } = await ctx.params;
  try {
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!isRecordInWorkspace(existing, wsCtx.workspace.id)) {
      return fail("Xodim topilmadi", 404);
    }

    const body = (await req.json()) as Record<string, unknown>;
    delete body.workspaceId;
    const data: Record<string, unknown> = {};

    if (body.fullName != null) {
      const fullName = String(body.fullName).trim();
      if (!fullName) return fail("Ismni kiriting", 400);
      data.fullName = fullName;
    }
    if (body.phone !== undefined) {
      const phone = normalizeEmployeePhone(
        body.phone ? String(body.phone) : null
      );
      if (phone) {
        const dup = await prisma.employee.findFirst({
          where: { phone, ...ws, NOT: { id } },
          select: { id: true },
        });
        if (dup) return fail("Bu telefon raqam band", 409);
      }
      data.phone = phone;
    }
    if (body.position !== undefined) {
      const position = body.position ? String(body.position).trim() : "";
      if (!position) return fail("Lavozimni tanlang", 400);
      data.position = position;
    }
    if (body.monthlySalary != null) {
      const monthlySalary = Number(body.monthlySalary);
      if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
        return fail("Oylik maosh manfiy bo'lishi mumkin emas", 400);
      }
      data.monthlySalary = monthlySalary;
    }
    if (body.salaryPayDay !== undefined) {
      data.salaryPayDay =
        body.salaryPayDay == null || body.salaryPayDay === ""
          ? null
          : Math.min(31, Math.max(1, Number(body.salaryPayDay)));
    }
    if (body.active != null) data.active = Boolean(body.active);
    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes) : null;
    }
    if (body.companyId !== undefined) {
      const companyId =
        body.companyId == null || body.companyId === ""
          ? null
          : String(body.companyId);
      if (!companyId) {
        return fail("Kompaniyani tanlang (Sunnur yoki LWN)", 400);
      }
      const company = await prisma.partnerCompany.findUnique({
        where: { id: companyId },
      });
      if (!company || !company.active) {
        return fail("Kompaniya topilmadi yoki nofaol", 400);
      }
      data.companyId = companyId;
    }
    if (body.startedAt !== undefined) {
      if (body.startedAt == null || body.startedAt === "") {
        data.startedAt = null;
      } else {
        const d = new Date(String(body.startedAt));
        if (Number.isNaN(d.getTime())) {
          return fail("Ish boshlagan sana noto'g'ri", 400);
        }
        data.startedAt = d;
      }
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: data as never,
      include: { company: true },
    });
    return ok(updated);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return fail("Bu telefon raqam band", 409);
    }
    return fail("Yangilash xatosi", 500);
  }
}

/** Soft terminate — hard delete yo‘q */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "employees", "DELETE");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  try {
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!isRecordInWorkspace(existing, wsCtx.workspace.id)) {
      return fail("Xodim topilmadi", 404);
    }
    const updated = await prisma.employee.update({
      where: { id },
      data: { active: false },
      include: { company: true },
    });
    return ok(updated);
  } catch {
    return fail("Ishdan bo'shatish xatosi", 500);
  }
}
