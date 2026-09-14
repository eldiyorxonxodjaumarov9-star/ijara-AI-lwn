import { NextRequest } from "next/server";
import { z } from "zod";

import { issueAgentAccessToken } from "@/lib/api-server/agent-gateway/auth";
import {
  isAiEmployeesEnvEnabled,
  isGatewayConfigured,
} from "@/lib/api-server/agent-gateway/config";
import { checkAgentRateLimit } from "@/lib/api-server/agent-gateway/rate-limit";
import { fail, ok } from "@/lib/api-server/http";

const bodySchema = z.object({
  clientId: z.string().min(1).max(128),
  clientSecret: z.string().min(1).max(512),
  scopes: z.array(z.string().min(1).max(64)).max(32).optional(),
});

/**
 * POST /api/internal/agent/v1/auth/token
 * Service credentials → short-lived scoped access token.
 */
export async function POST(req: NextRequest) {
  if (!isAiEmployeesEnvEnabled()) {
    return fail("AI Employees o‘chirilgan", 503, "AI_EMPLOYEES_DISABLED");
  }
  if (!isGatewayConfigured()) {
    return fail("Agent Gateway sozlanmagan", 503, "GATEWAY_NOT_CONFIGURED");
  }

  const limited = checkAgentRateLimit("auth-token");
  if (!limited.ok) {
    return fail("Rate limit", 429, "RATE_LIMITED");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  }

  const issued = issueAgentAccessToken({
    clientId: parsed.data.clientId,
    clientSecret: parsed.data.clientSecret,
    requestedScopes: parsed.data.scopes,
  });

  if (!issued.ok) {
    const status = issued.code === "INVALID_CLIENT" ? 401 : 503;
    return fail(issued.message, status, issued.code);
  }

  return ok({
    accessToken: issued.accessToken,
    tokenType: "Bearer",
    expiresIn: issued.expiresIn,
    scopes: issued.scopes,
  });
}
