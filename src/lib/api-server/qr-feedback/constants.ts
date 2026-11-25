import type { CleanlinessFeedbackStatus, CleanlinessRating } from "@prisma/client";

export const QR_CODE_SLOT_COUNT = 32;

export const RATING_META: Record<
  CleanlinessRating,
  { value: number; emoji: string; label: string }
> = {
  VERY_BAD: { value: 1, emoji: "😡", label: "Juda yomon" },
  BAD: { value: 2, emoji: "🙁", label: "Yomon" },
  AVERAGE: { value: 3, emoji: "😐", label: "O‘rtacha" },
  GOOD: { value: 4, emoji: "🙂", label: "Yaxshi" },
  EXCELLENT: { value: 5, emoji: "😍", label: "A’lo" },
};

export const RATING_BY_VALUE: Record<number, CleanlinessRating> = {
  1: "VERY_BAD",
  2: "BAD",
  3: "AVERAGE",
  4: "GOOD",
  5: "EXCELLENT",
};

export const FEEDBACK_STATUS_LABELS: Record<CleanlinessFeedbackStatus, string> = {
  NEW: "Yangi",
  IN_REVIEW: "Ko‘rib chiqilmoqda",
  RESOLVED: "Hal qilindi",
};

export const FEEDBACK_MAX_PHOTOS = 3;
export const FEEDBACK_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
export const FEEDBACK_COMMENT_MAX = 2000;
export const FEEDBACK_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const FEEDBACK_RATE_LIMIT_MAX = 5;
export const FEEDBACK_MEDIA_RETENTION_DAYS = Number(
  process.env.IJARA_FEEDBACK_MEDIA_RETENTION_DAYS || "180"
);

export function defaultQrName(index: number) {
  return `QR ${String(index).padStart(2, "0")}`;
}

export const DEFAULT_PRINT_INSTRUCTION =
  "Tozalik va kamchiliklar rasmini jo‘nating";

export const PRINT_CARD_FOOTER =
  "QR kodni skanerlang va fikringizni bildiring.";

export function publicFeedbackPath(token: string) {
  return `/f/${token}`;
}

export function resolveQrRoomLabel(opts: {
  roomNumber?: string | null;
  locationLabel?: string | null;
  name: string;
}) {
  return (
    opts.roomNumber?.trim() ||
    opts.locationLabel?.trim() ||
    opts.name.trim() ||
    "QR"
  );
}
