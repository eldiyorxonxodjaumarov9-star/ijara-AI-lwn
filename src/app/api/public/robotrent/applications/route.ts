import { NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/api-server/contract-draft/rate-limit";
import { createRobotRentApplication } from "@/lib/api-server/robotrent/applications";
import { parseRobotRentApplicationBody } from "@/lib/api-server/robotrent/validation";
import { hashClientIp } from "@/lib/api-server/qr-feedback/media";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("So‘rov qabul qilinmadi", 501);

  const ip = clientIp(req);
  const rl = checkRateLimit(`robotrent-app:${ip}`, 5, 60_000);
  if (!rl.ok) return fail("So‘rov qabul qilinmadi", 429);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("So‘rov qabul qilinmadi", 400);
  }

  const parsed = parseRobotRentApplicationBody(body);
  if (!parsed.ok) return fail("So‘rov qabul qilinmadi", 400);

  try {
    const result = await createRobotRentApplication({
      type: parsed.type,
      data: parsed.data,
      submitIpHash: hashClientIp(ip),
    });
    return ok(result, result.duplicate ? 200 : 201);
  } catch {
    return fail("So‘rov qabul qilinmadi", 500);
  }
}