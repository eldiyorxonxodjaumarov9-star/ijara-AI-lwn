import { createHash, randomBytes } from "node:crypto";
import type { CleanlinessFeedbackStatus, Prisma } from "@prisma/client";

import {
  DEFAULT_PRINT_INSTRUCTION,
  defaultQrName,
  FEEDBACK_MAX_PHOTOS,
  FEEDBACK_RATE_LIMIT_MAX,
  FEEDBACK_RATE_LIMIT_WINDOW_MS,
  publicFeedbackPath,
  QR_CODE_SLOT_COUNT,
  RATING_BY_VALUE,
  RATING_META,
  resolveQrRoomLabel,
} from "@/lib/api-server/qr-feedback/constants";
import {
  hashClientIp,
  persistFeedbackPhoto,
} from "@/lib/api-server/qr-feedback/media";
import {
  buildPrintCardPng,
  buildPrintCardSvg,
  buildRawQrPng,
  buildRawQrSvg,
} from "@/lib/api-server/qr-feedback/print-card";
import {
  feedbackPublicUrlForToken,
  inspectQrPublicOrigin,
} from "@/lib/api-server/qr-feedback/public-origin";
import { scheduleCleanlinessFeedbackTelegram } from "@/lib/api-server/qr-feedback/telegram-notify";
import { prisma } from "@/lib/api-server/prisma";
import { formatKeldiDateDisplay, formatKeldiTimeDisplay } from "@/lib/api-server/attendance-bot/service";

function newPublicToken() {
  return randomBytes(24).toString("base64url");
}

export function feedbackPublicUrl(token: string) {
  return feedbackPublicUrlForToken(token);
}

export function getQrPublicOriginInfo() {
  return inspectQrPublicOrigin();
}

/** Create missing QR 01–32 only. Never rotates existing publicToken. */
export async function ensureWorkspaceQrCodes(workspaceId: string) {
  const existing = await prisma.feedbackQrCode.findMany({
    where: { workspaceId },
    select: { codeIndex: true },
  });
  const have = new Set(existing.map((e) => e.codeIndex));
  const toCreate: Prisma.FeedbackQrCodeCreateManyInput[] = [];
  for (let i = 1; i <= QR_CODE_SLOT_COUNT; i += 1) {
    if (have.has(i)) continue;
    toCreate.push({
      workspaceId,
      codeIndex: i,
      name: defaultQrName(i),
      printInstruction: DEFAULT_PRINT_INSTRUCTION,
      publicToken: newPublicToken(),
      active: true,
    });
  }
  if (toCreate.length > 0) {
    await prisma.feedbackQrCode.createMany({ data: toCreate });
  }
  return listQrCodes(workspaceId);
}

export async function listQrCodes(workspaceId: string) {
  return prisma.feedbackQrCode.findMany({
    where: { workspaceId },
    orderBy: { codeIndex: "asc" },
    include: {
      _count: { select: { feedbacks: true } },
    },
  });
}

export async function updateQrCode(opts: {
  workspaceId: string;
  id: string;
  name?: string;
  locationLabel?: string | null;
  roomNumber?: string | null;
  printInstruction?: string | null;
  active?: boolean;
}) {
  const row = await prisma.feedbackQrCode.findFirst({
    where: { id: opts.id, workspaceId: opts.workspaceId },
  });
  if (!row) throw Object.assign(new Error("QR topilmadi"), { status: 404 });

  return prisma.feedbackQrCode.update({
    where: { id: row.id },
    data: {
      ...(opts.name !== undefined ? { name: opts.name.trim().slice(0, 80) || row.name } : {}),
      ...(opts.locationLabel !== undefined
        ? { locationLabel: opts.locationLabel?.trim().slice(0, 120) || null }
        : {}),
      ...(opts.roomNumber !== undefined
        ? { roomNumber: opts.roomNumber?.trim().slice(0, 80) || null }
        : {}),
      ...(opts.printInstruction !== undefined
        ? {
            printInstruction:
              opts.printInstruction?.trim().slice(0, 240) ||
              DEFAULT_PRINT_INSTRUCTION,
          }
        : {}),
      ...(opts.active !== undefined ? { active: opts.active } : {}),
    },
  });
}

export async function generatePrintCardPng(fields: {
  publicToken: string;
  name: string;
  roomNumber?: string | null;
  locationLabel?: string | null;
  printInstruction?: string | null;
}) {
  return buildPrintCardPng(fields);
}

export async function generatePrintCardSvg(fields: {
  publicToken: string;
  name: string;
  roomNumber?: string | null;
  locationLabel?: string | null;
  printInstruction?: string | null;
}) {
  return buildPrintCardSvg(fields);
}

