import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  getPostingChannelsPublic,
  updatePostingChannel,
} from "@/lib/api-server/posting/channels";
import type { PostingPlatform } from "@/lib/posting/types";
import { POSTING_PLATFORMS } from "@/lib/posting/types";
import {
  requireAnyStaffUser,
  requireStaffUser,
} from "@/lib/api-server/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const channels = await getPostingChannelsPublic();
    return ok(channels);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kanallarni yuklash xatosi";
    return fail(message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  // Secrets / channel config — privileged staff only
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      platform?: PostingPlatform;
      enabled?: boolean;
      settings?: Record<string, string>;
      secrets?: Record<string, string>;
    };

    if (!body.platform || !POSTING_PLATFORMS.includes(body.platform)) {
      return fail("Platforma noto'g'ri", 400);
    }

    await updatePostingChannel(body.platform, {
      enabled: body.enabled,
      settings: body.settings,
      secrets: body.secrets,
    });

    const channels = await getPostingChannelsPublic();
    return ok(channels.find((c) => c.platform === body.platform));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Saqlash xatosi";
    return fail(message, 500);
  }
}
