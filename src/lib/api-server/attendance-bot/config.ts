/**
 * Independent attendance bot config.
 * NEVER reads TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET.
 */

export function isAttendanceBotEnabled() {
  const flag = process.env.IJARA_ATTENDANCE_ENABLED?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function attendanceBotToken() {
  return process.env.IJARA_ATTENDANCE_BOT_TOKEN?.trim() || "";
}

export function attendanceWebhookSecret() {
  return process.env.IJARA_ATTENDANCE_WEBHOOK_SECRET?.trim() || "";
}

export function attendanceGroupId() {
  return process.env.IJARA_ATTENDANCE_GROUP_ID?.trim() || "";
}

/** Optional fixed workspace for auto-created attendance profiles. */
export function attendanceWorkspaceIdFromEnv() {
  return process.env.IJARA_ATTENDANCE_WORKSPACE_ID?.trim() || "";
}

/** True when chat is the configured attendance group (supports negative IDs). */
export function isAttendanceGroupChat(chatId: string | number) {
  const configured = attendanceGroupId();
  if (!configured) return false;
  return String(chatId) === configured;
}

export function isAttendanceBotConfigured() {
  return (
    isAttendanceBotEnabled() &&
    Boolean(attendanceBotToken()) &&
    Boolean(attendanceGroupId())
  );
}

export function attendanceMediaRetentionDays() {
  const n = Number(process.env.IJARA_ATTENDANCE_MEDIA_RETENTION_DAYS || "90");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}
