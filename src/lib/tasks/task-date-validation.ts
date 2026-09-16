export const TASK_DATE_MIN_YEAR = 2000;
export const TASK_DATE_MAX_YEAR = 2100;

export const TASK_DATE_INVALID_MESSAGE =
  "Vazifa muddati noto'g'ri. Yil 2000–2100 oralig'ida bo'lishi kerak.";

export function isTaskDateYearInRange(date: Date): boolean {
  const year = date.getFullYear();
  return (
    Number.isFinite(year) &&
    year >= TASK_DATE_MIN_YEAR &&
    year <= TASK_DATE_MAX_YEAR
  );
}

export function parseTaskDueDate(raw: string | Date | null | undefined): Date | null {
  if (raw == null || raw === "") return null;
  const d = typeof raw === "string" ? new Date(raw) : raw;
  if (Number.isNaN(d.getTime())) return null;
  if (!isTaskDateYearInRange(d)) return null;
  return d;
}

/** Server-side validation — throws with Uzbek message. */
export function assertValidTaskDueDate(
  raw: string | Date | null | undefined
): Date | null {
  if (raw == null || raw === "") return null;
  const d = typeof raw === "string" ? new Date(raw) : raw;
  if (Number.isNaN(d.getTime())) {
    throw Object.assign(new Error(TASK_DATE_INVALID_MESSAGE), { status: 400 });
  }
  if (!isTaskDateYearInRange(d)) {
    throw Object.assign(new Error(TASK_DATE_INVALID_MESSAGE), { status: 400 });
  }
  return d;
}

export function isAbsurdTaskDate(
  dueAt: Date | string | null | undefined
): boolean {
  if (!dueAt) return false;
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (Number.isNaN(d.getTime())) return true;
  return !isTaskDateYearInRange(d);
}
