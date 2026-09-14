import { get, put } from "@vercel/blob";

import { isDevOrTestStorageFallbackAllowed } from "@/lib/api-server/tasks/task-attachments";

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function storeContractDocx(opts: {
  requestId: string;
  buffer: Buffer;
  fileName: string;
}): Promise<{ storageUrl: string; storageKey: string; byteSize: number }> {
  const key = `contracts/${opts.requestId}/${opts.fileName}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, opts.buffer, {
      access: "private",
      addRandomSuffix: true,
      contentType: MIME_DOCX,
    });
    return {
      storageUrl: blob.url,
      storageKey: blob.pathname ?? key,
      byteSize: opts.buffer.byteLength,
    };
  }
  if (!isDevOrTestStorageFallbackAllowed()) {
    throw Object.assign(
      new Error("STORAGE_NOT_CONFIGURED: BLOB_READ_WRITE_TOKEN sozlanmagan"),
      { code: "STORAGE_NOT_CONFIGURED", status: 503 }
    );
  }
  const b64 = opts.buffer.toString("base64");
  return {
    storageUrl: `data:${MIME_DOCX};base64,${b64}`,
    storageKey: key,
    byteSize: opts.buffer.byteLength,
  };
}

export async function loadContractDocxBytes(opts: {
  storageUrl: string;
  storageKey?: string | null;
}): Promise<{ body: Buffer; contentType: string }> {
  if (opts.storageUrl.startsWith("data:")) {
    const comma = opts.storageUrl.indexOf(",");
    const payload = opts.storageUrl.slice(comma + 1);
    return {
      body: Buffer.from(payload, "base64"),
      contentType: MIME_DOCX,
    };
  }
  const ref = (opts.storageKey?.trim() || opts.storageUrl).trim();
  const result = await get(ref, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw Object.assign(new Error("Hujjat topilmadi"), { status: 404 });
  }
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return {
    body: Buffer.concat(chunks.map((c) => Buffer.from(c))),
    contentType: result.blob.contentType || MIME_DOCX,
  };
}
