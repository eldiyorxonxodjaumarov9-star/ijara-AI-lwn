import type {
  WorkTaskPriority,
  WorkTaskSource,
  WorkTaskStatus,
  WorkTaskUnit,
} from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { sendTelegramMessage } from "@/lib/api-server/telegram-bot";
import {
  ACTIVE_TASK_STATUSES,
  formatTaskDueAt,
  isStaffRole,
  isTaskOverdue,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_UNIT_LABELS,
  type CreateTaskInput,
} from "@/lib/tasks/task-shared";
import { MAX_TASK_ATTACHMENTS, dedupeAttachmentsByTelegramId, toPublicAttachmentView } from "@/lib/api-server/tasks/task-attachments";
import { assertCallbackData, assertTaskTransition } from "@/lib/tasks/task-transitions";

const taskInclude = {
  assignedEmployee: {
    include: { company: true },
  },
  createdBy: {
    select: { id: true, fullName: true, email: true, role: true },
  },
  reports: {
    orderBy: { submittedAt: "desc" as const },
    include: {
      attachments: true,
      reviewedBy: { select: { id: true, fullName: true, email: true } },
    },
  },
  statusEvents: {
    orderBy: { createdAt: "desc" as const },
    take: 50,
    include: {
      actor: { select: { id: true, fullName: true, email: true } },
    },
  },
} as const;

function mapTask(task: Awaited<ReturnType<typeof getTaskById>>) {
  if (!task) return null;
  const overdue = isTaskOverdue(task.dueAt, task.status);
  return {
    ...task,
    overdue,
    unitLabel: TASK_UNIT_LABELS[task.unit],
    statusLabel: TASK_STATUS_LABELS[task.status],
    priorityLabel: TASK_PRIORITY_LABELS[task.priority],
    dueAtFormatted: formatTaskDueAt(task.dueAt),
    employeeName: task.assignedEmployee.fullName,
    employeePhone: task.assignedEmployee.phone,
    employeePosition: task.assignedEmployee.position,
    companyName: task.assignedEmployee.company?.name ?? null,
    createdByName: task.createdBy.fullName,
    // Strip raw private Blob URLs from client payloads
    reports: task.reports.map((report) => ({
      ...report,
      attachments: report.attachments.map((a) => toPublicAttachmentView(a)),
    })),
  };
}

async function writeStatusEvent(opts: {
  taskId: string;
  fromStatus: WorkTaskStatus | null;
  toStatus: WorkTaskStatus;
  actorUserId?: string | null;
  actorKind?: string;
  source: WorkTaskSource;
  comment?: string | null;
}) {
  await prisma.workTaskStatusEvent.create({
    data: {
      taskId: opts.taskId,
      fromStatus: opts.fromStatus ?? undefined,
      toStatus: opts.toStatus,
      actorUserId: opts.actorUserId ?? null,
      actorKind: opts.actorKind ?? (opts.actorUserId ? "USER" : "EMPLOYEE"),
      source: opts.source,
      comment: opts.comment ?? null,
    },
  });
}

export async function getTaskById(id: string) {
  return prisma.workTask.findUnique({
    where: { id },
    include: taskInclude,
  });
}

export async function assertStaffCanManageTasks(user: {
  id: string;
  role: string;
  isActive: boolean;
}) {
  if (!user.isActive || !isStaffRole(user.role)) {
    throw Object.assign(new Error("Ruxsat yo‘q"), { status: 403 });
  }
}

export async function createTask(input: CreateTaskInput) {
  const employee = await prisma.employee.findUnique({
    where: { id: input.assignedEmployeeId },
    include: { company: true },
  });
  if (!employee || !employee.active) {
    throw Object.assign(new Error("Faol xodim topilmadi"), { status: 400 });
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.workTask.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        unit: input.unit,
        assignedEmployeeId: input.assignedEmployeeId,
        createdByUserId: input.createdByUserId,
        source: input.source,
        priority: input.priority ?? "NORMAL",
        dueAt: input.dueAt ?? null,
        status: "NEW",
        telegramDelivery: "PENDING",
      },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: created.id,
        fromStatus: null,
        toStatus: "NEW",
        actorUserId: input.createdByUserId,
        actorKind: "USER",
        source: input.source,
        comment: "Vazifa yaratildi",
      },
    });
    return created;
  });

  let delivery: "SENT" | "FAILED" | "PENDING" = "PENDING";
  let lastError: string | null = null;
  if (input.notifyTelegram !== false) {
    const result = await notifyEmployeeTaskAssigned(task.id);
    delivery = result.ok ? "SENT" : "FAILED";
    lastError = result.error ?? null;
  }

  const full = await getTaskById(task.id);
  return { task: mapTask(full), telegramDelivery: delivery, telegramError: lastError };
}

