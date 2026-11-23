/**
 * Attendance selfie storage.
 * Production: private Vercel Blob (never client-facing URLs / tokens).
 * Localhost: optional filesystem under .data/attendance-media.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

import { prisma } from "@/lib/api-server/prisma";
import {
  attendanceDownloadFile,
  attendanceGetFile,
} from "@/lib/api-server/attendance-bot/telegram";

const DEFAULT_DIR = ".data/attendance-media";
const BLOB_PREFIX = "attendance-selfies";

export function attendanceMediaRoot() {
  const raw =
    process.env.IJARA_ATTENDANCE_MEDIA_DIR?.trim() || DEFAULT_DIR;
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

export function attendanceMediaRetentionDays() {
  const n = Number(process.env.IJARA_ATTENDANCE_MEDIA_RETENTION_DAYS || "90");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function allowLocalFsFallback() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_ATTENDANCE_LOCAL_MEDIA === "1"
  );
}

function mimeFromTelegramPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function extFromMime(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return ".jpg";
}

export function attendanceSelfieStorageKey(
  workspaceId: string,
  checkInId: string,
  mime: string
) {
  return `${BLOB_PREFIX}/${workspaceId}/${checkInId}${extFromMime(mime)}`;
}

export function absoluteAttendanceMediaPath(storageKey: string) {
  const root = attendanceMediaRoot();
  const resolved = path.resolve(root, storageKey);
  const rootResolved = path.resolve(root);
  if (
    !resolved.startsWith(rootResolved + path.sep) &&
    resolved !== rootResolved
  ) {
    throw Object.assign(new Error("Noto‘g‘ri media yo‘li"), { status: 400 });
  }
  return resolved;
}

export async function readAttendanceSelfieBytes(opts: {
  storageKey: string;
  storageUrl?: string | null;
  mimeType?: string | null;
}): Promise<{ body: Buffer; contentType: string }> {
  const mime = opts.mimeType || "image/jpeg";

  // Private Blob (production)
  if (opts.storageUrl?.startsWith("http") || hasBlobToken()) {
    const ref = (opts.storageUrl?.trim() || opts.storageKey).trim();
    if (ref.startsWith("http") || hasBlobToken()) {
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
        // fall through to local
      }
    }
  }

  // Local filesystem (dev)
  if (allowLocalFsFallback()) {
    const abs = absoluteAttendanceMediaPath(opts.storageKey);
    const body = await fs.readFile(abs);
    return { body, contentType: mime };
  }

  throw Object.assign(new Error("Rasm mavjud emas"), { status: 404 });
}

async function persistSelfieBuffer(opts: {
  workspaceId: string;
  checkInId: string;
  buffer: Buffer;
  mime: string;
}) {
  const key = attendanceSelfieStorageKey(
    opts.workspaceId,
    opts.checkInId,
    opts.mime
  );

  if (hasBlobToken()) {
    const blob = await put(key, opts.buffer, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: opts.mime,
    });
    return {
      selfieStorageKey: blob.pathname ?? key,
      selfieStorageUrl: blob.url,
      selfieMimeType: opts.mime,
      selfieByteSize: opts.buffer.byteLength,
      selfieFetchedAt: new Date(),
    };
  }

  if (!allowLocalFsFallback()) {
    throw Object.assign(
      new Error("STORAGE_NOT_CONFIGURED: BLOB_READ_WRITE_TOKEN sozlanmagan"),
      { status: 503 }
    );
  }

  const abs = absoluteAttendanceMediaPath(key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, opts.buffer);
  return {
    selfieStorageKey: key,
    selfieStorageUrl: null as string | null,
    selfieMimeType: opts.mime,
    selfieByteSize: opts.buffer.byteLength,
    selfieFetchedAt: new Date(),
  };
}

/**
 * Fetch selfie from Telegram once and store privately.
 * Never exposes bot token or Telegram CDN URLs to clients.
 */
export async function ensureAttendanceSelfieStored(checkInId: string) {
  const row = await prisma.attendanceCheckIn.findUnique({
    where: { id: checkInId },
  });
  if (!row) return null;

  if (row.selfieStorageKey) {
    try {
      await readAttendanceSelfieBytes({
        storageKey: row.selfieStorageKey,
        storageUrl: row.selfieStorageUrl,
        mimeType: row.selfieMimeType,
      });
      return row;
    } catch {
      // re-fetch from Telegram
    }
  }

  if (!row.selfieFileId) return null;

  try {
    const file = await attendanceGetFile(row.selfieFileId);
    if (!file.file_path) return null;
    const buf = Buffer.from(await attendanceDownloadFile(file.file_path));
    const mime = mimeFromTelegramPath(file.file_path);
    const stored = await persistSelfieBuffer({
      workspaceId: row.workspaceId,
      checkInId: row.id,
      buffer: buf,
      mime,
    });
    return prisma.attendanceCheckIn.update({
      where: { id: row.id },
      data: stored,
    });
  } catch {
    return null;
  }
}

/** Best-effort retention cleanup (Blob delete not required for MVP). */
export async function pruneExpiredAttendanceMedia(now = new Date()) {
  const days = attendanceMediaRetentionDays();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const stale = await prisma.attendanceCheckIn.findMany({
    where: {
      selfieFetchedAt: { lt: cutoff },
      selfieStorageKey: { not: null },
    },
    select: { id: true, selfieStorageKey: true, selfieStorageUrl: true },
    take: 200,
  });
  let removed = 0;
  for (const row of stale) {
    if (!row.selfieStorageKey) continue;
    if (allowLocalFsFallback() && !row.selfieStorageUrl) {
      try {
        await fs.unlink(absoluteAttendanceMediaPath(row.selfieStorageKey));
      } catch {
        /* ok */
      }
    }
    await prisma.attendanceCheckIn.update({
      where: { id: row.id },
      data: {
        selfieStorageKey: null,
        selfieStorageUrl: null,
        selfieMimeType: null,
        selfieByteSize: null,
        selfieFetchedAt: null,
      },
    });
    removed += 1;
  }
  return { removed, retentionDays: days };
}
