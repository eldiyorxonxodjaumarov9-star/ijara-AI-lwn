import { after } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { ACTIVITY_ACTIONS, type ActivityAction } from "@/lib/usage-analytics";

export type ActivityInput = {
  workspaceId: string;
  action: ActivityAction;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ActivityDb = {
  workspaceActivityEvent: {
    createMany(args: { data: Prisma.WorkspaceActivityEventCreateManyInput[] }): Promise<unknown>;
  };
};

const SENSITIVE_KEY =
  /pass|token|secret|card|cvv|cvc|otp|auth|cookie|session|credential|signature|api_?key|private|^pin$|pin_?code/i;
const MAX_KEYS = 8;
const MAX_STRING = 120;

/** Flat, primitive-only, sensitive keys dropped. Nested objects are discarded. */
export function sanitizeActivityMetadata(
  metadata: Record<string, unknown> | null | undefined
): Prisma.InputJsonObject | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, MAX_STRING);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function toActivityRow(input: ActivityInput): Prisma.WorkspaceActivityEventCreateManyInput | null {
  const def = ACTIVITY_ACTIONS[input.action];
  if (!def || !input.workspaceId) return null;
  return {
    workspaceId: input.workspaceId,
    userId: def.actor === "HUMAN" ? input.userId ?? null : null,
    actorType: def.actor,
    actionType: input.action,
    featureKey: def.feature,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: sanitizeActivityMetadata(input.metadata),
  };
}

/** Never throws: analytics must not break the business action it describes. */
export async function writeActivities(inputs: ActivityInput[], db: ActivityDb = prisma) {
  const data = inputs.map(toActivityRow).filter((row) => row !== null);
  if (data.length === 0) return 0;
  try {
    await db.workspaceActivityEvent.createMany({ data });
    return data.length;
  } catch (error) {
    console.error("[activity-events] write failed", {
      actions: data.map((row) => row.actionType),
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Call only after the business action succeeded. Inside a request the write
 * runs after the response is sent; elsewhere (cron loops, tests) it is awaited.
 */
export async function recordActivity(input: ActivityInput | ActivityInput[]) {
  const inputs = Array.isArray(input) ? input : [input];
  if (inputs.length === 0) return;
  try {
    after(() => writeActivities(inputs).then(() => undefined));
  } catch {
    await writeActivities(inputs);
  }
}
