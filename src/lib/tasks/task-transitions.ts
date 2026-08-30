import type { WorkTaskStatus } from "@prisma/client";

/** Allowed status transitions. Admin reopen: NOT_COMPLETED → IN_PROGRESS */
const ALLOWED: Record<WorkTaskStatus, WorkTaskStatus[]> = {
  NEW: ["IN_PROGRESS", "NOT_COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["SUBMITTED", "NOT_COMPLETED", "CANCELLED"],
  SUBMITTED: ["COMPLETED", "IN_PROGRESS"],
  COMPLETED: [],
  NOT_COMPLETED: ["IN_PROGRESS"],
  CANCELLED: [],
};

export function assertTaskTransition(opts: {
  from: WorkTaskStatus;
  to: WorkTaskStatus;
  actor: "EMPLOYEE" | "USER" | "SYSTEM";
}) {
  const allowed = ALLOWED[opts.from] ?? [];
  if (!allowed.includes(opts.to)) {
    throw Object.assign(
      new Error(`Holat o‘tishi ruxsat etilmagan: ${opts.from} → ${opts.to}`),
      { status: 400 }
    );
  }
  if (opts.from === "NOT_COMPLETED" && opts.to === "IN_PROGRESS") {
    if (opts.actor !== "USER") {
      throw Object.assign(
        new Error("Faqat admin/menejer vazifani qayta ochishi mumkin"),
        { status: 403 }
      );
    }
  }
  if (
    (opts.from === "COMPLETED" || opts.from === "CANCELLED") &&
    opts.actor === "EMPLOYEE"
  ) {
    throw Object.assign(new Error("Yopilgan vazifani o‘zgartirib bo‘lmaydi"), {
      status: 403,
    });
  }
}

export function isCallbackDataWithinLimit(data: string, max = 64) {
  return Buffer.byteLength(data, "utf8") <= max;
}

export function assertCallbackData(data: string) {
  if (!isCallbackDataWithinLimit(data)) {
    throw new Error(`callback_data 64 baytdan oshdi: ${data.length}`);
  }
}
