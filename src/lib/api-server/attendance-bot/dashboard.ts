import type { AttendanceProfileStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import {
  displayNameForAttendanceLink,
  formatKeldiDateDisplay,
  formatKeldiTimeDisplay,
  mergeAttendanceProfileToEmployee,
  tashkentWorkDate,
} from "@/lib/api-server/attendance-bot/service";
import { ensureAttendanceSelfieStored } from "@/lib/api-server/attendance-bot/media";

async function writeAudit(opts: {
  workspaceId: string;
  actorUserId?: string | null;
  action: string;
  linkId?: string | null;
  employeeId?: string | null;
  checkInId?: string | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    await prisma.attendanceAuditLog.create({
      data: {
        workspaceId: opts.workspaceId,
        actorUserId: opts.actorUserId ?? null,
        action: opts.action,
        linkId: opts.linkId ?? null,
        employeeId: opts.employeeId ?? null,
        checkInId: opts.checkInId ?? null,
        details: (opts.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    /* audit must not break */
  }
}

function taskCountsForEmployees(
  tasks: Array<{ assignedEmployeeId: string; status: string }>
) {
  const map = new Map<
    string,
    { total: number; done: number; open: number }
  >();
  for (const t of tasks) {
    const cur = map.get(t.assignedEmployeeId) ?? {
      total: 0,
      done: 0,
      open: 0,
    };
    cur.total += 1;
    if (t.status === "COMPLETED") cur.done += 1;
    else if (
      t.status === "NEW" ||
      t.status === "IN_PROGRESS" ||
      t.status === "SUBMITTED"
    ) {
      cur.open += 1;
    }
    map.set(t.assignedEmployeeId, cur);
  }
  return map;
}

export type AttendanceListFilters = {
  workspaceId: string;
  workDate?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  employeeId?: string | null;
  search?: string | null;
  presence?: "present" | "absent" | null;
  verification?: "VERIFIED" | "UNVERIFIED" | "REJECTED" | null;
  taskFilter?: "done" | "open" | null;
  page?: number;
  limit?: number;
};

export async function getAttendanceDashboardStats(workspaceId: string, workDate?: string) {
  const day = workDate || tashkentWorkDate();

  const verifiedLinks = await prisma.attendanceBotLink.findMany({
    where: {
      workspaceId,
      profileStatus: "VERIFIED",
      employee: { active: true },
    },
    select: { employeeId: true },
  });
  const verifiedEmployeeIds = verifiedLinks.map((l) => l.employeeId);

  const [
    activeEmployees,
    presentToday,
    leftToday,
    unverifiedProfiles,
    tasksCompleted,
    tasksOpen,
  ] = await Promise.all([
    prisma.employee.count({
      where: { workspaceId, active: true },
    }),
    prisma.attendanceCheckIn.count({
      where: { workspaceId, workDate: day },
    }),
    prisma.attendanceCheckIn.count({
      where: { workspaceId, workDate: day, status: "KETDI" },
    }),
    prisma.attendanceBotLink.count({
      where: { workspaceId, profileStatus: "UNVERIFIED" },
    }),
    prisma.workTask.count({
      where: {
        workspaceId,
        deletedAt: null,
        status: "COMPLETED",
        completedAt: {
          gte: new Date(`${day}T00:00:00+05:00`),
          lt: new Date(`${day}T23:59:59.999+05:00`),
        },
      },
    }),
    prisma.workTask.count({
      where: {
        workspaceId,
        deletedAt: null,
        status: { in: ["NEW", "IN_PROGRESS", "SUBMITTED"] },
      },
    }),
  ]);

  const presentEmployeeIds = (
    await prisma.attendanceCheckIn.findMany({
      where: { workspaceId, workDate: day, employeeId: { in: verifiedEmployeeIds } },
      select: { employeeId: true },
      distinct: ["employeeId"],
    })
  ).map((r) => r.employeeId);

  const absentToday = verifiedEmployeeIds.filter(
    (id) => !presentEmployeeIds.includes(id)
  ).length;

  return {
    workDate: day,
    activeEmployees,
    presentToday,
    absentToday,
    leftToday,
    tasksCompleted,
    tasksOpen,
    unverifiedProfiles,
  };
}

export async function listAttendanceCheckIns(filters: AttendanceListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.AttendanceCheckInWhereInput = {
    workspaceId: filters.workspaceId,
  };

  if (filters.workDate) where.workDate = filters.workDate;
  if (filters.dateFrom || filters.dateTo) {
    where.workDate = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.verification) {
    where.verificationStatus = filters.verification as AttendanceProfileStatus;
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { employee: { fullName: { contains: q, mode: "insensitive" } } },
      { link: { telegramDisplayName: { contains: q, mode: "insensitive" } } },
      { link: { telegramUsername: { contains: q, mode: "insensitive" } } },
    ];
  }

  // Absent filter: verified linked actives without check-in that day — handled separately
  if (filters.presence === "absent") {
    const day = filters.workDate || tashkentWorkDate();
    const verified = await prisma.attendanceBotLink.findMany({
      where: {
        workspaceId: filters.workspaceId,
        profileStatus: "VERIFIED",
        employee: { active: true },
      },
      include: { employee: true },
    });
    const present = new Set(
      (
        await prisma.attendanceCheckIn.findMany({
          where: { workspaceId: filters.workspaceId, workDate: day },
          select: { employeeId: true },
        })
      ).map((r) => r.employeeId)
    );
    const absent = verified.filter((l) => !present.has(l.employeeId));
    const slice = absent.slice(skip, skip + limit);
    return {
      mode: "absent" as const,
      total: absent.length,
      page,
      limit,
      items: slice.map((l) => ({
        id: `absent-${l.employeeId}-${day}`,
        workDate: day,
        status: "ABSENT" as const,
        verificationStatus: "VERIFIED" as const,
        arrivedAt: null,
        leftAt: null,
        hasSelfie: false,
        selfieUrl: null as string | null,
        employee: {
          id: l.employee.id,
          fullName: l.employee.fullName,
          active: l.employee.active,
        },
        telegramDisplayName: l.telegramDisplayName,
        telegramUsername: l.telegramUsername,
        profileStatus: l.profileStatus,
        linkId: l.id,
        tasksTotal: 0,
        tasksDone: 0,
        tasksOpen: 0,
      })),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.attendanceCheckIn.findMany({
      where,
      include: {
        employee: true,
        link: true,
      },
      orderBy: [{ createdAt: "desc" }, { workDate: "desc" }],
      skip,
      take: limit,
    }),
    prisma.attendanceCheckIn.count({ where }),
  ]);

  const empIds = [...new Set(rows.map((r) => r.employeeId))];
  const tasks = empIds.length
    ? await prisma.workTask.findMany({
        where: {
          workspaceId: filters.workspaceId,
          assignedEmployeeId: { in: empIds },
          deletedAt: null,
        },
        select: { assignedEmployeeId: true, status: true },
      })
    : [];
  const counts = taskCountsForEmployees(tasks);

  let items = rows.map((r) => {
    const c = counts.get(r.employeeId) ?? { total: 0, done: 0, open: 0 };
    return {
      id: r.id,
      workDate: r.workDate,
      status: r.status,
      verificationStatus: r.verificationStatus,
      arrivedAt: r.createdAt.toISOString(),
      arrivedTimeDisplay: formatKeldiTimeDisplay(r.createdAt),
      dateDisplay: formatKeldiDateDisplay(r.createdAt),
      leftAt: r.leftAt?.toISOString() ?? null,
      leftTimeDisplay: r.leftAt ? formatKeldiTimeDisplay(r.leftAt) : null,
      hasSelfie: Boolean(r.selfieStorageKey || r.selfieFileId),
      selfieUrl: `/api/attendance/selfies/${r.id}`,
      employee: {
        id: r.employee.id,
        fullName: displayNameForAttendanceLink({
          profileStatus: r.link.profileStatus,
          telegramDisplayName: r.link.telegramDisplayName,
          employee: r.employee,
        }),
        active: r.employee.active,
      },
      telegramDisplayName: r.link.telegramDisplayName,
      telegramUsername: r.link.telegramUsername,
      profileStatus: r.link.profileStatus,
      linkId: r.linkId,
      tasksTotal: c.total,
      tasksDone: c.done,
      tasksOpen: c.open,
    };
  });

  if (filters.taskFilter === "done") {
    items = items.filter((i) => i.tasksDone > 0);
  } else if (filters.taskFilter === "open") {
    items = items.filter((i) => i.tasksOpen > 0);
  }
  if (filters.presence === "present") {
    // already only check-ins
  }

  return { mode: "checkins" as const, total, page, limit, items };
}

export async function getAttendanceCheckInDetail(
  workspaceId: string,
  checkInId: string
) {
  const row = await prisma.attendanceCheckIn.findFirst({
    where: { id: checkInId, workspaceId },
    include: {
      employee: true,
      link: true,
    },
  });
  if (!row) return null;

  // Try restore selfie for display
  await ensureAttendanceSelfieStored(row.id).catch(() => null);
  const fresh = await prisma.attendanceCheckIn.findUnique({
    where: { id: row.id },
    include: { employee: true, link: true },
  });
  const r = fresh ?? row;

  const history = await prisma.attendanceCheckIn.findMany({
    where: { workspaceId, employeeId: r.employeeId },
    orderBy: { workDate: "desc" },
    take: 30,
  });

  const dayStart = new Date(`${r.workDate}T00:00:00+05:00`);
  const dayEnd = new Date(`${r.workDate}T23:59:59.999+05:00`);
  const tasks = await prisma.workTask.findMany({
    where: {
      workspaceId,
      assignedEmployeeId: r.employeeId,
      deletedAt: null,
      OR: [
        { status: { in: ["NEW", "IN_PROGRESS", "SUBMITTED"] } },
        {
          status: "COMPLETED",
          completedAt: { gte: dayStart, lte: dayEnd },
        },
        { createdAt: { gte: dayStart, lte: dayEnd } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return {
    id: r.id,
    workDate: r.workDate,
    status: r.status,
    verificationStatus: r.verificationStatus,
    arrivedAt: r.createdAt.toISOString(),
    arrivedTimeDisplay: formatKeldiTimeDisplay(r.createdAt),
    dateDisplay: formatKeldiDateDisplay(r.createdAt),
    leftAt: r.leftAt?.toISOString() ?? null,
    leftTimeDisplay: r.leftAt ? formatKeldiTimeDisplay(r.leftAt) : null,
    hasSelfie: Boolean(r.selfieStorageKey),
    selfieMissing: !r.selfieStorageKey,
    selfieUrl: r.selfieStorageKey ? `/api/attendance/selfies/${r.id}` : null,
    employee: {
      id: r.employee.id,
      fullName: r.employee.fullName,
      active: r.employee.active,
      phone: r.employee.phone,
      position: r.employee.position,
    },
    link: {
      id: r.link.id,
      telegramUserId: r.link.telegramUserId,
      telegramUsername: r.link.telegramUsername,
      telegramDisplayName: r.link.telegramDisplayName,
      profileStatus: r.link.profileStatus,
      verifiedAt: r.link.verifiedAt?.toISOString() ?? null,
      registeredAt: r.link.registeredAt.toISOString(),
    },
    displayName: displayNameForAttendanceLink({
      profileStatus: r.link.profileStatus,
      telegramDisplayName: r.link.telegramDisplayName,
      employee: r.employee,
    }),
    history: history.map((h) => ({
      id: h.id,
      workDate: h.workDate,
      status: h.status,
      arrivedTimeDisplay: formatKeldiTimeDisplay(h.createdAt),
      leftTimeDisplay: h.leftAt ? formatKeldiTimeDisplay(h.leftAt) : null,
      verificationStatus: h.verificationStatus,
      hasSelfie: Boolean(h.selfieStorageKey || h.selfieFileId),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      completedAt: t.completedAt?.toISOString() ?? null,
      completedTimeDisplay: t.completedAt
        ? formatKeldiTimeDisplay(t.completedAt)
        : null,
      submittedAt: t.submittedAt?.toISOString() ?? null,
    })),
  };
}

export async function listUnverifiedAttendanceProfiles(workspaceId: string) {
  const links = await prisma.attendanceBotLink.findMany({
    where: { workspaceId, profileStatus: "UNVERIFIED" },
    include: {
      employee: true,
      checkIns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { registeredAt: "desc" },
  });
  return links.map((l) => ({
    linkId: l.id,
    employeeId: l.employeeId,
    telegramUserId: l.telegramUserId,
    telegramUsername: l.telegramUsername,
    telegramDisplayName: l.telegramDisplayName,
    registeredAt: l.registeredAt.toISOString(),
    lastCheckInId: l.checkIns[0]?.id ?? null,
    lastWorkDate: l.checkIns[0]?.workDate ?? null,
    hasSelfie: Boolean(
      l.checkIns[0]?.selfieStorageKey || l.checkIns[0]?.selfieFileId
    ),
    selfieUrl: l.checkIns[0]
      ? `/api/attendance/selfies/${l.checkIns[0].id}`
      : null,
    autoEmployeeName: l.employee.fullName,
  }));
}

export async function verifyAttendanceProfileAsEmployee(opts: {
  workspaceId: string;
  linkId: string;
  actorUserId: string;
  fullName?: string | null;
}) {
  const link = await prisma.attendanceBotLink.findFirst({
    where: { id: opts.linkId, workspaceId: opts.workspaceId },
    include: { employee: true },
  });
  if (!link) {
    throw Object.assign(new Error("Profil topilmadi"), { status: 404 });
  }
  if (link.profileStatus === "REJECTED") {
    throw Object.assign(new Error("Rad etilgan profil"), { status: 400 });
  }

  const name =
    opts.fullName?.trim() ||
    link.telegramDisplayName ||
    link.employee.fullName;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: link.employeeId },
      data: {
        fullName: name,
        position:
          link.employee.position === "Davomat (tasdiqlanmagan)"
            ? "Xodim"
            : link.employee.position,
        notes: link.employee.notes?.startsWith("ATTENDANCE_AUTO:")
          ? `ATTENDANCE_VERIFIED tg=${link.telegramUserId}`
          : link.employee.notes,
        active: true,
      },
    });
    const next = await tx.attendanceBotLink.update({
      where: { id: link.id },
      data: {
        profileStatus: "VERIFIED",
        verifiedAt: new Date(),
        verifiedByUserId: opts.actorUserId,
        telegramDisplayName: link.telegramDisplayName,
      },
      include: { employee: true },
    });
    await tx.attendanceCheckIn.updateMany({
      where: { linkId: link.id },
      data: { verificationStatus: "VERIFIED" },
    });
    return next;
  });

  await writeAudit({
    workspaceId: opts.workspaceId,
    actorUserId: opts.actorUserId,
    action: "VERIFY",
    linkId: link.id,
    employeeId: link.employeeId,
    details: { fullName: name },
  });

  return updated;
}

export async function mergeAttendanceProfileAdmin(opts: {
  workspaceId: string;
  linkId: string;
  targetEmployeeId: string;
  actorUserId: string;
}) {
  const link = await prisma.attendanceBotLink.findFirst({
    where: { id: opts.linkId, workspaceId: opts.workspaceId },
  });
  if (!link) {
    throw Object.assign(new Error("Profil topilmadi"), { status: 404 });
  }
  const result = await mergeAttendanceProfileToEmployee({
    telegramUserId: link.telegramUserId,
    targetEmployeeId: opts.targetEmployeeId,
  });
  if (!result.ok) {
    throw Object.assign(new Error(result.reason), { status: 400 });
  }
  await prisma.attendanceBotLink.update({
    where: { id: link.id },
    data: {
      verifiedAt: new Date(),
      verifiedByUserId: opts.actorUserId,
    },
  });
  await writeAudit({
    workspaceId: opts.workspaceId,
    actorUserId: opts.actorUserId,
    action: "MERGE",
    linkId: link.id,
    employeeId: opts.targetEmployeeId,
    details: { fromEmployeeId: link.employeeId },
  });
  return result.link;
}

export async function rejectAttendanceProfile(opts: {
  workspaceId: string;
  linkId: string;
  actorUserId: string;
  reason?: string | null;
}) {
  const link = await prisma.attendanceBotLink.findFirst({
    where: { id: opts.linkId, workspaceId: opts.workspaceId },
    include: { employee: true },
  });
  if (!link) {
    throw Object.assign(new Error("Profil topilmadi"), { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.attendanceBotLink.update({
      where: { id: link.id },
      data: {
        profileStatus: "REJECTED",
        rejectedAt: new Date(),
        rejectedByUserId: opts.actorUserId,
        rejectReason: opts.reason?.trim() || null,
      },
    });
    await tx.attendanceCheckIn.updateMany({
      where: { linkId: link.id },
      data: { verificationStatus: "REJECTED" },
    });
    if (link.employee.notes?.startsWith("ATTENDANCE_AUTO:")) {
      await tx.employee.update({
        where: { id: link.employeeId },
        data: { active: false },
      });
    }
    return next;
  });

  await writeAudit({
    workspaceId: opts.workspaceId,
    actorUserId: opts.actorUserId,
    action: "REJECT",
    linkId: link.id,
    employeeId: link.employeeId,
    details: { reason: opts.reason ?? null },
  });

  return updated;
}
