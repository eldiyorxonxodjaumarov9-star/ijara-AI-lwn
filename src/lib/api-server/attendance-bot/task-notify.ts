/**
 * Task assignment delivery via the independent attendance bot → group.
 * Does NOT use the main Ijara bot token or Employee.telegramChatId.
 */
import { prisma } from "@/lib/api-server/prisma";
import {
  attendanceGroupId,
  isAttendanceBotConfigured,
} from "@/lib/api-server/attendance-bot/config";
import {
  escapeHtml,
  taskDoneCallbackData,
} from "@/lib/api-server/attendance-bot/service";
import { attendanceSendMessage } from "@/lib/api-server/attendance-bot/telegram";
import {
  formatTaskDueAt,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_UNIT_LABELS,
} from "@/lib/tasks/task-shared";
import { isTaskOverdue } from "@/lib/tasks/task-shared";

export async function notifyTaskViaAttendanceGroup(taskId: string) {
  if (!isAttendanceBotConfigured()) {
    return { ok: false as const, error: "Davomat boti sozlanmagan" };
  }
  const groupId = attendanceGroupId();
  if (!groupId) {
    return { ok: false as const, error: "Davomat guruh ID yo‘q" };
  }

  const task = await prisma.workTask.findFirst({
    where: { id: taskId, deletedAt: null },
    include: {
      assignedEmployee: {
        include: {
          attendanceLinks: {
            where: { profileStatus: { in: ["VERIFIED", "UNVERIFIED"] } },
            take: 1,
          },
        },
      },
    },
  });
  if (!task) return { ok: false as const, error: "Vazifa topilmadi" };

  const link = task.assignedEmployee.attendanceLinks[0];
  const displayName =
    link?.telegramDisplayName ||
    task.assignedEmployee.fullName ||
    "Xodim";
  const overdue = isTaskOverdue(task.dueAt, task.status);
  const text =
    `📋 <b>Yangi vazifa</b>\n\n` +
    `👤 ${escapeHtml(displayName)}\n` +
    `📌 <b>${escapeHtml(task.title)}</b>\n` +
    (task.description ? `${escapeHtml(task.description)}\n` : "") +
    `\n🏢 ${TASK_UNIT_LABELS[task.unit]}\n` +
    `⚡ ${TASK_PRIORITY_LABELS[task.priority]}\n` +
    `📅 Muddat: ${formatTaskDueAt(task.dueAt)}${overdue ? " ⚠️" : ""}\n` +
    `🔖 Holat: ${TASK_STATUS_LABELS[task.status]}`;

  try {
    await attendanceSendMessage(groupId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `✅ BAJARDIM — ${task.title.slice(0, 28)}`,
              callback_data: taskDoneCallbackData(task.id),
            },
          ],
        ],
      },
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
    return { ok: false as const, error: message };
  }
}
