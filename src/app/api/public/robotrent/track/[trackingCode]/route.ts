import { NextRequest } from "next/server";

import { getRobotRentByTrackingCode } from "@/lib/api-server/robotrent/applications";
import { serializePublicTracking } from "@/lib/api-server/robotrent/serializers";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ trackingCode: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("Xizmat vaqtincha ishlamaydi", 501);
  const { trackingCode } = await ctx.params;
  const app = await getRobotRentByTrackingCode(trackingCode);
  if (!app) return fail("Ariza topilmadi", 404);
  return ok(serializePublicTracking(app));
}