export function buildTaskTelegramMessage(task: NonNullable<Awaited<ReturnType<typeof getTaskById>>>) {
  const overdue = isTaskOverdue(task.dueAt, task.status);
  return (
    `📋 <b>${escapeHtml(task.title)}</b>\n\n` +
    (task.description ? `${escapeHtml(task.description)}\n\n` : "") +
    `🏢 ${TASK_UNIT_LABELS[task.unit]}\n` +
    `⚡ ${TASK_PRIORITY_LABELS[task.priority]}\n` +
    `📅 Muddat: ${formatTaskDueAt(task.dueAt)}${overdue ? " ⚠️ Muddati o‘tgan" : ""}\n` +
    `📌 Holat: ${TASK_STATUS_LABELS[task.status]}`
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function taskActionKeyboard(status: WorkTaskStatus, taskId: string) {
  const start = `task:start:${taskId}`;
  const fail = `task:fail:${taskId}`;
  const done = `task:done:${taskId}`;
  assertCallbackData(start);
  assertCallbackData(fail);
  assertCallbackData(done);
  if (status === "NEW") {
    return {
      inline_keyboard: [
        [
          { text: "▶️ Boshladim", callback_data: start },
          { text: "❌ Bajarilmadi", callback_data: fail },
        ],
      ],
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      inline_keyboard: [
        [
          { text: "✅ Bajarildi", callback_data: done },
          { text: "❌ Bajarilmadi", callback_data: fail },
        ],
      ],
    };
  }
  return { inline_keyboard: [] as Array<Array<{ text: string; callback_data: string }>> };
}

export async function notifyEmployeeTaskAssigned(taskId: string) {
  const task = await getTaskById(taskId);
  if (!task) return { ok: false, error: "Vazifa topilmadi" };
  const chatId = task.assignedEmployee.telegramChatId;
  if (!chatId) {
    await prisma.workTask.update({
      where: { id: taskId },
      data: {
        telegramDelivery: "FAILED",
        telegramLastError: "Xodim Telegramga bog‘lanmagan",
      },
    });
    return { ok: false, error: "Xodim Telegramga bog‘lanmagan" };
  }

  try {
    const text = buildTaskTelegramMessage(task);
    await sendTelegramMessage(chatId, text, {
      reply_markup: taskActionKeyboard(task.status, task.id),
    });
    await prisma.workTask.update({
      where: { id: taskId },
      data: {
        telegramDelivery: "SENT",
        telegramLastError: null,
      },
    });
    return { ok: true as const };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Telegram xatosi";
    const message = raw.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot***").slice(0, 500);
    await prisma.workTask.update({
      where: { id: taskId },
      data: {
        telegramDelivery: "FAILED",
        telegramLastError: message,
      },
    });
    return { ok: false, error: message };
  }
}

export async function listTasks(opts: {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  unit?: WorkTaskUnit;
  status?: WorkTaskStatus;
  employeeId?: string;
  priority?: WorkTaskPriority;
  overdueOnly?: boolean;
  assignedEmployeeId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (opts.unit) where.unit = opts.unit;
  if (opts.status) where.status = opts.status;
  if (opts.employeeId) where.assignedEmployeeId = opts.employeeId;
  if (opts.assignedEmployeeId) where.assignedEmployeeId = opts.assignedEmployeeId;
  if (opts.priority) where.priority = opts.priority;
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search, mode: "insensitive" } },
      { description: { contains: opts.search, mode: "insensitive" } },
      {
        assignedEmployee: {
          fullName: { contains: opts.search, mode: "insensitive" },
        },
      },
    ];
  }
  if (opts.overdueOnly) {
    where.status = { in: ACTIVE_TASK_STATUSES };
    where.dueAt = { lt: new Date() };
  }

  const [total, rows] = await Promise.all([
    prisma.workTask.count({ where }),
    prisma.workTask.findMany({
      where,
      include: taskInclude,
      orderBy: { createdAt: "desc" },
      skip: opts.skip,
      take: opts.limit,
    }),
  ]);

  return {
    total,
    data: rows.map((t) => mapTask(t)),
  };
}

