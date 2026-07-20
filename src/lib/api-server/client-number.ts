import { formatClientNumber, parseClientNumber } from "@/lib/client-number";
import { prisma } from "@/lib/api-server/prisma";

export { formatClientNumber } from "@/lib/client-number";

export async function nextClientNumber() {
  const [tenants, archives] = await Promise.all([
    prisma.tenant.findMany({
      where: { clientNumber: { not: null } },
      select: { clientNumber: true },
    }),
    prisma.tenantArchive.findMany({ select: { clientNumber: true } }),
  ]);

  const max = [...tenants, ...archives].reduce(
    (acc, row) => Math.max(acc, parseClientNumber(row.clientNumber)),
    0
  );
  return formatClientNumber(max + 1);
}

export async function ensureTenantClientNumber(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;
  if (tenant.clientNumber) return tenant.clientNumber;

  const clientNumber = await nextClientNumber();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { clientNumber },
  });
  return clientNumber;
}
