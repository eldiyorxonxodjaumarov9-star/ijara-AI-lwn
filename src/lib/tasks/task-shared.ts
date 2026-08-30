import type {
  WorkTaskPriority,
  WorkTaskSource,
  WorkTaskStatus,
  WorkTaskUnit,
} from "@prisma/client";

export const TASK_STATUS_LABELS: Record<WorkTaskStatus, string> = {
  NEW: "Yangi",
  IN_PROGRESS: "Bajarilmoqda",
  SUBMITTED: "Hisobot yuborildi",
  COMPLETED: "Bajarildi",
  NOT_COMPLETED: "Bajarilmadi",
  CANCELLED: "Bekor qilindi",
};

export const TASK_PRIORITY_LABELS: Record<WorkTaskPriority, string> = {
  LOW: "Past",
  NORMAL: "Oddiy",
  HIGH: "Yuqori",
  URGENT: "Shoshilinch",
};

export const TASK_UNIT_LABELS: Record<WorkTaskUnit, string> = {
  SUNNUR: "Sunnur",
  LWN: "LWN",
};

export const ACTIVE_TASK_STATUSES: WorkTaskStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "SUBMITTED",
];

export function isStaffRole(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

export function formatTaskDueAt(
  dueAt: Date | string | null | undefined,
  timeZone = "Asia/Tashkent"
): string {
  if (!dueAt) return "—";
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function isTaskOverdue(
  dueAt: Date | string | null | undefined,
  status: WorkTaskStatus,
  now = new Date()
): boolean {
  if (!dueAt) return false;
  if (!ACTIVE_TASK_STATUSES.includes(status)) return false;
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  return d.getTime() < now.getTime();
}

export function maskPhone(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `***${digits.slice(-4)}`;
}

export type WizardState = {
  kind:
    | "employee_link"
    | "task_report"
    | "task_fail"
    | "admin_create_task";
  taskId?: string;
  step?: string;
  reportText?: string;
  failureReason?: string;
  pendingAttachments?: Array<{
    type: "IMAGE" | "VIDEO" | "DOCUMENT";
    storageUrl: string;
    storageKey?: string;
    telegramFileId?: string;
    telegramFileUniqueId?: string;
    originalName?: string;
    mimeType?: string | null;
    size?: number;
  }>;
  draft?: {
    unit?: WorkTaskUnit;
    employeeId?: string;
    title?: string;
    description?: string;
    priority?: WorkTaskPriority;
    dueAt?: string;
  };
  expiresAt: string;
};

export const WIZARD_TTL_MS = 30 * 60 * 1000;

export function wizardNotExpired(state: WizardState | null | undefined, now = Date.now()) {
  if (!state?.expiresAt) return false;
  return new Date(state.expiresAt).getTime() > now;
}

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  unit: WorkTaskUnit;
  assignedEmployeeId: string;
  createdByUserId: string;
  source: WorkTaskSource;
  priority?: WorkTaskPriority;
  dueAt?: Date | null;
  notifyTelegram?: boolean;
};
