import { put } from "@vercel/blob";
import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Form ma'lumoti noto'g'ri", 400);
  }

  const entries = form.getAll("files");
  const urls: string[] = [];

  for (const entry of entries) {
    if (!(entry instanceof File) || entry.size === 0) continue;

    if (!ALLOWED_TYPES.has(entry.type)) {
      return fail("Faqat JPEG, PNG, WebP yoki GIF ruxsat etiladi", 400);
    }
    if (entry.size > MAX_BYTES) {
      return fail("Rasm hajmi 5MB dan oshmasligi kerak", 400);
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(
        `arendahub/${Date.now()}-${entry.name.replace(/[^\w.-]/g, "_")}`,
        entry,
        { access: "public", addRandomSuffix: true }
      );
      urls.push(blob.url);
      continue;
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    urls.push(`data:${entry.type};base64,${buffer.toString("base64")}`);
  }

  if (urls.length === 0) {
    return fail("Rasm fayli topilmadi", 400);
  }

  return ok({ urls });
}
