import { NextRequest } from "next/server";

import { mapTenantCreate, stripTenantSecret } from "@/lib/api-server/tenants";
import { ensureTenantClientNumber } from "@/lib/api-server/client-number";
import { upsertClientFromTenant } from "@/lib/api-server/clients";
import { upsertContractFromTenant } from "@/lib/api-server/contract-sync";
import { findRecentDuplicatePayment } from "@/lib/api-server/payment-dedupe";
import { notifyTenantPaymentReceived } from "@/lib/api-server/tenant-notifications";
import { requireResourceAccess, type RbacResource } from "@/lib/api-server/rbac";
import { sanitizeEmployeeForRole } from "@/lib/api-server/employees/sanitize";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  resolveUserWorkspaceContext,
  workspaceWhere,
} from "@/lib/api-server/workspace";

const ALLOWED = [
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
] as const satisfies readonly RbacResource[];

function delegate(resource: string): RbacResource | null {
  return (ALLOWED as readonly string[]).includes(resource)
    ? (resource as RbacResource)
    : null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { resource } = await ctx.params;
  const name = delegate(resource);
  if (!name) return fail("Topilmadi", 404);

  const auth = await requireResourceAccess(req, name, "GET");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const ws = workspaceWhere(wsCtx.workspace.id);

  const { page, limit, skip, sortBy, order } = parsePagination(new URL(req.url));

  switch (name) {
    case "tenants": {
      const [rows, total] = await Promise.all([
        prisma.tenant.findMany({
          where: { ...ws },
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
        }),
        prisma.tenant.count({ where: { ...ws } }),
      ]);
      const data = rows.map(stripTenantSecret);
      return ok(paginated(data, total, page, limit));
    }
    case "contracts": {
      const [data, total] = await Promise.all([
        prisma.contract.findMany({
          where: { ...ws },
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: { property: true, tenant: true },
        }),
        prisma.contract.count({ where: { ...ws } }),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "payments": {
      const [data, total] = await Promise.all([
        prisma.payment.findMany({
          where: { ...ws },
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: { contract: { include: { property: true, tenant: true } } },
        }),
        prisma.payment.count({ where: { ...ws } }),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "expenses": {
      const [rows, total] = await Promise.all([
        prisma.expense.findMany({
          where: { ...ws },
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: { employee: { include: { company: true } } },
        }),
        prisma.expense.count({ where: { ...ws } }),
      ]);
      const data = rows.map((row) => ({
        ...row,
        employee: row.employee
          ? sanitizeEmployeeForRole(
              row.employee as Record<string, unknown>,
              auth.user.role
            )
          : null,
      }));
      return ok(paginated(data, total, page, limit));
    }
    case "maintenance": {
      const [data, total] = await Promise.all([
        prisma.maintenance.findMany({
          where: { ...ws },
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: { property: true },
        }),
        prisma.maintenance.count({ where: { ...ws } }),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "notifications": {
      const [data, total] = await Promise.all([
        prisma.notification.findMany({
          where: { ...ws },
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
        }),
        prisma.notification.count({ where: { ...ws } }),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    default:
      return fail("Topilmadi", 404);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { resource } = await ctx.params;
  const name = delegate(resource);
  if (!name) return fail("Topilmadi", 404);

  const auth = await requireResourceAccess(req, name, "POST");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const workspaceId = wsCtx.workspace.id;

  const body = (await req.json()) as Record<string, unknown>;

  try {
    switch (name) {
      case "tenants": {
        const created = await prisma.tenant.create({
          data: { ...(await mapTenantCreate(body)), workspaceId },
        });
        await ensureTenantClientNumber(created.id);
        const fresh = await prisma.tenant.findUnique({ where: { id: created.id } });
        await upsertClientFromTenant(fresh ?? created);
        await upsertContractFromTenant(fresh ?? created);
        return ok(stripTenantSecret(fresh ?? created), 201);
      }
      case "contracts":
        return ok(
          await prisma.contract.create({
            data: {
              workspaceId,
              propertyId: String(body.propertyId),
              tenantId: String(body.tenantId),
              startDate: new Date(String(body.startDate)),
              endDate: new Date(String(body.endDate)),
              monthlyRent: Number(body.monthlyRent ?? body.monthlyPayment ?? 0),
              deposit: Number(body.deposit ?? 0),
              depositPaid: Boolean(body.depositPaid ?? false),
              status: (body.status as never) ?? "ACTIVE",
              notes: body.notes ? String(body.notes) : undefined,
            },
            include: { property: true, tenant: true },
          }),
          201
        );
      case "payments": {
        const periodYear =
          body.periodYear != null ? Number(body.periodYear) : undefined;
        const periodMonth =
          body.periodMonth != null ? Number(body.periodMonth) : undefined;
        const contractId = String(body.contractId ?? "").trim();
        if (!contractId) {
          return fail("Shartnomani tanlang", 400);
        }
        const amount = Number(body.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
          return fail("Summani kiriting", 400);
        }
        const paymentDate = new Date(
          String(body.paymentDate ?? body.date ?? Date.now())
        );
        if (Number.isNaN(paymentDate.getTime())) {
          return fail("Sana noto'g'ri", 400);
        }
        const paymentMethod = (body.paymentMethod as never) ?? "CASH";
        const resolvedPeriodYear =
          periodYear && periodYear >= 2000 ? periodYear : undefined;
        const resolvedPeriodMonth =
          periodMonth && periodMonth >= 1 && periodMonth <= 12
            ? periodMonth
            : undefined;

        const duplicate = await findRecentDuplicatePayment({
          contractId,
          amount,
          paymentDate,
          periodYear: resolvedPeriodYear,
          periodMonth: resolvedPeriodMonth,
          paymentMethod: String(paymentMethod),
        });
        if (duplicate) {
          return ok(duplicate, 200);
        }

        const created = await prisma.payment.create({
          data: {
            workspaceId,
            contractId,
            amount,
            paymentDate,
            periodYear: resolvedPeriodYear,
            periodMonth: resolvedPeriodMonth,
            paymentMethod,
            notes: body.notes ? String(body.notes) : undefined,
          },
          include: {
            contract: { include: { property: true, tenant: true } },
          },
        });
        // Javobni kutib qolmasin — to'lov darhol qabul qilinsin
        void notifyTenantPaymentReceived(created).catch(() => {});
        return ok(created, 201);
      }
      case "expenses": {
        const employeeId = body.employeeId
          ? String(body.employeeId)
          : undefined;
        const monthlyType =
          body.monthlyType != null && body.monthlyType !== ""
            ? String(body.monthlyType)
            : body.monthlyExpenseType != null && body.monthlyExpenseType !== ""
              ? String(body.monthlyExpenseType).toUpperCase()
              : undefined;
        const monthlyTypeCustomRaw =
          body.monthlyTypeCustom ?? body.monthlyExpenseCustomName;
        const monthlyTypeCustom =
          monthlyType === "CUSTOM" && monthlyTypeCustomRaw
            ? String(monthlyTypeCustomRaw).trim() || null
            : null;
        const created = await prisma.expense.create({
          data: {
            workspaceId,
            title: String(body.title ?? body.note ?? "Xarajat"),
            amount: Number(body.amount ?? 0),
            category: (body.category as never) ?? "OTHER",
            date: new Date(String(body.date ?? Date.now())),
            notes: body.notes ? String(body.notes) : undefined,
            receiptUrl: body.receiptUrl ? String(body.receiptUrl) : undefined,
            employeeId: employeeId || undefined,
            monthlyType: (monthlyType as never) || undefined,
            monthlyTypeCustom: monthlyTypeCustom || undefined,
          },
          include: { employee: { include: { company: true } } },
        });
        return ok(
          {
            ...created,
            employee: created.employee
              ? sanitizeEmployeeForRole(
                  created.employee as Record<string, unknown>,
                  auth.user.role
                )
              : null,
          },
          201
        );
      }
      case "maintenance":
        return ok(
          await prisma.maintenance.create({
            data: {
              workspaceId,
              propertyId: String(body.propertyId),
              title: String(body.title ?? body.issue ?? ""),
              description: String(body.description ?? body.issue ?? ""),
              cost: Number(body.cost ?? 0),
              status: (body.status as never) ?? "PENDING",
              images: (body.images as string[]) ?? [],
            },
            include: { property: true },
          }),
          201
        );
      case "notifications":
        return ok(
          await prisma.notification.create({
            data: {
              workspaceId,
              title: String(body.title ?? ""),
              message: String(body.message ?? ""),
              type: (body.type as never) ?? "INFO",
              userId: auth.user.id,
            },
          }),
          201
        );
      default:
        return fail("Topilmadi", 404);
    }
  } catch {
    return fail("Saqlash xatosi", 500);
  }
}
