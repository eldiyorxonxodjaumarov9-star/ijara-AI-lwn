import { NextRequest } from "next/server";

import {
  FEEDBACK_ALLOWED_MIME,
  FEEDBACK_MAX_PHOTO_BYTES,
  FEEDBACK_MAX_PHOTOS,
  RATING_META,
} from "@/lib/api-server/qr-feedback/constants";
import {
  getPublicQrByToken,
  submitPublicFeedback,
} from "@/lib/api-server/qr-feedback/service";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { token } = await ctx.params;
  const qr = await getPublicQrByToken(token);
  if (!qr) return fail("QR topilmadi yoki faol emas", 404);
  return ok({
    name: qr.name,
    locationLabel: qr.locationLabel,
    roomNumber: qr.roomNumber,
    roomLabel: qr.roomLabel,
    printInstruction: qr.printInstruction,
    brandName: qr.brandName,
    ratings: Object.entries(RATING_META).map(([key, meta]) => ({
      key,
      value: meta.value,
      emoji: meta.emoji,
      label: meta.label,
    })),
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const { token } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Form ma’lumoti noto‘g‘ri", 400);
  }

  const ratingValue = Number(form.get("rating"));
  const comment = String(form.get("comment") || "");
  const idempotencyKey = String(form.get("idempotencyKey") || "");
  const files = form.getAll("photos");
  const photos: Array<{ buffer: Buffer; mimeType: string; name?: string }> = [];

  for (const entry of files) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (!FEEDBACK_ALLOWED_MIME.has(entry.type)) {
      return fail("Faqat JPEG, PNG yoki WebP", 400);
    }
    if (entry.size > FEEDBACK_MAX_PHOTO_BYTES) {
      return fail("Rasm 5MB dan oshmasin", 400);
    }
    photos.push({
      buffer: Buffer.from(await entry.arrayBuffer()),
      mimeType: entry.type,
      name: entry.name,
    });
  }
  if (photos.length > FEEDBACK_MAX_PHOTOS) {
    return fail("Maksimal 3 ta rasm", 400);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  try {
    const result = await submitPublicFeedback({
      token,
      ratingValue,
      comment,
      photos,
      clientIp: ip,
      userAgent: req.headers.get("user-agent"),
      idempotencyKey,
    });
    return ok(result);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status) || 400
        : 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}
