import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  getBotUserStats,
  listBotUsers,
  syncLegacyBotUsers,
} from "@/lib/api-server/telegram-bot-users";

function mapRow(row: Awaited<ReturnType<typeof listBotUsers>>["rows"][number]) {
  const displayName =
    [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
    row.username ||
    "—";

  return {
    id: row.id,
    chatId: row.chatId,
    telegramUserId: row.telegramUserId,
    displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    phone: row.phone,
    selectedRole: row.selectedRole,
    tenantId: row.tenantId,
    tenantName: row.tenant?.fullName ?? null,
    tenantPhone: row.tenant?.phone ?? null,
    startCount: row.startCount,
    firstStartAt: row.firstStartAt.toISOString(),
    lastStartAt: row.lastStartAt.toISOString(),
    phoneVerifiedAt: row.phoneVerifiedAt?.toISOString() ?? null,
  };
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  await syncLegacyBotUsers();

  const { page, limit, skip, search, order } = parsePagination(new URL(req.url));
  const sortOrder = order === "asc" ? "asc" : "desc";
  const [{ rows, total }, stats] = await Promise.all([
    listBotUsers({ skip, limit, search, order: sortOrder }),
    getBotUserStats(),
  ]);

  return ok({
    stats,
    ...paginated(rows.map(mapRow), total, page, limit),
  });
}
