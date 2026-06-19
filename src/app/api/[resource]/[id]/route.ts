import { NextRequest } from "next/server";

import { mapTenantBody, stripTenantSecret } from "@/lib/api-server/tenants";
import { upsertClientFromTenant } from "@/lib/api-server/clients";
import { upsertContractFromTenant } from "@/lib/api-server/contract-sync";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

const ALLOWED = new Set([
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { resource, id } = await ctx.params;
  if (!ALLOWED.has(resource)) return fail("Topilmadi", 404);

  let found: unknown = null;
  switch (resource) {
    case "tenants":
      found = await prisma.tenant.findUnique({ where: { id } });
      if (found) found = stripTenantSecret(found);
      break;
    case "contracts":
      found = await prisma.contract.findUnique({
        where: { id },
        include: { property: true, tenant: true },
      });
      break;
    case "payments":
      found = await prisma.payment.findUnique({
        where: { id },
        include: { contract: { include: { property: true, tenant: true } } },
      });
      break;
    case "expenses":
      found = await prisma.expense.findUnique({ where: { id } });
      break;
    case "maintenance":
      found = await prisma.maintenance.findUnique({
        where: { id },
        include: { property: true },
      });
      break;
    case "notifications":
      found = await prisma.notification.findUnique({ where: { id } });
      break;
  }

  if (!found) return fail("Topilmadi", 404);
  return ok(found);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { resource, id } = await ctx.params;
  if (!ALLOWED.has(resource)) return fail("Topilmadi", 404);
  const body = (await req.json()) as Record<string, unknown>;

  try {
    switch (resource) {
      case "tenants": {
        const updated = await prisma.tenant.update({
          where: { id },
          data: await mapTenantBody(body),
        });
        await upsertClientFromTenant(updated);
        await upsertContractFromTenant(updated);
        return ok(stripTenantSecret(updated));
      }
      case "contracts":
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
      case "payments":
        return ok(await prisma.payment.update({ where: { id }, data: body as never }));
      case "expenses":
        return ok(await prisma.expense.update({ where: { id }, data: body as never }));
      case "maintenance":
        return ok(await prisma.maintenance.update({ where: { id }, data: body as never }));
      case "notifications":
        return ok(
          await prisma.notification.update({
            where: { id },
            data: {
              ...(body.isRead != null ? { isRead: Boolean(body.isRead) } : {}),
              ...(body.read != null ? { isRead: Boolean(body.read) } : {}),
            },
          })
        );
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
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { resource, id } = await ctx.params;
  if (!ALLOWED.has(resource)) return fail("Topilmadi", 404);

  try {
    switch (resource) {
      case "tenants":
        await prisma.tenant.delete({ where: { id } });
        break;
      case "contracts":
        await prisma.contract.delete({ where: { id } });
        break;
      case "payments":
        await prisma.payment.delete({ where: { id } });
        break;
      case "expenses":
        await prisma.expense.delete({ where: { id } });
        break;
      case "maintenance":
        await prisma.maintenance.delete({ where: { id } });
        break;
      case "notifications":
        await prisma.notification.delete({ where: { id } });
        break;
    }
    return ok({ message: "O'chirildi" });
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
