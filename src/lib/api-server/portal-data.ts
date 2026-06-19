import { prisma } from "@/lib/api-server/prisma";
import {
  findTenantByCredentials,
  normalizePhone,
} from "@/lib/api-server/tenant-lookup";

export async function resolveTenantByCredentials(
  fullName: string,
  phone: string
) {
  const tenants = await prisma.tenant.findMany();
  return findTenantByCredentials(tenants, fullName, phone);
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
    tenant,
    contracts,
    payments,
    maintenance,
    availableProperties,
  };
}

export { normalizePhone, findTenantByCredentials };
