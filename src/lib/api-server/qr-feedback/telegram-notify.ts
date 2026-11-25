/**
 * QR cleanliness feedback → attendance Telegram group.
 * Uses @IjaraAIDavomatBot token only. Never touches the main Ijara bot.
 * Form submission must succeed even if Telegram fails.
 * Delivery is durable via DB outbox (PENDING/SENT/FAILED) + next/server after() + cron retry.
 */
import { after } from "next/server";

import {
  attendanceGroupId,
  attendanceWorkspaceIdFromEnv,
  isAttendanceBotConfigured,
} from "@/lib/api-server/attendance-bot/config";
import {
  escapeHtml,
  formatKeldiDateDisplay,
  formatKeldiTimeDisplay,
} from "@/lib/api-server/attendance-bot/service";
import {
  attendanceSendMessage,
  attendanceSendPhotoGroup,
} from "@/lib/api-server/attendance-bot/telegram";
import { RATING_META } from "@/lib/api-server/qr-feedback/constants";
import { readFeedbackPhotoBytes } from "@/lib/api-server/qr-feedback/media";
import { prisma } from "@/lib/api-server/prisma";

export function isQrFeedbackTelegramEnabled() {
  const flag = process.env.IJARA_QR_FEEDBACK_TELEGRAM_ENABLED?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function isQrFeedbackTelegramDryRun() {
  const flag = process.env.IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function sanitizeTgError(err: unknown) {
  const raw = err instanceof Error ? err.message : "Telegram xatosi";
  return raw.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot***").slice(0, 500);
}

export function buildCleanlinessFeedbackTelegramText(opts: {
  placeLabel: string;
  ratingValue: number;
  ratingKey: keyof typeof RATING_META;
  comment: string | null;
  photoCount: number;
  at?: Date;
  warnLow?: boolean;
}) {
  const meta = RATING_META[opts.ratingKey];
  const at = opts.at ?? new Date();
  const warn = opts.warnLow ?? opts.ratingValue <= 2;
  const header = warn
    ? `⚠️🧹 <b>YANGI TOZALIK BAHOSI</b>`
    : `🧹 <b>YANGI TOZALIK BAHOSI</b>`;
  const testBanner =
    process.env.IJARA_QR_FEEDBACK_TEST_BANNER === "1"
      ? `🧪 <b>TEST</b> — production sinov xabari\n\n`
      : "";
  const commentBlock = opts.comment?.trim()
    ? `\n💬 <b>Mijoz fikri:</b>\n${escapeHtml(opts.comment.trim())}\n`
    : `\n💬 <b>Mijoz fikri:</b>\n<i>Izoh yo‘q</i>\n`;

  return (
    `${testBanner}${header}\n\n` +
    `📍 Joy: <b>${escapeHtml(opts.placeLabel)}</b>\n` +
    `⭐ Baho: ${meta.emoji} <b>${opts.ratingValue}/5</b> (${escapeHtml(meta.label)})\n` +
    commentBlock +
    `\n📸 Rasmlar: ${opts.photoCount}\n` +
    `📅 Sana: ${formatKeldiDateDisplay(at)}\n` +
    `🕒 Vaqt: ${formatKeldiTimeDisplay(at)}`
  );
}

export function buildPhotoCaption(opts: {
  placeLabel: string;
  ratingValue: number;
  ratingKey: keyof typeof RATING_META;
}) {
  const meta = RATING_META[opts.ratingKey];
  return (
    `🧹 ${escapeHtml(opts.placeLabel)} · ${meta.emoji} ${opts.ratingValue}/5`
  );
}

async function markDelivery(
  feedbackId: string,
  data: {
    telegramDelivery: "PENDING" | "SENT" | "FAILED";
    telegramMessageId?: string | null;
    telegramLastError?: string | null;
    telegramNotifiedAt?: Date | null;
  }
) {
  await prisma.cleanlinessFeedback.update({
    where: { id: feedbackId },
    data,
  });
}

/**
 * Deliver one feedback to the attendance group. Idempotent when already SENT.
 */
export async function notifyCleanlinessFeedbackTelegram(
  feedbackId: string,
  opts?: { forceRetry?: boolean }
) {
  if (!isQrFeedbackTelegramEnabled()) {
    return { ok: false as const, skipped: true as const, reason: "disabled" };
  }

  const row = await prisma.cleanlinessFeedback.findUnique({
    where: { id: feedbackId },
    include: {
      qrCode: true,
      photos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) {
    return { ok: false as const, skipped: true as const, reason: "not_found" };
  }

  if (row.telegramDelivery === "SENT" && !opts?.forceRetry) {
    return {
      ok: true as const,
      skipped: true as const,
      reason: "already_sent",
      messageId: row.telegramMessageId,
    };
  }

  const allowedWs = attendanceWorkspaceIdFromEnv();
  if (!allowedWs || row.workspaceId !== allowedWs) {
    await markDelivery(feedbackId, {
      telegramDelivery: "FAILED",
      telegramLastError: "Workspace guruhga ulanmagan (isolation)",
      telegramNotifiedAt: new Date(),
    });
    return { ok: false as const, reason: "workspace_mismatch" };
  }

  if (!isAttendanceBotConfigured()) {
    await markDelivery(feedbackId, {
      telegramDelivery: "FAILED",
      telegramLastError: "Davomat boti sozlanmagan",
      telegramNotifiedAt: new Date(),
    });
    return { ok: false as const, reason: "bot_not_configured" };
  }

  const groupId = attendanceGroupId();
  if (!groupId || groupId !== "-1003911506368") {
    // Hard-bind to the approved group id unless explicitly overridden for tests
    const allowAlt = process.env.IJARA_QR_FEEDBACK_ALLOW_ALT_GROUP === "1";
    if (!allowAlt || !groupId) {
      await markDelivery(feedbackId, {
        telegramDelivery: "FAILED",
        telegramLastError: "Tasdiqlanmagan Telegram guruh ID",
        telegramNotifiedAt: new Date(),
      });
      return { ok: false as const, reason: "group_not_allowed" };
    }
  }

  const placeLabel =
    row.qrCode.locationLabel?.trim() ||
    row.qrCode.name ||
    `QR ${row.qrCode.codeIndex}`;
  const ratingKey = row.rating;
  const text = buildCleanlinessFeedbackTelegramText({
    placeLabel,
    ratingValue: row.ratingValue,
    ratingKey,
    comment: row.comment,
    photoCount: row.photos.length,
    at: row.createdAt,
  });
  const caption = buildPhotoCaption({
    placeLabel,
    ratingValue: row.ratingValue,
    ratingKey,
  });

  if (isQrFeedbackTelegramDryRun()) {
    console.info("[qr-feedback-telegram:dry-run]", {
      feedbackId,
      groupId,
      placeLabel,
      ratingValue: row.ratingValue,
      photoCount: row.photos.length,
      textPreview: text.replace(/<[^>]+>/g, "").slice(0, 240),
    });
    await markDelivery(feedbackId, {
      telegramDelivery: "SENT",
      telegramMessageId: `dry-run:${feedbackId.slice(0, 8)}`,
      telegramLastError: null,
      telegramNotifiedAt: new Date(),
    });
    return { ok: true as const, dryRun: true as const };
  }

  try {
    const sent = await attendanceSendMessage(groupId, text);
    const messageId = sent?.message_id ? String(sent.message_id) : null;

    if (row.photos.length > 0) {
      const buffers: Array<{ buffer: Buffer; mimeType: string }> = [];
      for (const photo of row.photos.slice(0, 3)) {
        const loaded = await readFeedbackPhotoBytes({
          storageKey: photo.storageKey,
          storageUrl: photo.storageUrl,
          mimeType: photo.mimeType,
        });
        buffers.push({
          buffer: loaded.body,
          mimeType: loaded.contentType || photo.mimeType,
        });
      }
      if (buffers.length > 0) {
        await attendanceSendPhotoGroup({
          chatId: groupId,
          photos: buffers,
          caption,
        });
      }
    }

    await markDelivery(feedbackId, {
      telegramDelivery: "SENT",
      telegramMessageId: messageId,
      telegramLastError: null,
      telegramNotifiedAt: new Date(),
    });
    return { ok: true as const, messageId };
  } catch (err) {
    const message = sanitizeTgError(err);
    await markDelivery(feedbackId, {
      telegramDelivery: "FAILED",
      telegramLastError: message,
      telegramNotifiedAt: new Date(),
    });
    return { ok: false as const, reason: "send_failed", error: message };
  }
}

/**
 * Schedule delivery that survives the HTTP response on Vercel (`after()`).
 * Outside a request context, falls back to a best-effort async call.
 */
export function scheduleCleanlinessFeedbackTelegram(feedbackId: string) {
  try {
    after(() =>
      notifyCleanlinessFeedbackTelegram(feedbackId).catch((err) => {
        console.error(
          "[qr-feedback-telegram:after]",
          feedbackId,
          sanitizeTgError(err)
        );
      })
    );
  } catch {
    void notifyCleanlinessFeedbackTelegram(feedbackId).catch((err) => {
      console.error(
        "[qr-feedback-telegram]",
        feedbackId,
        sanitizeTgError(err)
      );
    });
  }
}

/** Cron / recovery: drain PENDING + retryable FAILED rows (idempotent SENT skip). */
export async function processPendingQrFeedbackTelegram(limit = 20) {
  const take = Math.min(50, Math.max(1, limit));
  const rows = await prisma.cleanlinessFeedback.findMany({
    where: {
      telegramDelivery: { in: ["PENDING", "FAILED"] },
    },
    orderBy: { createdAt: "asc" },
    take,
    select: { id: true, telegramDelivery: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await notifyCleanlinessFeedbackTelegram(row.id, {
      forceRetry: row.telegramDelivery === "FAILED",
    });
    if (result.ok && !("skipped" in result && result.skipped)) sent += 1;
    else if (result.ok && "skipped" in result && result.skipped) skipped += 1;
    else failed += 1;
  }
  return { scanned: rows.length, sent, failed, skipped };
}
