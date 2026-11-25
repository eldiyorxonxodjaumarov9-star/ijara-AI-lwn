import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { get, put } from "@vercel/blob";

import {
  FEEDBACK_ALLOWED_MIME,
  FEEDBACK_MAX_PHOTO_BYTES,
  FEEDBACK_MEDIA_RETENTION_DAYS,
} from "@/lib/api-server/qr-feedback/constants";
import { prisma } from "@/lib/api-server/prisma";

const LOCAL_DIR = ".data/feedback-media";

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function allowLocalFs() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_FEEDBACK_LOCAL_MEDIA === "1"
  );
}

function mediaRoot() {
  return path.join(process.cwd(), LOCAL_DIR);
}

function absPath(storageKey: string) {
  const root = mediaRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    throw Object.assign(new Error("Noto‘g‘ri media yo‘li"), { status: 400 });
  }
  return resolved;
}

export function hashClientIp(ip: string | null | undefined) {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function persistFeedbackPhoto(opts: {
  workspaceId: string;
  feedbackId: string;
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}) {
  if (!FEEDBACK_ALLOWED_MIME.has(opts.mimeType)) {
    throw Object.assign(new Error("Faqat JPEG, PNG yoki WebP"), { status: 400 });
  }
  if (opts.buffer.byteLength > FEEDBACK_MAX_PHOTO_BYTES) {
    throw Object.assign(new Error("Rasm 5MB dan oshmasin"), { status: 400 });
  }

  const ext =
    opts.mimeType === "image/png"
      ? ".png"
      : opts.mimeType === "image/webp"
        ? ".webp"
        : ".jpg";
  const key = `feedback/${opts.workspaceId}/${opts.feedbackId}/${randomBytes(8).toString("hex")}${ext}`;

  if (hasBlobToken()) {
    const blob = await put(key, opts.buffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: opts.mimeType,
    });
    return prisma.cleanlinessFeedbackPhoto.create({
      data: {
        feedbackId: opts.feedbackId,
        storageKey: blob.pathname ?? key,
        storageUrl: blob.url,
        mimeType: opts.mimeType,
        byteSize: opts.buffer.byteLength,
      },
    });
  }

  if (!allowLocalFs()) {
    throw Object.assign(new Error("STORAGE_NOT_CONFIGURED"), { status: 503 });
  }

  const abs = absPath(key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, opts.buffer);
  return prisma.cleanlinessFeedbackPhoto.create({
    data: {
      feedbackId: opts.feedbackId,
      storageKey: key,
      storageUrl: null,
      mimeType: opts.mimeType,
      byteSize: opts.buffer.byteLength,
    },
  });
}

export async function readFeedbackPhotoBytes(opts: {
  storageKey: string;
  storageUrl?: string | null;
  mimeType?: string | null;
}) {
  const mime = opts.mimeType || "image/jpeg";
  if (opts.storageUrl?.startsWith("http") || hasBlobToken()) {
    const ref = (opts.storageUrl?.trim() || opts.storageKey).trim();
    try {
      const result = await get(ref, { access: "private" });
      if (result?.statusCode === 200 && result.stream) {
        const ab = await new Response(result.stream).arrayBuffer();
        return {
          body: Buffer.from(ab),
          contentType: result.blob.contentType || mime,
        };
      }
    } catch {
      /* fall through */
    }
  }
  if (allowLocalFs()) {
    const body = await fs.readFile(absPath(opts.storageKey));
    return { body, contentType: mime };
  }
  throw Object.assign(new Error("Rasm mavjud emas"), { status: 404 });
}

export async function pruneExpiredFeedbackPhotos(now = new Date()) {
  const days = Number.isFinite(FEEDBACK_MEDIA_RETENTION_DAYS)
    ? FEEDBACK_MEDIA_RETENTION_DAYS
    : 180;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const stale = await prisma.cleanlinessFeedbackPhoto.findMany({
    where: { createdAt: { lt: cutoff } },
    take: 200,
  });
  let removed = 0;
  for (const row of stale) {
    if (allowLocalFs() && !row.storageUrl) {
      try {
        await fs.unlink(absPath(row.storageKey));
      } catch {
        /* ok */
      }
    }
    await prisma.cleanlinessFeedbackPhoto.delete({ where: { id: row.id } });
    removed += 1;
  }
  return { removed, retentionDays: days };
}
