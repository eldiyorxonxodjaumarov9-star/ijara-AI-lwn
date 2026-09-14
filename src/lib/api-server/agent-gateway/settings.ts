import type { AgentSettings, Prisma } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";

export async function getOrCreateAgentSettings(): Promise<AgentSettings> {
  const existing = await prisma.agentSettings.findUnique({
    where: { id: "default" },
  });
  if (existing) return existing;
  return prisma.agentSettings.create({
    data: {
      id: "default",
      masterEnabled: false,
      dryRunDefault: true,
      timezone: "Asia/Tashkent",
      dailyReportHour: 8,
    },
  });
}

export async function updateAgentSettings(
  data: Prisma.AgentSettingsUpdateInput,
  updatedBy?: string
): Promise<AgentSettings> {
  await getOrCreateAgentSettings();
  return prisma.agentSettings.update({
    where: { id: "default" },
    data: { ...data, updatedBy: updatedBy ?? undefined },
  });
}
