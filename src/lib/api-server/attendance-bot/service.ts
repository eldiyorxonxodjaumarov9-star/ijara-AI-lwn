import { prisma } from "@/lib/api-server/prisma";
import { normalizePhone } from "@/lib/api-server/tenant-lookup";
import { submitTaskReport } from "@/lib/api-server/tasks/task-service";
import {
  getTashkentDateParts,
  getTashkentDateTimeParts,
} from "@/lib/payment-due-schedule";
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks/task-shared";
import { assertTaskTransition } from "@/lib/tasks/task-transitions";
import {
  attendanceGroupId,
  attendanceWorkspaceIdFromEnv,
  isAttendanceBotConfigured,
} from "@/lib/api-server/attendance-bot/config";
import { attendanceSendMessage } from "@/lib/api-server/attendance-bot/telegram";
import type { AttendanceProfileStatus } from "@prisma/client";

const AUTO_EMPLOYEE_NOTE_PREFIX = "ATTENDANCE_AUTO:UNVERIFIED";

export function tashkentWorkDate(now = new Date()) {
  const p = getTashkentDateParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function formatKeldiDateDisplay(now = new Date()) {
  const p = getTashkentDateParts(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}.${pad(p.month)}.${p.year}`;
}

export function formatKeldiTimeDisplay(now = new Date()) {
  const p = getTashkentDateTimeParts(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function phonesMatch(a: string, b: string) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.slice(-9) === nb.slice(-9);
}

export function buildTelegramDisplayName(from: {
  first_name?: string;
  last_name?: string;
  username?: string;
  id: number | string;
}) {
  const parts = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  if (from.username) return `@${from.username}`;
  return `Telegram ${from.id}`;
}

export async function resolveAttendanceWorkspaceId() {
  const fromEnv = attendanceWorkspaceIdFromEnv();
  if (fromEnv) return fromEnv;
  const ws = await prisma.workspace.findFirst({
    where: { isInternal: true },
    select: { id: true },
  });
  if (!ws) {
    throw Object.assign(new Error("Davomat workspace topilmadi"), { status: 500 });
  }
  return ws.id;
}

export async function findLinkByTelegramUserId(telegramUserId: string) {
  return prisma.attendanceBotLink.findUnique({
    where: { telegramUserId },
    include: { employee: true },
  });
}

/**
 * Guruh selfisidan avtomatik profil.
 * Telefon/kontakt talab qilinmaydi. Bir Telegram ID — bitta link.
 */
export async function ensureAttendanceProfileFromTelegram(opts: {
  telegramUserId: string;
  telegramChatId: string | number;
  firstName?: string;
  lastName?: string;
  username?: string;
}) {
  const existing = await findLinkByTelegramUserId(opts.telegramUserId);
  const displayName = buildTelegramDisplayName({
    id: opts.telegramUserId,
    first_name: opts.firstName,
    last_name: opts.lastName,
    username: opts.username,
  });

  if (existing) {
    const link = await prisma.attendanceBotLink.update({
      where: { id: existing.id },
      data: {
        telegramChatId: String(opts.telegramChatId),
        telegramUsername: opts.username ?? existing.telegramUsername,
        telegramDisplayName: displayName,
      },
      include: { employee: true },
    });
    return { link, created: false as const };
  }

  const workspaceId = await resolveAttendanceWorkspaceId();

  const employee = await prisma.employee.create({
    data: {
      workspaceId,
      fullName: displayName,
      phone: null,
      position: "Davomat (tasdiqlanmagan)",
      monthlySalary: 0,
      active: true,
      notes: `${AUTO_EMPLOYEE_NOTE_PREFIX} tg=${opts.telegramUserId}`,
    },
  });

  const link = await prisma.attendanceBotLink.create({
    data: {
      workspaceId,
      employeeId: employee.id,
      telegramUserId: opts.telegramUserId,
      telegramChatId: String(opts.telegramChatId),
      telegramUsername: opts.username ?? null,
      telegramDisplayName: displayName,
      profileStatus: "UNVERIFIED",
    },
    include: { employee: true },
  });

  return { link, created: true as const };
}

/** Admin keyinroq UNVERIFIED profilni mavjud employee bilan birlashtiradi. */
export async function mergeAttendanceProfileToEmployee(opts: {
  telegramUserId: string;
  targetEmployeeId: string;
}) {
  const link = await findLinkByTelegramUserId(opts.telegramUserId);
  if (!link) {
    return { ok: false as const, reason: "LINK_NOT_FOUND" as const };
  }
  const target = await prisma.employee.findFirst({
    where: { id: opts.targetEmployeeId, active: true },
  });
  if (!target?.workspaceId) {
    return { ok: false as const, reason: "EMPLOYEE_NOT_FOUND" as const };
  }
  if (target.workspaceId !== link.workspaceId) {
    return { ok: false as const, reason: "WORKSPACE_MISMATCH" as const };
  }

  const oldEmployeeId = link.employeeId;
  const wasAuto =
    link.employee.notes?.startsWith(AUTO_EMPLOYEE_NOTE_PREFIX) === true;

  const updated = await prisma.$transaction(async (tx) => {
    const other = await tx.attendanceBotLink.findFirst({
      where: {
        employeeId: target.id,
        workspaceId: target.workspaceId!,
        NOT: { id: link.id },
      },
    });
    if (other) {
      throw Object.assign(new Error("Maqsad xodim allaqachon bog‘langan"), {
        status: 409,
      });
    }

    const next = await tx.attendanceBotLink.update({
      where: { id: link.id },
      data: {
        employeeId: target.id,
        workspaceId: target.workspaceId!,
        profileStatus: "VERIFIED",
        phone: target.phone ? normalizePhone(target.phone) : link.phone,
      },
      include: { employee: true },
    });

    await tx.attendanceCheckIn.updateMany({
      where: { linkId: link.id },
      data: {
        employeeId: target.id,
        workspaceId: target.workspaceId!,
        verificationStatus: "VERIFIED",
      },
    });

    if (wasAuto && oldEmployeeId !== target.id) {
      await tx.employee.delete({ where: { id: oldEmployeeId } }).catch(() => null);
    }

    return next;
  });

  return { ok: true as const, link: updated };
}

export function displayNameForAttendanceLink(link: {
  profileStatus: AttendanceProfileStatus;
  telegramDisplayName: string | null;
  employee: { fullName: string };
}) {
  if (link.profileStatus === "VERIFIED") {
    return link.employee.fullName;
  }
  return link.telegramDisplayName || link.employee.fullName;
}

export async function recordKeldiCheckIn(opts: {
  linkId: string;
  employeeId: string;
  workspaceId: string;
  profileStatus: AttendanceProfileStatus;
  selfieFileId: string;
  selfieUniqueId?: string | null;
  telegramMessageId?: string | null;
  now?: Date;
}) {
  const workDate = tashkentWorkDate(opts.now);
  const existing = await prisma.attendanceCheckIn.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: opts.employeeId,
        workDate,
      },
    },
  });
  if (existing) {
    return { created: false as const, checkIn: existing, workDate };
  }

  const verificationStatus: AttendanceProfileStatus =
    opts.profileStatus === "VERIFIED" ? "VERIFIED" : "UNVERIFIED";

  const checkIn = await prisma.attendanceCheckIn.create({
    data: {
      workspaceId: opts.workspaceId,
      employeeId: opts.employeeId,
      linkId: opts.linkId,
      workDate,
      status: "KELDI",
      verificationStatus,
      selfieFileId: opts.selfieFileId,
      selfieUniqueId: opts.selfieUniqueId ?? null,
      telegramMessageId: opts.telegramMessageId
        ? String(opts.telegramMessageId)
        : null,
    },
  });

  // Best-effort: persist selfie locally for admin dashboard (never block KELDI)
  try {
    const { ensureAttendanceSelfieStored } = await import(
      "@/lib/api-server/attendance-bot/media"
    );
    await ensureAttendanceSelfieStored(checkIn.id);
  } catch {
    /* media restore optional */
  }

  const refreshed = await prisma.attendanceCheckIn.findUnique({
    where: { id: checkIn.id },
  });
  return { created: true as const, checkIn: refreshed ?? checkIn, workDate };
}

export function buildKeldiGroupMessage(opts: {
  displayName: string;
  unverified: boolean;
  taskCount: number;
  now?: Date;
  duplicate?: boolean;
}) {
  const now = opts.now ?? new Date();
  const nameLine = opts.unverified
    ? `${escapeHtml(opts.displayName)} <i>(tasdiqlanmagan)</i>`
    : escapeHtml(opts.displayName);
  const header = opts.duplicate
    ? `ℹ️ Bugun allaqachon qayd etilgan.\nVazifalar yangilanmoqda…`
    : `✅ <b>ISHGA KELDINGIZ!</b>`;

  return (
    `${header}\n\n` +
    `👤 Xodim: ${nameLine}\n` +
    `📅 Sana: ${formatKeldiDateDisplay(now)}\n` +
    `🕗 Kelgan vaqt: ${formatKeldiTimeDisplay(now)}\n\n` +
    `📋 Bugungi vazifalar: ${opts.taskCount} ta`
  );
}

export async function listOpenTasksForEmployee(employeeId: string) {
  const actionable = ACTIVE_TASK_STATUSES.filter((s) => s !== "SUBMITTED");
  return prisma.workTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      deletedAt: null,
      status: { in: actionable },
    },
    orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }],
    take: 20,
  });
}

export function taskDoneCallbackData(taskId: string) {
  return `att:done:${taskId}`;
}

export function parseTaskDoneCallback(data: string | undefined) {
  if (!data?.startsWith("att:done:")) return null;
  const taskId = data.slice("att:done:".length).trim();
  return taskId || null;
}

/**
 * Oddiy vazifa: BAJARDIM → SUBMITTED (audit) → COMPLETED.
 * Asosiy Telegram bot / admin approval oqimiga tegmaydi.
 */
export async function markTaskBajardim(opts: {
  taskId: string;
  employeeId: string;
}) {
  await submitTaskReport({
    taskId: opts.taskId,
    employeeId: opts.employeeId,
    source: "TELEGRAM",
    reportText: "Davomat botidan: Bajardim",
  });

  const task = await prisma.workTask.findUnique({
    where: { id: opts.taskId },
    include: {
      reports: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });
  if (!task || task.assignedEmployeeId !== opts.employeeId) {
    throw Object.assign(new Error("Bu vazifa sizniki emas"), { status: 403 });
  }
  if (task.status !== "SUBMITTED") {
    return task;
  }

  assertTaskTransition({
    from: "SUBMITTED",
    to: "COMPLETED",
    actor: "SYSTEM",
  });

  const latest = task.reports[0];
  await prisma.$transaction(async (tx) => {
    if (latest) {
      await tx.workTaskReport.update({
        where: { id: latest.id },
        data: {
          reviewStatus: "APPROVED",
          reviewedAt: new Date(),
          reviewComment: "Davomat boti: avtomatik COMPLETED",
        },
      });
    }
    await tx.workTask.update({
      where: { id: opts.taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    await tx.workTaskStatusEvent.create({
      data: {
        taskId: opts.taskId,
        fromStatus: "SUBMITTED",
        toStatus: "COMPLETED",
        actorKind: "SYSTEM",
        source: "TELEGRAM",
        comment: "Davomat boti BAJARDIM → COMPLETED",
      },
    });
  });

  return prisma.workTask.findUniqueOrThrow({ where: { id: opts.taskId } });
}

export async function notifyAttendanceGroup(text: string) {
  if (!isAttendanceBotConfigured()) return;
  const groupId = attendanceGroupId();
  if (!groupId) return;
  try {
    await attendanceSendMessage(groupId, text);
  } catch {
    // group notify must not break check-in
  }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
