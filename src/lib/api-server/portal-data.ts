import { prisma } from "@/lib/api-server/prisma";
import { stripTenantSecret } from "@/lib/api-server/tenants";
import {
  findTenantByLogin,
  normalizePhone,
} from "@/lib/api-server/tenant-lookup";

export async function resolveTenantByCredentials(
  login: string,
  password: string
) {
  const tenants = await prisma.tenant.findMany();
  const match = await findTenantByLogin(tenants, login, password);
  return match ? stripTenantSecret(match) : null;
}

export async function getPortalDataForTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;

  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    include: {
      property: true,
      tenant: true,
      payments: { orderBy: { paymentDate: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const propertyIds = [...new Set(contracts.map((c) => c.propertyId))];

  const [maintenance, availableProperties] = await Promise.all([
    propertyIds.length > 0
      ? prisma.maintenance.findMany({
          where: { propertyId: { in: propertyIds } },
          include: { property: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.property.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const payments = contracts.flatMap((contract) =>
    contract.payments.map((payment) => ({
      ...payment,
      contract,
    }))
  );

  return {
    tenant: stripTenantSecret(tenant),
    contracts,
    payments,
    maintenance,
    availableProperties,
  };
}

export { normalizePhone, findTenantByLogin };
