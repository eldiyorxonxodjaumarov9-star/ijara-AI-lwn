import { NextRequest } from "next/server";

import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import {
  deliverDailyManagerTelegram,
  telegramNotifySchema,
} from "@/lib/api-server/agent-gateway/telegram-notify";
import { buildDailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

/**
 * POST /api/internal/agent/v1/notifications/telegram
 * Safe template delivery only — no arbitrary chatId/raw message.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await requireAgentAuth(req, ["notifications:telegram"]);
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }

  // Reject arbitrary recipient / raw message fields explicitly
  if (
    json &&
    typeof json === "object" &&
    ("chatId" in json ||
      "chat_id" in json ||
      "message" in json ||
      "text" in json ||
      "rawMessage" in json)
  ) {
    return fail(
      "Arbitrary Telegram recipient/message taqiqlangan",
      400,
      "TELEGRAM_ARBITRARY_REJECTED"
    );
  }

  const parsed = telegramNotifySchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  }

  const snapshot = await buildDailySnapshot();
  if (snapshot.date !== parsed.data.reportDate) {
    return fail(
      "Hisobot sanasi server sanasiga mos emas",
      409,
      "REPORT_DATE_MISMATCH"
    );
  }

  const result = await deliverDailyManagerTelegram(parsed.data, snapshot);
  return ok(result);
}