export async function getTaskStats() {
  const groups = await prisma.workTask.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(
    groups.map((g) => [g.status, g._count._all])
  ) as Partial<Record<WorkTaskStatus, number>>;
  const overdue = await prisma.workTask.count({
    where: {
      status: { in: ACTIVE_TASK_STATUSES },
      dueAt: { lt: new Date() },
    },
  });
  return { byStatus, overdue, total: groups.reduce((s, g) => s + g._count._all, 0) };
}

export async function startTask(opts: {
  taskId: string;
  employeeId: string;
  source: WorkTaskSource;
}) {
  const task = await prisma.workTask.findUnique({ where: { id: opts.taskId } });
  if (!task) throw Object.assign(new Error("Vazifa topilmadi"), { status: 404 });
  if (task.assignedEmployeeId !== opts.employeeId) {
    throw Object.assign(new Error("Bu vazifa sizniki emas"), { status: 403 });
  }
  assertTaskTransition({
    from: task.status,
    to: "IN_PROGRESS",
    actor: "EMPLOYEE",
  });

  await prisma.$transaction(async (tx) => {
    await tx.workTask.update({
      where: { id: opts.taskId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: opts.taskId,
        fromStatus: "NEW",
        toStatus: "IN_PROGRESS",
        actorKind: "EMPLOYEE",
        source: opts.source,
        comment: "Boshladim",
      },
    });
  });

  return mapTask(await getTaskById(opts.taskId));
}

