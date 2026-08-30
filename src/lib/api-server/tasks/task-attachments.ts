import { get, put } from "@vercel/blob";

import {
  getTelegramFile,
  downloadTelegramFile,
} from "@/lib/api-server/telegram-bot";

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const DOC_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const BLOCKED_EXT = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "js",
  "sh",
  "ps1",
  "dll",
  "apk",
  "html",
  "htm",
  "svg",
  "xhtml",
]);

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 20 * 1024 * 1024;
const MAX_DOC = 10 * 1024 * 1024;
export const MAX_TASK_ATTACHMENTS = 8;

export function sanitizeFileName(name: string | null | undefined): string {
  const base = String(name ?? "file")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\.\.+/g, ".")
    .trim()
    .slice(0, 120);
  return base || "file";
}

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isDevOrTestStorageFallbackAllowed() {
  const env = process.env.NODE_ENV;
  const allow =
    process.env.ALLOW_TASK_DATA_URL_FALLBACK === "1" ||
    process.env.VITEST === "true" ||
    process.env.NODE_TEST === "1";
  return env !== "production" || allow;
}

export function classifyAttachment(
  mimeType: string | null | undefined,
  fileName?: string | null
): { type: "IMAGE" | "VIDEO" | "DOCUMENT"; max: number } | { error: string } {
  const mime = (mimeType ?? "").toLowerCase();
  const name = sanitizeFileName(fileName);
  const ext = extOf(name);
  if (BLOCKED_EXT.has(ext) || mime === "image/svg+xml" || mime === "text/html") {
    return { error: "Bu fayl turi xavfli yoki ruxsat etilmagan" };
  }
  if (IMAGE_MIME.has(mime) || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return { type: "IMAGE", max: MAX_IMAGE };
  }
  if (VIDEO_MIME.has(mime) || ["mp4", "mov", "webm"].includes(ext)) {
    return { type: "VIDEO", max: MAX_VIDEO };
  }
  if (DOC_MIME.has(mime) || ["pdf", "doc", "docx", "xls", "xlsx", "txt"].includes(ext)) {
    return { type: "DOCUMENT", max: MAX_DOC };
  }
  return { error: "Fayl turi ruxsat etilmagan" };
}

export function dedupeAttachmentsByTelegramId<
  T extends { telegramFileUniqueId?: string | null; telegramFileId?: string | null },
>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key =
      item.telegramFileUniqueId ||
      item.telegramFileId ||
      `anon-${out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function persistTelegramFile(opts: {
  fileId: string;
  fileUniqueId?: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const classified = classifyAttachment(opts.mimeType, opts.fileName);
  if ("error" in classified) throw new Error(classified.error);

  const meta = await getTelegramFile(opts.fileId);
  if (!meta.file_path) throw new Error("Telegram fayl yo‘li topilmadi");
  // Never persist temporary Telegram CDN URLs
  if (meta.file_size && meta.file_size > classified.max) {
    throw new Error("Fayl hajmi juda katta");
  }

  const buffer = await downloadTelegramFile(meta.file_path);
  if (buffer.byteLength > classified.max) {
    throw new Error("Fayl hajmi juda katta");
  }

  const safeName = sanitizeFileName(
    opts.fileName ?? meta.file_path.split("/").pop()
  );
  const key = `tasks/${Date.now()}-${safeName}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, buffer, {
      access: "private",
      addRandomSuffix: true,
      contentType: opts.mimeType ?? undefined,
    });
    return {
      type: classified.type,
      // Private blob URL — server-only; never return to clients as-is.
      storageUrl: blob.url,
      storageKey: blob.pathname ?? key,
      telegramFileId: opts.fileId,
      telegramFileUniqueId: opts.fileUniqueId,
      originalName: safeName,
      mimeType: opts.mimeType ?? undefined,
      size: buffer.byteLength,
    };
  }

  if (!isDevOrTestStorageFallbackAllowed()) {
    const err = Object.assign(
      new Error("STORAGE_NOT_CONFIGURED: BLOB_READ_WRITE_TOKEN sozlanmagan"),
      { code: "STORAGE_NOT_CONFIGURED", status: 503 }
    );
    throw err;
  }

  const b64 = Buffer.from(buffer).toString("base64");
  const mime = opts.mimeType ?? "application/octet-stream";
  return {
    type: classified.type,
    storageUrl: `data:${mime};base64,${b64}`,
    storageKey: key,
    telegramFileId: opts.fileId,
    telegramFileUniqueId: opts.fileUniqueId,
    originalName: safeName,
    mimeType: opts.mimeType ?? undefined,
    size: buffer.byteLength,
  };
}

/** Client-safe attachment fields — never includes raw private Blob URLs. */
export function toPublicAttachmentView(a: {
  id: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT" | string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
}) {
  return {
    id: a.id,
    type: a.type as "IMAGE" | "VIDEO" | "DOCUMENT",
    originalName: a.originalName ?? null,
    mimeType: a.mimeType ?? null,
    size: a.size ?? null,
    downloadPath: `/api/tasks/attachments/${a.id}`,
  };
}

export function isDataUrlStorage(storageUrl: string) {
  return storageUrl.startsWith("data:");
}

/**
 * Load private Blob (or local data-URL fallback) for authenticated proxy streaming.
 * Never logs tokens or full storage URLs.
 */
export async function loadTaskAttachmentBytes(opts: {
  storageUrl: string;
  storageKey?: string | null;
  mimeType?: string | null;
}): Promise<{
  body: ReadableStream<Uint8Array> | Buffer;
  contentType: string;
  size?: number | null;
}> {
  if (isDataUrlStorage(opts.storageUrl)) {
    const comma = opts.storageUrl.indexOf(",");
    if (comma < 0) {
      throw Object.assign(new Error("Noto‘g‘ri data URL"), { status: 500 });
    }
    const meta = opts.storageUrl.slice(5, comma);
    const payload = opts.storageUrl.slice(comma + 1);
    const contentType =
      meta.split(";")[0] || opts.mimeType || "application/octet-stream";
    const isBase64 = /;base64/i.test(meta);
    const buffer = Buffer.from(
      isBase64 ? payload : decodeURIComponent(payload),
      isBase64 ? "base64" : "utf8"
    );
    return { body: buffer, contentType, size: buffer.byteLength };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw Object.assign(
      new Error("STORAGE_NOT_CONFIGURED: BLOB_READ_WRITE_TOKEN sozlanmagan"),
      { code: "STORAGE_NOT_CONFIGURED", status: 503 }
    );
  }

  const ref = (opts.storageKey?.trim() || opts.storageUrl).trim();
  const result = await get(ref, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw Object.assign(new Error("Fayl topilmadi"), { status: 404 });
  }

  return {
    body: result.stream,
    contentType:
      result.blob.contentType ||
      opts.mimeType ||
      "application/octet-stream",
    size: result.blob.size,
  };
}
