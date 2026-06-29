import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  disconnectInstagram,
  getInstagramPublicStatus,
  saveInstagramSettings,
  testInstagramConnection,
} from "@/lib/api-server/integrations/instagram-service";

export async function GET() {
  return ok(await getInstagramPublicStatus());
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      enabled?: boolean;
      appId?: string;
      appSecret?: string;
      redirectUri?: string;
      accessToken?: string;
      accountId?: string;
      igUsername?: string;
    };

    await saveInstagramSettings(body);
    return ok(await getInstagramPublicStatus());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Saqlash xatosi";
    return fail(message, 500);
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };

  if (body.action === "test") {
    const result = await testInstagramConnection();
    if (!result.ok) return fail(result.message, 400);
    return ok(result);
  }

  if (body.action === "disconnect") {
    await disconnectInstagram();
    return ok({ disconnected: true });
  }

  return fail("Noto'g'ri action", 400);
}
