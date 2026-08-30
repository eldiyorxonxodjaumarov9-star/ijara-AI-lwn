import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { assertStaffCanManageTasks } from "@/lib/api-server/tasks/task-service";
import { isStaffRole } from "@/lib/tasks/task-shared";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const attachment = await prisma.workTaskAttachment.findUnique({
    where: { id },
    include: {
      report: {
        include: {
          task: true,
        },
      },
    },
  });
  if (!attachment) return fail("Topilmadi", 404);

  const staff = isStaffRole(auth.user.role);
  if (!staff) {
    return fail("Ruxsat yo‘q", 403);
  }
  try {
    await assertStaffCanManageTasks(auth.user);
  } catch {
    return fail("Ruxsat yo‘q", 403);
  }

  // Do not expose telegram file URLs with bot token — only permanent storageUrl
  return ok({
    id: attachment.id,
    type: attachment.type,
    url: attachment.storageUrl,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
  });
}
