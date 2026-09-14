import type { NextRequest } from "next/server";

import { verifyAgentAccessToken } from "@/lib/api-server/agent-gateway/auth";
import {
  isAiEmployeesEnvEnabled,
  isGatewayConfigured,
} from "@/lib/api-server/agent-gateway/config";
import type { AgentScope } from "@/lib/api-server/agent-gateway/scopes";
import { hasAllScopes } from "@/lib/api-server/agent-gateway/scopes";
import { getOrCreateAgentSettings } from "@/lib/api-server/agent-gateway/settings";
import { fail } from "@/lib/api-server/http";
import { checkAgentRateLimit } from "@/lib/api-server/agent-gateway/rate-limit";

export type AgentAuthContext = {
  serviceId: string;
  scopes: AgentScope[];
  tokenId: string;
  traceId: string;
};

export async function requireAgentAuth(
  req: NextRequest,
  requiredScopes: readonly AgentScope[] = []
): Promise<{ ctx: AgentAuthContext } | { error: Response }> {
  if (!isAiEmployeesEnvEnabled()) {
    return { error: fail("AI Employees o‘chirilgan", 503, "AI_EMPLOYEES_DISABLED") };
  }
  if (!isGatewayConfigured()) {
    return {
      error: fail("Agent Gateway sozlanmagan", 503, "GATEWAY_NOT_CONFIGURED"),
    };
  }

  const settings = await getOrCreateAgentSettings();
  if (!settings.masterEnabled) {
    return {
      error: fail("AI Employees master o‘chirilgan", 503, "MASTER_DISABLED"),
    };
  }

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { error: fail("Autentifikatsiya talab qilinadi", 401, "UNAUTHORIZED") };
  }

  const verified = verifyAgentAccessToken(header.slice(7));
  if (!verified.ok) {
    return { error: fail(verified.message, 401, verified.code) };
  }

  if (!hasAllScopes(verified.claims.scopes, requiredScopes)) {
    return { error: fail("Scope yetarli emas", 403, "INSUFFICIENT_SCOPE") };
  }

  const traceId =
    req.headers.get("x-trace-id")?.trim() ||
    req.headers.get("x-request-id")?.trim() ||
    verified.claims.jti;

  const limited = checkAgentRateLimit(verified.claims.serviceId);
  if (!limited.ok) {
    return { error: fail("Rate limit", 429, "RATE_LIMITED") };
  }

  return {
    ctx: {
      serviceId: verified.claims.serviceId,
      scopes: verified.claims.scopes,
      tokenId: verified.claims.jti,
      traceId,
    },
  };
}
