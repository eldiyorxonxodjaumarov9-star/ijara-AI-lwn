import type { AgentSettings, Prisma } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";

/** Agent Gateway kill switch (LWN Telegram agent). Not used by AI Employees. */
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

/** AI Employees settings of one workspace. */
export async function getWorkspaceAgentSettings(workspaceId: string): Promise<AgentSettings> {
  const existing = await prisma.agentSettings.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  return prisma.agentSettings.upsert({
    where: { workspaceId },
    create: {
      id: `ws:${workspaceId}`,
      workspaceId,
      masterEnabled: false,
      dryRunDefault: true,
      timezone: "Asia/Tashkent",
      dailyReportHour: 8,
    },
    update: {},
  });
}

export type WorkspaceAgentSettingsPatch = Partial<
  Pick<
    AgentSettings,
    | "masterEnabled"
    | "managerEnabled"
    | "paymentEnabled"
    | "analystEnabled"
    | "telegramReportsEnabled"
    | "dryRunDefault"
    | "dailyReportHour"
  >
>;

export async function updateWorkspaceAgentSettings(
  workspaceId: string,
  data: WorkspaceAgentSettingsPatch,
  updatedBy?: string
): Promise<AgentSettings> {
  await getWorkspaceAgentSettings(workspaceId);
  return prisma.agentSettings.update({
    where: { workspaceId },
    data: { ...data, updatedBy: updatedBy ?? undefined },
  });
}
