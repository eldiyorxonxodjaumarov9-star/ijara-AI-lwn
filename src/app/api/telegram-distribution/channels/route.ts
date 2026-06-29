import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isTelegramDistributionDbReady } from "@/lib/api-server/telegram-distribution/db-ready";
import {
  createTelegramChannel,
  listTelegramChannels,
} from "@/lib/api-server/telegram-distribution/telegram-distribution-service";
import type { TelegramChannelInput } from "@/lib/telegram-distribution/types";

export async function GET() {
  try {
    if (!(await isTelegramDistributionDbReady())) {
      return ok([]);
    }
    const channels = await listTelegramChannels();
    return ok(channels);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Xato", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isTelegramDistributionDbReady())) {
      return fail("Telegram distribution jadvallari migratsiya qilinmagan", 503);
    }
    const body = (await req.json()) as TelegramChannelInput;
    if (!body.name?.trim() || !body.chatId?.trim()) {
      return fail("Nomi va Chat ID majburiy", 400);
    }
    const channel = await createTelegramChannel(body);
    return ok(channel);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Xato", 500);
  }
}
