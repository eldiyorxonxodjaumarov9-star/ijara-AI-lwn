import type { TelegramAiLead, TelegramAiLeadStatus } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";

export const TELEGRAM_AI_LEAD_SOURCE = "TELEGRAM_AI";

export type TelegramAiLeadUpsertInput = {
  telegramUserId: string;
  telegramUsername?: string | null;
  displayName?: string | null;
  phone?: string | null;
  desiredArea?: number | null;
  businessType?: string | null;
  peopleCount?: number | null;
  moveInDate?: string | null;
  budget?: number | null;
  interestedRoomIds?: string[] | null;
  conversationSummary?: string | null;
  status?: TelegramAiLeadStatus | null;
};

const TERMINAL_OR_ADVANCED: ReadonlySet<TelegramAiLeadStatus> = new Set([
  "VIEWING_REQUESTED",
  "HANDOFF",
  "CLOSED",
  "LOST",
]);

export function computeTelegramAiLeadStatus(input: {
  desiredArea: number | null;
  businessType: string | null;
  peopleCount: number | null;
  moveInDate: string | null;
}): TelegramAiLeadStatus {
  const hasArea = input.desiredArea !== null && input.desiredArea > 0;
  const hasBusiness =
    input.businessType !== null && input.businessType.trim().length > 0;
  const hasPeople = input.peopleCount !== null && input.peopleCount > 0;
  const hasMoveIn =
    input.moveInDate !== null && input.moveInDate.trim().length > 0;

  if (hasArea && hasBusiness && hasPeople && hasMoveIn) {
    return "QUALIFIED";
  }
  return "QUALIFYING";
}

export function mergeInterestedRoomIds(
  existing: readonly string[],
  incoming: readonly string[] | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...existing, ...(incoming ?? [])]) {
    const trimmed = String(id ?? "").trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return trimmed.slice(0, 32);
}

/**
 * Upsert by telegramUserId. Never invents phone. Does not downgrade advanced statuses.
 */
export async function upsertTelegramAiLead(
  input: TelegramAiLeadUpsertInput
): Promise<TelegramAiLead> {
  const telegramUserId = input.telegramUserId.trim();
  if (telegramUserId.length === 0) {
    throw new Error("telegramUserId required");
  }

  const existing = await prisma.telegramAiLead.findUnique({
    where: { telegramUserId },
  });

  const phone =
    input.phone !== undefined ? normalizePhone(input.phone) : existing?.phone ?? null;

  const desiredArea =
    input.desiredArea !== undefined
      ? input.desiredArea
      : existing?.desiredArea ?? null;
  const businessType =
    input.businessType !== undefined
      ? trimOrNull(input.businessType)
      : existing?.businessType ?? null;
  const peopleCount =
    input.peopleCount !== undefined
      ? input.peopleCount
      : existing?.peopleCount ?? null;
  const moveInDate =
    input.moveInDate !== undefined
      ? trimOrNull(input.moveInDate)
      : existing?.moveInDate ?? null;
  const budget =
    input.budget !== undefined ? input.budget : existing?.budget ?? null;

  const interestedRoomIds = mergeInterestedRoomIds(
    existing?.interestedRoomIds ?? [],
    input.interestedRoomIds
  );

  let status: TelegramAiLeadStatus =
    input.status ??
    computeTelegramAiLeadStatus({
      desiredArea,
      businessType,
      peopleCount,
      moveInDate,
    });

  if (existing && TERMINAL_OR_ADVANCED.has(existing.status)) {
    // Do not silently downgrade operator-advanced statuses.
    if (
      !input.status ||
      computeTelegramAiLeadStatus({
        desiredArea,
        businessType,
        peopleCount,
        moveInDate,
      }) === status
    ) {
      if (!input.status) status = existing.status;
    }
  }

  // If still NEW-ish and we have any qualification field, prefer QUALIFYING.
  if (!input.status && status === "QUALIFYING" && !existing) {
    status = "QUALIFYING";
  }
  if (
    !input.status &&
    !existing &&
    desiredArea === null &&
    businessType === null &&
    peopleCount === null &&
    moveInDate === null
  ) {
    status = "NEW";
  }

  const conversationSummary =
    input.conversationSummary !== undefined
      ? trimOrNull(input.conversationSummary)
      : existing?.conversationSummary ?? null;

  const data = {
    source: TELEGRAM_AI_LEAD_SOURCE,
    telegramUsername:
      input.telegramUsername !== undefined
        ? trimOrNull(input.telegramUsername)
        : existing?.telegramUsername ?? null,
    displayName:
      input.displayName !== undefined
        ? trimOrNull(input.displayName)
        : existing?.displayName ?? null,
    phone,
    desiredArea,
    businessType,
    peopleCount,
    moveInDate,
    budget,
    interestedRoomIds,
    status,
    conversationSummary,
  };

  if (existing) {
    return prisma.telegramAiLead.update({
      where: { telegramUserId },
      data,
    });
  }

  return prisma.telegramAiLead.create({
    data: {
      telegramUserId,
      ...data,
    },
  });
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}
