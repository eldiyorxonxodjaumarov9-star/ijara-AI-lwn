import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  getPostingLogsByListingId,
  retryAllEphemeral,
  retryAllPostingJobs,
} from "@/lib/api-server/posting/posting-service";
import { isPostingDbReady } from "@/lib/api-server/posting/db-ready";
import type { ListingPostInput } from "@/lib/posting/types";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      listing?: ListingPostInput;
    };

    if (await isPostingDbReady()) {
      const jobs = await retryAllPostingJobs(id, body.listing);
      return ok(jobs);
    }

    if (!body.listing) {
      return fail("Listing ma'lumoti kerak", 400);
    }

    const jobs = await retryAllEphemeral(id, body.listing);
    return ok(jobs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Qayta tarqatish xatosi";
    return fail(message, 500);
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    const logs = await getPostingLogsByListingId(id);
    return ok(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Log yuklash xatosi";
    return fail(message, 500);
  }
}
