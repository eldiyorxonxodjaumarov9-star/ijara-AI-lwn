import { NextRequest } from "next/server";

import { syncDepositForTenant } from "@/lib/api-server/deposit-sync";
import { mapTenantBody, stripTenantSecret } from "@/lib/api-server/tenants";
import { deleteTenantAndLinkedClients } from "@/lib/api-server/clients";
import { upsertClientFromTenant } from "@/lib/api-server/clients";
import { upsertContractFromTenant } from "@/lib/api-server/contract-sync";
import { requireResourceAccess, type RbacResource } from "@/lib/api-server/rbac";
import { sanitizeEmployeeForRole } from "@/lib/api-server/employees/sanitize";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  isRecordInWorkspace,
  resolveUserWorkspaceContext,
} from "@/lib/api-server/workspace";

const ALLOWED = new Set<RbacResource>([
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
]);

async function resolveWorkspace(user: Parameters<typeof resolveUserWorkspaceContext>[0]) {
  const wsCtx = await resolveUserWorkspaceContext(user);
  if (!wsCtx.hasAccess) {
    return { error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") };
  }
  return { workspaceId: wsCtx.workspace.id };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { resource, id } = await ctx.params;
  if (!ALLOWED.has(resource as RbacResource)) return fail("Topilmadi", 404);

  const auth = await requireResourceAccess(req, resource as RbacResource, "GET");
  if (auth.error) return auth.error;

  const ws = await resolveWorkspace(auth.user);
  if ("error" in ws) return ws.error;

  let found: { workspaceId?: string | null } | null = null;
  switch (resource) {
    case "tenants": {
      const row = await prisma.tenant.findUnique({ where: { id, workspaceId: ws.workspaceId } });
      found = row;
      if (row && isRecordInWorkspace(row, ws.workspaceId)) {
        return ok(stripTenantSecret(row));
      }
      break;
    }
    case "contracts": {
      const row = await prisma.contract.findUnique({
        where: { id, workspaceId: ws.workspaceId },
        include: { property: true, tenant: true },
      });
      found = row;
      if (row && isRecordInWorkspace(row, ws.workspaceId)) return ok(row);
      break;
    }
    case "payments": {
      const row = await prisma.payment.findUnique({
        where: { id, workspaceId: ws.workspaceId },
        include: { contract: { include: { property: true, tenant: true } } },
      });
      found = row;
      if (row && isRecordInWorkspace(row, ws.workspaceId)) return ok(row);
      break;
    }
    case "expenses": {
      const row = await prisma.expense.findUnique({
        where: { id, workspaceId: ws.workspaceId },
        include: { employee: { include: { company: true } } },
      });
      found = row;
      if (row && isRecordInWorkspace(row, ws.workspaceId)) {
        return ok({
          ...row,
          employee: row.employee
            ? sanitizeEmployeeForRole(
                row.employee as Record<string, unknown>,
                auth.user.role
              )
            : null,
        });
      }
      break;
    }
    case "maintenance": {
      const row = await prisma.maintenance.findUnique({
        where: { id, workspaceId: ws.workspaceId },
        include: { property: true },
      });
      found = row;
      if (row && isRecordInWorkspace(row, ws.workspaceId)) return ok(row);
      break;
    }
    case "notifications": {
      const row = await prisma.notification.findUnique({ where: { id, workspaceId: ws.workspaceId } });
      found = row;
      if (row && isRecordInWorkspace(row, ws.workspaceId)) return ok(row);
      break;
    }
  }

  if (!found) return fail("Topilmadi", 404);
  return fail("Topilmadi", 404);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { resource, id } = await ctx.params;
  if (!ALLOWED.has(resource as RbacResource)) return fail("Topilmadi", 404);

  const auth = await requireResourceAccess(req, resource as RbacResource, "PATCH");
  if (auth.error) return auth.error;

  const ws = await resolveWorkspace(auth.user);
  if ("error" in ws) return ws.error;

  const body = (await req.json()) as Record<string, unknown>;
  delete body.workspaceId;

  try {
    switch (resource) {
      case "tenants": {
        const existing = await prisma.tenant.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        const updated = await prisma.tenant.update({
          where: { id },
          data: await mapTenantBody(body),
        });
        await upsertClientFromTenant(updated);
        await upsertContractFromTenant(updated);
        if (body.depositPaid != null || body.depositAmount != null) {
          await syncDepositForTenant(
            id,
            Boolean(body.depositPaid ?? updated.depositPaid),
            Number(body.depositAmount ?? updated.depositAmount)
          );
        }
        return ok(stripTenantSecret(updated));
      }
      case "contracts": {
        const existing = await prisma.contract.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        return ok(
          await prisma.contract.update({
            where: { id },
            data: {
              ...body,
              startDate: body.startDate ? new Date(String(body.startDate)) : undefined,
              endDate: body.endDate ? new Date(String(body.endDate)) : undefined,
            } as never,
            include: { property: true, tenant: true },
          })
        );
      }
      case "payments": {
        const existing = await prisma.payment.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        const data: Record<string, unknown> = {};
        if (body.contractId != null) data.contractId = String(body.contractId);
        if (body.amount != null) data.amount = Number(body.amount);
        if (body.paymentDate != null || body.date != null) {
          data.paymentDate = new Date(
            String(body.paymentDate ?? body.date)
          );
        }
        if (body.paymentMethod != null) data.paymentMethod = body.paymentMethod;
        if (body.notes != null || body.note != null) {
          data.notes = String(body.notes ?? body.note ?? "") || null;
        }
        if (body.periodYear !== undefined) {
          data.periodYear =
            body.periodYear == null || body.periodYear === ""
              ? null
              : Number(body.periodYear);
        }
        if (body.periodMonth !== undefined) {
          data.periodMonth =
            body.periodMonth == null || body.periodMonth === ""
              ? null
              : Number(body.periodMonth);
        }
        return ok(
          await prisma.payment.update({
            where: { id },
            data: data as never,
            include: {
              contract: { include: { property: true, tenant: true } },
            },
          })
        );
      }
      case "expenses": {
        const existing = await prisma.expense.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        const data: Record<string, unknown> = {};
        if (body.title != null || body.note != null) {
          data.title = String(body.title ?? body.note ?? "Xarajat");
        }
        if (body.amount != null) data.amount = Number(body.amount);
        if (body.category != null) data.category = body.category;
        if (body.date != null) data.date = new Date(String(body.date));
        if (body.notes != null || body.note != null) {
          data.notes = body.notes ?? body.note ?? null;
        }
        if (body.receiptUrl !== undefined) {
          data.receiptUrl = body.receiptUrl ? String(body.receiptUrl) : null;
        }
        if (body.employeeId !== undefined) {
          data.employeeId = body.employeeId ? String(body.employeeId) : null;
        }
        if (
          body.monthlyType !== undefined ||
          body.monthlyExpenseType !== undefined
        ) {
          const raw = body.monthlyType ?? body.monthlyExpenseType;
          data.monthlyType =
            raw == null || raw === ""
              ? null
              : String(raw).toUpperCase();
        }
        if (
          body.monthlyTypeCustom !== undefined ||
          body.monthlyExpenseCustomName !== undefined
        ) {
          const raw = body.monthlyTypeCustom ?? body.monthlyExpenseCustomName;
          const trimmed = raw == null ? "" : String(raw).trim();
          data.monthlyTypeCustom = trimmed || null;
        }
        const updated = await prisma.expense.update({
          where: { id },
          data: data as never,
          include: { employee: { include: { company: true } } },
        });
        return ok({
          ...updated,
          employee: updated.employee
            ? sanitizeEmployeeForRole(
                updated.employee as Record<string, unknown>,
                auth.user.role
              )
            : null,
        });
      }
      case "maintenance": {
        const existing = await prisma.maintenance.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        return ok(await prisma.maintenance.update({ where: { id }, data: body as never }));
      }
      case "notifications": {
        const existing = await prisma.notification.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        return ok(
          await prisma.notification.update({
            where: { id },
            data: {
              ...(body.isRead != null ? { isRead: Boolean(body.isRead) } : {}),
              ...(body.read != null ? { isRead: Boolean(body.read) } : {}),
            },
          })
        );
      }
      default:
        return fail("Topilmadi", 404);
    }
  } catch {
    return fail("Yangilash xatosi", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { resource, id } = await ctx.params;
  if (!ALLOWED.has(resource as RbacResource)) return fail("Topilmadi", 404);

  const auth = await requireResourceAccess(req, resource as RbacResource, "DELETE");
  if (auth.error) return auth.error;

  const ws = await resolveWorkspace(auth.user);
  if ("error" in ws) return ws.error;

  try {
    switch (resource) {
      case "tenants": {
        const existing = await prisma.tenant.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        await deleteTenantAndLinkedClients(id);
        break;
      }
      case "contracts": {
        const existing = await prisma.contract.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        await prisma.contract.delete({ where: { id } });
        break;
      }
      case "payments": {
        const existing = await prisma.payment.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        await prisma.payment.delete({ where: { id } });
        break;
      }
      case "expenses": {
        const existing = await prisma.expense.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        await prisma.expense.delete({ where: { id } });
        break;
      }
      case "maintenance": {
        const existing = await prisma.maintenance.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        await prisma.maintenance.delete({ where: { id } });
        break;
      }
      case "notifications": {
        const existing = await prisma.notification.findUnique({ where: { id } });
        if (!isRecordInWorkspace(existing, ws.workspaceId)) {
          return fail("Topilmadi", 404);
        }
        await prisma.notification.delete({ where: { id } });
        break;
      }
    }
    return ok({ message: "O'chirildi" });
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
