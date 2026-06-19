import { NextRequest } from "next/server";

import { mapTenantCreate } from "@/lib/api-server/tenants";
import { upsertClientFromTenant } from "@/lib/api-server/clients";
import { upsertContractFromTenant } from "@/lib/api-server/contract-sync";
import { notifyTenantPaymentReceived } from "@/lib/api-server/tenant-notifications";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

const ALLOWED = [
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
] as const;

type Resource = (typeof ALLOWED)[number];

function delegate(resource: string) {
  return ALLOWED.includes(resource as Resource) ? (resource as Resource) : null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { resource } = await ctx.params;
  const name = delegate(resource);
  if (!name) return fail("Topilmadi", 404);

  const { page, limit, skip, sortBy, order } = parsePagination(new URL(req.url));

  switch (name) {
    case "tenants": {
      const [data, total] = await Promise.all([
        prisma.tenant.findMany({ skip, take: limit, orderBy: { [sortBy]: order } }),
        prisma.tenant.count(),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "contracts": {
      const [data, total] = await Promise.all([
        prisma.contract.findMany({
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: { property: true, tenant: true },
        }),
        prisma.contract.count(),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "payments": {
      const [data, total] = await Promise.all([
        prisma.payment.findMany({
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: { contract: { include: { property: true, tenant: true } } },
        }),
        prisma.payment.count(),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "expenses": {
      const [data, total] = await Promise.all([
        prisma.expense.findMany({ skip, take: limit, orderBy: { [sortBy]: order } }),
        prisma.expense.count(),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "maintenance": {
      const [data, total] = await Promise.all([
        prisma.maintenance.findMany({
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: { property: true },
        }),
        prisma.maintenance.count(),
      ]);
      return ok(paginated(data, total, page, limit));
    }
    case "notifications": {
      const [data, total] = await Promise.all([
        prisma.notification.findMany({
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
        }),
        prisma.notification.count(),
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
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { resource } = await ctx.params;
  const name = delegate(resource);
  if (!name) return fail("Topilmadi", 404);

  const body = (await req.json()) as Record<string, unknown>;

  try {
    switch (name) {
      case "tenants": {
        const created = await prisma.tenant.create({
          data: mapTenantCreate(body),
        });
        await upsertClientFromTenant(created);
        await upsertContractFromTenant(created);
        return ok(created, 201);
      }
      case "contracts":
        return ok(
          await prisma.contract.create({
            data: {
              propertyId: String(body.propertyId),
              tenantId: String(body.tenantId),
              startDate: new Date(String(body.startDate)),
              endDate: new Date(String(body.endDate)),
              monthlyRent: Number(body.monthlyRent ?? body.monthlyPayment ?? 0),
              deposit: Number(body.deposit ?? 0),
              status: (body.status as never) ?? "ACTIVE",
              notes: body.notes ? String(body.notes) : undefined,
            },
            include: { property: true, tenant: true },
          }),
          201
        );
      case "payments": {
        const created = await prisma.payment.create({
          data: {
            contractId: String(body.contractId),
            amount: Number(body.amount ?? 0),
            paymentDate: new Date(
              String(body.paymentDate ?? body.date ?? Date.now())
            ),
            paymentMethod: (body.paymentMethod as never) ?? "CASH",
            notes: body.notes ? String(body.notes) : undefined,
          },
          include: {
            contract: { include: { property: true, tenant: true } },
          },
        });
        try {
          await notifyTenantPaymentReceived(created);
        } catch {
          /* xabar yuborilmasa ham to'lov saqlanadi */
        }
        return ok(created, 201);
      }
      case "expenses":
        return ok(
          await prisma.expense.create({
            data: {
              title: String(body.title ?? body.note ?? "Xarajat"),
              amount: Number(body.amount ?? 0),
              category: (body.category as never) ?? "OTHER",
              date: new Date(String(body.date ?? Date.now())),
              notes: body.notes ? String(body.notes) : undefined,
              receiptUrl: body.receiptUrl ? String(body.receiptUrl) : undefined,
            },
          }),
          201
        );
      case "maintenance":
        return ok(
          await prisma.maintenance.create({
            data: {
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
