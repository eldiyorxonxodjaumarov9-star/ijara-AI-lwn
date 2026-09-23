import type { NextRequest } from "next/server";

import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import { timingSafeSecretEqual } from "@/lib/api-server/cron-auth";

export type LwnAgentAuthOk = {
  traceId: string;
  mode: "agent_jwt" | "static_token";
};

/**
 * Shared auth for LWN Telegram agent routes:
 * static LWN_TELEGRAM_AGENT_TOKEN Bearer OR Agent Gateway JWT with given scopes.
 */
export async function authorizeLwnAgentRequest(
  req: NextRequest,
  requiredScopes: readonly ("rooms:read")[] = ["rooms:read"]
): Promise<{ error: Response } | LwnAgentAuthOk> {
  const staticToken = process.env.LWN_TELEGRAM_AGENT_TOKEN?.trim() || "";
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (staticToken.length > 0 && bearer.length > 0) {
    if (timingSafeSecretEqual(bearer, staticToken)) {
      return {
        traceId:
          req.headers.get("x-trace-id")?.trim() ||
          req.headers.get("x-request-id")?.trim() ||
          "lwn-static",
        mode: "static_token",
      };
    }
  }

  const auth = await requireAgentAuth(req, requiredScopes);
  if ("error" in auth) return { error: auth.error };
  return { traceId: auth.ctx.traceId, mode: "agent_jwt" };
}
