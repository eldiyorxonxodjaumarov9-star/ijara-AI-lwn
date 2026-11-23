import { NextRequest } from "next/server";
import { z } from "zod";

import { recordActivity } from "@/lib/api-server/activity-events";
import { requireResourceAccess, isAdminRole } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  cancelTask,
  getTaskById,
  mapTask,
  notifyEmployeeTaskAssigned,
  reopenTask,
  reviewTaskReport,
  softDeleteTask,
  updateTask,
} from "@/lib/api-server/tasks/task-service";
import {
  isRecordInWorkspace,
  resolveUserWorkspaceContext,
} from "@/lib/api-server/workspace";
import { assertValidTaskDueDate } from "@/lib/tasks/task-date-validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "tasks", "GET");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  const raw = await getTaskById(id, wsCtx.workspace.id);
  if (!isRecordInWorkspace(raw, wsCtx.workspace.id)) {
    return fail("Topilmadi", 404);
  }
  const task = mapTask(raw);
  if (!task) return fail("Topilmadi", 404);
  return ok(task);
}

const actionSchema = z.object({
  action: z.enum(["approve", "return", "cancel", "resend_telegram", "reopen"]),
  comment: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

const patchSchema = z
  .object({
    title: z.string().min(2).optional(),
    description: z.string().optional().nullable(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    dueAt: z.string().optional().nullable(),
    assignedEmployeeId: z.string().min(1).optional(),
    notifyTelegram: z.boolean().optional(),
  })
  .strict();

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "tasks", "POST");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  const existing = await getTaskById(id);
  if (!isRecordInWorkspace(existing, wsCtx.workspace.id)) {
    return fail("Topilmadi", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("JSON noto‘g‘ri", 400);
  }
  // Double-serialized string bodies (legacy clients) → parse once more.
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return fail("JSON noto‘g‘ri", 400);
    }
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
      await recordActivity({
        workspaceId: wsCtx.workspace.id,
        userId: auth.user.id,
        action: "TASK_COMPLETE",
        entityType: "WorkTask",
        entityId: id,
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
      // Telegram failure must not look like a task mutation failure.
      return ok({
        task,
        telegramDelivery: result.ok ? "SENT" : "FAILED",
        telegramError: result.error ?? null,
      });
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

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "tasks", "PATCH");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  const existing = await getTaskById(id);
  if (!isRecordInWorkspace(existing, wsCtx.workspace.id)) {
    return fail("Topilmadi", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("JSON noto‘g‘ri", 400);
  }
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return fail("JSON noto‘g‘ri", 400);
    }
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Validation xato", 400);
  }
  if (Object.keys(parsed.data).length === 0) {
    return fail("O‘zgarish yo‘q", 400);
  }

  try {
    const dueAt =
      parsed.data.dueAt === undefined
        ? undefined
        : assertValidTaskDueDate(parsed.data.dueAt ?? null);
    const result = await updateTask({
      taskId: id,
      userId: auth.user.id,
      workspaceId: wsCtx.workspace.id,
      source: "WEB",
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      dueAt,
      assignedEmployeeId: parsed.data.assignedEmployeeId,
      notifyTelegram: parsed.data.notifyTelegram,
    });
    await recordActivity({
      workspaceId: wsCtx.workspace.id,
      userId: auth.user.id,
      action: "TASK_UPDATE",
      entityType: "WorkTask",
      entityId: id,
    });
    return ok(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "tasks", "DELETE");
  if (auth.error) return auth.error;

  if (!isAdminRole(auth.user.role)) {
    return fail("O‘chirish faqat admin uchun", 403, "FORBIDDEN");
  }

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  const existing = await getTaskById(id);
  if (!isRecordInWorkspace(existing, wsCtx.workspace.id)) {
    return fail("Topilmadi", 404);
  }

  let reason: string | null = null;
  try {
    const text = await req.text();
    if (text.trim()) {
      const body = JSON.parse(text) as { reason?: string };
      reason = body.reason ?? null;
    }
  } catch {
    /* empty body is fine */
  }

  try {
    const result = await softDeleteTask({
      taskId: id,
      userId: auth.user.id,
      workspaceId: wsCtx.workspace.id,
      source: "WEB",
      reason,
    });
    await recordActivity({
      workspaceId: wsCtx.workspace.id,
      userId: auth.user.id,
      action: "TASK_DELETE",
      entityType: "WorkTask",
      entityId: id,
    });
    return ok(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}
