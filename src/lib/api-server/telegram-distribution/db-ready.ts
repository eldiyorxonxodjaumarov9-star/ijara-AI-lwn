import { prisma } from "@/lib/api-server/prisma";

export async function isTelegramDistributionDbReady() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM telegram_channels LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}
