import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  assertStaffCanManageTasks,
  cancelTask,
  getTaskById,
  mapTask,
  notifyEmployeeTaskAssigned,
  reopenTask,
  reviewTaskReport,
} from "@/lib/api-server/tasks/task-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    await assertStaffCanManageTasks(auth.user);
  } catch {
    return fail("Ruxsat yo‘q", 403);
  }

  const { id } = await ctx.params;
  const task = mapTask(await getTaskById(id));
  if (!task) return fail("Topilmadi", 404);
  return ok(task);
}

const actionSchema = z.object({
  action: z.enum(["approve", "return", "cancel", "resend_telegram", "reopen"]),
  comment: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    await assertStaffCanManageTasks(auth.user);
  } catch {
    return fail("Ruxsat yo‘q", 403);
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("JSON noto‘g‘ri", 400);
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return fail("Action noto‘g‘ri", 400);

  try {
    if (parsed.data.action === "approve") {
      const task = await reviewTaskReport({
        taskId: id,
        reviewerUserId: auth.user.id,
        approve: true,
        comment: parsed.data.comment,
        source: "WEB",
      });
      return ok(task);
    }
    if (parsed.data.action === "return") {
      const task = await reviewTaskReport({
        taskId: id,
        reviewerUserId: auth.user.id,
        approve: false,
        comment: parsed.data.comment,
        source: "WEB",
      });
      return ok(task);
    }
    if (parsed.data.action === "cancel") {
      const task = await cancelTask({
        taskId: id,
        userId: auth.user.id,
        reason: parsed.data.reason,
        source: "WEB",
      });
      return ok(task);
    }
    if (parsed.data.action === "resend_telegram") {
      const result = await notifyEmployeeTaskAssigned(id);
      const task = mapTask(await getTaskById(id));
      return ok({ task, ...result });
    }
    if (parsed.data.action === "reopen") {
      const task = await reopenTask({
        taskId: id,
        userId: auth.user.id,
        source: "WEB",
        comment: parsed.data.comment ?? parsed.data.reason,
      });
      return ok(task);
    }
    return fail("Noma’lum action", 400);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}
