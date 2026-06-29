import { prisma } from "@/lib/api-server/prisma";
import type { TelegramPostingLogView } from "@/lib/telegram-distribution/types";

export async function appendTelegramLog(
  jobId: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
  meta?: Record<string, unknown>
) {
  const row = await prisma.telegramPostingLog.create({
    data: { jobId, level, message, meta: meta ?? undefined },
  });
  return mapLog(row);
}

export function mapLog(row: {
  id: string;
  jobId: string;
  level: string;
  message: string;
  meta: unknown;
  createdAt: Date;
}): TelegramPostingLogView {
  return {
    id: row.id,
    jobId: row.jobId,
    level: row.level,
    message: row.message,
    meta: (row.meta as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getJobLogs(jobId: string): Promise<TelegramPostingLogView[]> {
  const rows = await prisma.telegramPostingLog.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(mapLog);
}

export async function getListingTelegramLogs(
  listingId: string
): Promise<TelegramPostingLogView[]> {
  const rows = await prisma.telegramPostingLog.findMany({
    where: { job: { listingId } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(mapLog);
}
