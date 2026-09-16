import { NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/api-server/contract-draft/rate-limit";
import {
  isLeadHoneypotTriggered,
  parsePublicLeadBody,
  upsertPublicClientLead,
} from "@/lib/api-server/clients/public-lead";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Portal kirishida CRM lead yozuvi (autentifikatsiyasiz, rate-limited). */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("So'rov qabul qilinmadi", 501);

  const ip = clientIp(req);
  const rl = checkRateLimit(`clients-lead:${ip}`, 8, 60_000);
  if (!rl.ok) {
    return fail("So'rov qabul qilinmadi", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("So'rov qabul qilinmadi", 400);
  }

  // Honeypot: reject without writing. Same generic 400 as validation to avoid
  // teaching bots which field tripped (and never persist spam).
  if (isLeadHoneypotTriggered(body)) {
    return fail("So'rov qabul qilinmadi", 400);
  }

  const parsed = parsePublicLeadBody(body);
  if (!parsed.ok) {
    return fail("So'rov qabul qilinmadi", 400);
  }

  try {
    await upsertPublicClientLead(parsed.data);
    return ok({ accepted: true }, 201);
  } catch {
    return fail("So'rov qabul qilinmadi", 500);
  }
}