export async function submitTaskReport(opts: {
  taskId: string;
  employeeId: string;
  source: WorkTaskSource;
  reportText?: string | null;
  attachments?: Array<{
    type: "IMAGE" | "VIDEO" | "DOCUMENT";
    storageUrl: string;
    storageKey?: string | null;
    telegramFileId?: string | null;
    telegramFileUniqueId?: string | null;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  }>;
}) {
  const task = await prisma.workTask.findUnique({ where: { id: opts.taskId } });
  if (!task) throw Object.assign(new Error("Vazifa topilmadi"), { status: 404 });
  if (task.assignedEmployeeId !== opts.employeeId) {
    throw Object.assign(new Error("Bu vazifa sizniki emas"), { status: 403 });
  }
  if (task.status !== "IN_PROGRESS" && task.status !== "NEW") {
    throw Object.assign(new Error("Hisobot yuborish mumkin emas"), { status: 400 });
  }

  const text = opts.reportText?.trim() || "";
  const attachments = dedupeAttachmentsByTelegramId(opts.attachments ?? []);
  if (!text && attachments.length === 0) {
    throw Object.assign(
      new Error("Hisobot matni yoki kamida bitta fayl majburiy"),
      { status: 400 }
    );
  }
  if (attachments.length > MAX_TASK_ATTACHMENTS) {
    throw Object.assign(new Error("Fayllar limiti oshdi"), { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    let fromForSubmit: WorkTaskStatus = task.status;
    if (task.status === "NEW") {
      assertTaskTransition({
        from: "NEW",
        to: "IN_PROGRESS",
        actor: "EMPLOYEE",
      });
      await tx.workTask.update({
        where: { id: opts.taskId },
        data: { status: "IN_PROGRESS", startedAt: task.startedAt ?? new Date() },
      });
      await tx.workTaskStatusEvent.create({
        data: {
          taskId: opts.taskId,
          fromStatus: "NEW",
          toStatus: "IN_PROGRESS",
          actorKind: "EMPLOYEE",
          source: opts.source,
          comment: "Avtomatik boshlandi (hisobot)",
        },
      });
      fromForSubmit = "IN_PROGRESS";
    }

    assertTaskTransition({
      from: fromForSubmit,
      to: "SUBMITTED",
      actor: "EMPLOYEE",
    });

    const report = await tx.workTaskReport.create({
      data: {
        taskId: opts.taskId,
        employeeId: opts.employeeId,
        reportText: text || null,
        reviewStatus: "SUBMITTED",
        attachments: {
          create: attachments.map((a) => ({
            type: a.type,
            storageUrl: a.storageUrl,
            storageKey: a.storageKey ?? null,
            telegramFileId: a.telegramFileId ?? null,
            telegramFileUniqueId: a.telegramFileUniqueId ?? null,
            originalName: a.originalName ?? null,
            mimeType: a.mimeType ?? null,
            size: a.size ?? null,
          })),
        },
      },
    });

    await tx.workTask.update({
      where: { id: opts.taskId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: opts.taskId,
        fromStatus: fromForSubmit,
        toStatus: "SUBMITTED",
        actorKind: "EMPLOYEE",
        source: opts.source,
        comment: `Hisobot: ${report.id}`,
      },
    });
  });

  return mapTask(await getTaskById(opts.taskId));
}

export async function markTaskNotCompleted(opts: {
  taskId: string;
  employeeId: string;
  source: WorkTaskSource;
  reason: string;
  attachments?: Array<{
    type: "IMAGE" | "VIDEO" | "DOCUMENT";
    storageUrl: string;
    storageKey?: string | null;
    telegramFileId?: string | null;
    telegramFileUniqueId?: string | null;
    originalName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  }>;
}) {
  const reason = opts.reason.trim();
  if (!reason) {
    throw Object.assign(new Error("Sabab majburiy"), { status: 400 });
  }
  const task = await prisma.workTask.findUnique({ where: { id: opts.taskId } });
  if (!task) throw Object.assign(new Error("Vazifa topilmadi"), { status: 404 });
  if (task.assignedEmployeeId !== opts.employeeId) {
    throw Object.assign(new Error("Bu vazifa sizniki emas"), { status: 403 });
  }
  assertTaskTransition({
    from: task.status,
    to: "NOT_COMPLETED",
    actor: "EMPLOYEE",
  });

  const attachments = dedupeAttachmentsByTelegramId(opts.attachments ?? []);

  await prisma.$transaction(async (tx) => {
    const report = await tx.workTaskReport.create({
      data: {
        taskId: opts.taskId,
        employeeId: opts.employeeId,
        reportText: reason,
        reviewStatus: "SUBMITTED",
        attachments: {
          create: attachments.map((a) => ({
            type: a.type,
            storageUrl: a.storageUrl,
            storageKey: a.storageKey ?? null,
            telegramFileId: a.telegramFileId ?? null,
            telegramFileUniqueId: a.telegramFileUniqueId ?? null,
            originalName: a.originalName ?? null,
            mimeType: a.mimeType ?? null,
            size: a.size ?? null,
          })),
        },
      },
    });
    await tx.workTask.update({
      where: { id: opts.taskId },
      data: {
        status: "NOT_COMPLETED",
        notCompletedAt: new Date(),
        failureReason: reason,
      },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: opts.taskId,
        fromStatus: task.status,
        toStatus: "NOT_COMPLETED",
        actorKind: "EMPLOYEE",
        source: opts.source,
        comment: `Bajarilmadi: ${report.id}`,
      },
    });
  });

  return mapTask(await getTaskById(opts.taskId));
}