export async function generateRawQrPng(token: string) {
  return buildRawQrPng(token);
}

export async function generateRawQrSvg(token: string) {
  return buildRawQrSvg(token);
}

export async function getQrDashboardStats(workspaceId: string) {
  const [total, active, feedbacks] = await Promise.all([
    prisma.feedbackQrCode.count({ where: { workspaceId } }),
    prisma.feedbackQrCode.count({ where: { workspaceId, active: true } }),
    prisma.cleanlinessFeedback.findMany({
      where: { workspaceId },
      select: { ratingValue: true },
    }),
  ]);
  const feedbackCount = feedbacks.length;
  const avg =
    feedbackCount === 0
      ? 0
      : feedbacks.reduce((s, f) => s + f.ratingValue, 0) / feedbackCount;
  const negative = feedbacks.filter((f) => f.ratingValue <= 2).length;
  return {
    totalQr: total,
    activeQr: active,
    feedbackCount,
    averageRating: Math.round(avg * 10) / 10,
    negativeCount: negative,
  };
}

export async function getPublicQrByToken(token: string) {
  const qr = await prisma.feedbackQrCode.findUnique({
    where: { publicToken: token },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!qr || !qr.active) return null;
  return {
    token: qr.publicToken,
    name: qr.name,
    locationLabel: qr.locationLabel,
    roomNumber: qr.roomNumber,
    roomLabel: resolveQrRoomLabel({
      roomNumber: qr.roomNumber,
      locationLabel: qr.locationLabel,
      name: qr.name,
    }),
    printInstruction: qr.printInstruction || DEFAULT_PRINT_INSTRUCTION,
    brandName: qr.workspace.name || "Ijara AI",
    workspaceId: qr.workspaceId,
    qrCodeId: qr.id,
  };
}

async function assertRateLimit(opts: {
  qrCodeId: string;
  ipHash: string | null;
}) {
  if (!opts.ipHash) return;
  const since = new Date(Date.now() - FEEDBACK_RATE_LIMIT_WINDOW_MS);
  const count = await prisma.cleanlinessFeedback.count({
    where: {
      qrCodeId: opts.qrCodeId,
      clientIpHash: opts.ipHash,
      createdAt: { gte: since },
    },
  });
  if (count >= FEEDBACK_RATE_LIMIT_MAX) {
    throw Object.assign(
      new Error("Juda ko‘p so‘rov. Birozdan keyin urinib ko‘ring."),
      { status: 429 }
    );
  }
}

export async function submitPublicFeedback(opts: {
  token: string;
  ratingValue: number;
  comment?: string | null;
  photos: Array<{ buffer: Buffer; mimeType: string; name?: string }>;
  clientIp?: string | null;
  userAgent?: string | null;
  idempotencyKey?: string | null;
}) {
  const qr = await prisma.feedbackQrCode.findUnique({
    where: { publicToken: opts.token },
  });
  if (!qr || !qr.active) {
    throw Object.assign(new Error("QR topilmadi yoki faol emas"), { status: 404 });
  }

  const rating = RATING_BY_VALUE[opts.ratingValue];
  if (!rating) {
    throw Object.assign(new Error("Baholash majburiy (1–5)"), { status: 400 });
  }
  if (opts.photos.length > FEEDBACK_MAX_PHOTOS) {
    throw Object.assign(new Error("Maksimal 3 ta rasm"), { status: 400 });
  }

  const ipHash = hashClientIp(opts.clientIp);
  await assertRateLimit({ qrCodeId: qr.id, ipHash });

  // Simple idempotency: same token+ip+rating+comment hash within 2 minutes
  if (opts.idempotencyKey?.trim()) {
    const keyHash = createHash("sha256")
      .update(`${qr.id}:${opts.idempotencyKey.trim()}`)
      .digest("hex")
      .slice(0, 32);
    const recent = await prisma.cleanlinessFeedback.findFirst({
      where: {
        qrCodeId: qr.id,
        clientIpHash: keyHash,
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      },
    });
    if (recent) {
      // Duplicate request — do not re-notify Telegram
      return { feedbackId: recent.id, duplicate: true as const };
    }
  }

  const comment = opts.comment?.trim().slice(0, 2000) || null;
  const feedback = await prisma.cleanlinessFeedback.create({
    data: {
      workspaceId: qr.workspaceId,
      qrCodeId: qr.id,
      rating,
      ratingValue: opts.ratingValue,
      comment,
      status: "NEW",
      telegramDelivery: "PENDING",
      clientIpHash:
        opts.idempotencyKey?.trim()
          ? createHash("sha256")
              .update(`${qr.id}:${opts.idempotencyKey.trim()}`)
              .digest("hex")
              .slice(0, 32)
          : ipHash,
      userAgent: opts.userAgent?.slice(0, 300) || null,
      events: {
        create: {
          fromStatus: null,
          toStatus: "NEW",
          comment: "Mijoz yubordi",
        },
      },
    },
  });

  for (const photo of opts.photos) {
    await persistFeedbackPhoto({
      workspaceId: qr.workspaceId,
      feedbackId: feedback.id,
      buffer: photo.buffer,
      mimeType: photo.mimeType,
      originalName: photo.name,
    });
  }

  // Telegram must not block the public form response
  scheduleCleanlinessFeedbackTelegram(feedback.id);

  return { feedbackId: feedback.id, duplicate: false as const };
}

export async function listFeedbacks(opts: {
  workspaceId: string;
  qrCodeId?: string | null;
  status?: CleanlinessFeedbackStatus | null;
  ratingValue?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const where: Prisma.CleanlinessFeedbackWhereInput = {
    workspaceId: opts.workspaceId,
  };
  if (opts.qrCodeId) where.qrCodeId = opts.qrCodeId;
  if (opts.status) where.status = opts.status;
  if (opts.ratingValue) where.ratingValue = opts.ratingValue;
  if (opts.dateFrom || opts.dateTo) {
    where.createdAt = {
      ...(opts.dateFrom ? { gte: new Date(`${opts.dateFrom}T00:00:00+05:00`) } : {}),
      ...(opts.dateTo ? { lte: new Date(`${opts.dateTo}T23:59:59.999+05:00`) } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.cleanlinessFeedback.findMany({
      where,
      include: {
        qrCode: true,
        photos: { select: { id: true, mimeType: true, byteSize: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cleanlinessFeedback.count({ where }),
  ]);

  return {
    total,
    page,
    limit,
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      ratingValue: r.ratingValue,
      emoji: RATING_META[r.rating].emoji,
      label: RATING_META[r.rating].label,
      comment: r.comment,
      status: r.status,
      telegramDelivery: r.telegramDelivery,
      telegramMessageId: r.telegramMessageId,
      telegramLastError: r.telegramLastError,
      qrCodeId: r.qrCodeId,
      qrName: r.qrCode.name,
      locationLabel: r.qrCode.locationLabel,
      photoIds: r.photos.map((p) => p.id),
      createdAt: r.createdAt.toISOString(),
      dateDisplay: formatKeldiDateDisplay(r.createdAt),
      timeDisplay: formatKeldiTimeDisplay(r.createdAt),
    })),
  };
}

export async function updateFeedbackStatus(opts: {
  workspaceId: string;
  feedbackId: string;
  status: CleanlinessFeedbackStatus;
  actorUserId: string;
  comment?: string | null;
}) {
  const row = await prisma.cleanlinessFeedback.findFirst({
    where: { id: opts.feedbackId, workspaceId: opts.workspaceId },
  });
  if (!row) throw Object.assign(new Error("Fikr topilmadi"), { status: 404 });
  if (row.status === opts.status) return row;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.cleanlinessFeedback.update({
      where: { id: row.id },
      data: { status: opts.status },
    });
    await tx.feedbackStatusEvent.create({
      data: {
        feedbackId: row.id,
        fromStatus: row.status,
        toStatus: opts.status,
        actorUserId: opts.actorUserId,
        comment: opts.comment?.trim() || null,
      },
    });
    return updated;
  });
}

export function mapQrForAdmin(
  qr: Awaited<ReturnType<typeof listQrCodes>>[number]
) {
  const origin = inspectQrPublicOrigin();
  return {
    id: qr.id,
    codeIndex: qr.codeIndex,
    name: qr.name,
    locationLabel: qr.locationLabel,
    roomNumber: qr.roomNumber,
    printInstruction: qr.printInstruction || DEFAULT_PRINT_INSTRUCTION,
    roomLabel: resolveQrRoomLabel({
      roomNumber: qr.roomNumber,
      locationLabel: qr.locationLabel,
      name: qr.name,
    }),
    publicToken: qr.publicToken,
    publicUrl: origin.ok
      ? `${origin.origin}${publicFeedbackPath(qr.publicToken)}`
      : null,
    publicPath: publicFeedbackPath(qr.publicToken),
    active: qr.active,
    feedbackCount: qr._count.feedbacks,
    createdAt: qr.createdAt.toISOString(),
  };
}
