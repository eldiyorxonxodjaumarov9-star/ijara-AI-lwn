import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  getPostingLogs,
  markEphemeralJobPosted,
  markJobPosted,
  retryEphemeralJob,
  retryPostingJob,
} from "@/lib/api-server/posting/posting-service";
import { isPostingDbReady } from "@/lib/api-server/posting/db-ready";
import type { ListingPostInput, PostingPlatform } from "@/lib/posting/types";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    const body = (await req.json()) as {
      action?: "retry" | "mark-posted";
      platform?: PostingPlatform;
      listing?: ListingPostInput;
      legacyLocalId?: string;
    };

    if (body.action === "mark-posted") {
      if (await isPostingDbReady()) {
        const job = await markJobPosted(id);
        return ok(job);
      }
      if (!body.platform || !body.legacyLocalId) {
        return fail("platform va legacyLocalId kerak", 400);
      }
      const job = await markEphemeralJobPosted(body.legacyLocalId, body.platform, id);
      return ok(job);
    }

    if (await isPostingDbReady()) {
      const job = await retryPostingJob(id);
      return ok(job);
    }

    if (!body.platform || !body.listing || !body.legacyLocalId) {
      return fail("Qayta urinish uchun platform va listing ma'lumoti kerak", 400);
    }

    const job = await retryEphemeralJob(body.legacyLocalId, body.platform, body.listing);
    return ok(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "So'rov xatosi";
    return fail(message, 500);
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    const logs = await getPostingLogs(id);
    return ok(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Log yuklash xatosi";
    return fail(message, 500);
  }
}