export async function reviewTaskReport(opts: {
  taskId: string;
  reviewerUserId: string;
  approve: boolean;
  comment?: string | null;
  source: WorkTaskSource;
}) {
  const task = await getTaskById(opts.taskId);
  if (!task) throw Object.assign(new Error("Vazifa topilmadi"), { status: 404 });
  if (task.status !== "SUBMITTED") {
    throw Object.assign(new Error("Hisobot ko‘rib chiqish holatida emas"), {
      status: 400,
    });
  }
  const latest = task.reports[0];
  if (!latest) {
    throw Object.assign(new Error("Hisobot topilmadi"), { status: 400 });
  }

  const comment = opts.comment?.trim() || null;
  if (!opts.approve && !comment) {
    throw Object.assign(new Error("Qaytarish uchun izoh majburiy"), {
      status: 400,
    });
  }

  const toStatus: WorkTaskStatus = opts.approve ? "COMPLETED" : "IN_PROGRESS";
  assertTaskTransition({
    from: "SUBMITTED",
    to: toStatus,
    actor: "USER",
  });

  await prisma.$transaction(async (tx) => {
    await tx.workTaskReport.update({
      where: { id: latest.id },
      data: {
        reviewStatus: opts.approve ? "APPROVED" : "RETURNED",
        reviewedByUserId: opts.reviewerUserId,
        reviewedAt: new Date(),
        reviewComment: comment,
      },
    });
    await tx.workTask.update({
      where: { id: opts.taskId },
      data: {
        status: toStatus,
        completedAt: opts.approve ? new Date() : null,
      },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: opts.taskId,
        fromStatus: "SUBMITTED",
        toStatus,
        actorUserId: opts.reviewerUserId,
        actorKind: "USER",
        source: opts.source,
        comment: comment ?? (opts.approve ? "Tasdiqlandi" : "Qaytarildi"),
      },
    });
  });

  const chatId = task.assignedEmployee.telegramChatId;
  if (chatId) {
    try {
      if (opts.approve) {
        await sendTelegramMessage(
          chatId,
          `✅ Hisobotingiz tasdiqlandi.\n\n📋 <b>${escapeHtml(task.title)}</b>`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `↩️ Hisobot qaytarildi.\n\n📋 <b>${escapeHtml(task.title)}</b>\n\n` +
            `💬 Izoh: ${escapeHtml(comment ?? "")}\n\nIltimos, qayta bajaring.`,
          { reply_markup: taskActionKeyboard("IN_PROGRESS", task.id) }
        );
      }
    } catch {
      // notification failure must not roll back review
    }
  }

  return mapTask(await getTaskById(opts.taskId));
}

export async function cancelTask(opts: {
  taskId: string;
  userId: string;
  reason?: string | null;
  source: WorkTaskSource;
}) {
  const task = await prisma.workTask.findUnique({ where: { id: opts.taskId } });
  if (!task) throw Object.assign(new Error("Vazifa topilmadi"), { status: 404 });
  assertTaskTransition({
    from: task.status,
    to: "CANCELLED",
    actor: "USER",
  });

  await prisma.$transaction(async (tx) => {
    await tx.workTask.update({
      where: { id: opts.taskId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: opts.reason?.trim() || null,
      },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: opts.taskId,
        fromStatus: task.status,
        toStatus: "CANCELLED",
        actorUserId: opts.userId,
        actorKind: "USER",
        source: opts.source,
        comment: opts.reason?.trim() || "Bekor qilindi",
      },
    });
  });

  return mapTask(await getTaskById(opts.taskId));
}

/** Admin/menejer: NOT_COMPLETED → IN_PROGRESS */
export async function reopenTask(opts: {
  taskId: string;
  userId: string;
  source: WorkTaskSource;
  comment?: string | null;
}) {
  const task = await prisma.workTask.findUnique({ where: { id: opts.taskId } });
  if (!task) throw Object.assign(new Error("Vazifa topilmadi"), { status: 404 });
  assertTaskTransition({
    from: task.status,
    to: "IN_PROGRESS",
    actor: "USER",
  });

  await prisma.$transaction(async (tx) => {
    await tx.workTask.update({
      where: { id: opts.taskId },
      data: {
        status: "IN_PROGRESS",
        notCompletedAt: null,
        failureReason: null,
        startedAt: task.startedAt ?? new Date(),
      },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: opts.taskId,
        fromStatus: task.status,
        toStatus: "IN_PROGRESS",
        actorUserId: opts.userId,
        actorKind: "USER",
        source: opts.source,
        comment: opts.comment?.trim() || "Qayta ochildi",
      },
    });
  });

  return mapTask(await getTaskById(opts.taskId));
}

export { mapTask, writeStatusEvent };
