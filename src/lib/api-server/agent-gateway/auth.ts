import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import {
  readGatewayConfig,
  resolveGrantedScopes,
  verifyClientCredentials,
} from "@/lib/api-server/agent-gateway/config";
import type { AgentScope } from "@/lib/api-server/agent-gateway/scopes";

export type AgentAccessTokenClaims = {
  sub: string;
  serviceId: string;
  aud: string;
  iss: string;
  scopes: AgentScope[];
  iat: number;
  exp: number;
  jti: string;
};

export function issueAgentAccessToken(input: {
  clientId: string;
  clientSecret: string;
  requestedScopes?: string[];
}):
  | { ok: true; accessToken: string; expiresIn: number; scopes: AgentScope[] }
  | { ok: false; code: string; message: string } {
  const cfg = readGatewayConfig();
  if (!cfg.signingSecret || !cfg.clientSecret) {
    return {
      ok: false,
      code: "GATEWAY_NOT_CONFIGURED",
      message: "Agent Gateway secretlari sozlanmagan",
    };
  }
  if (!verifyClientCredentials(input.clientId, input.clientSecret)) {
    return {
      ok: false,
      code: "INVALID_CLIENT",
      message: "Client credentials noto‘g‘ri",
    };
  }

  const scopes = resolveGrantedScopes(input.requestedScopes);
  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();
  const claims: AgentAccessTokenClaims = {
    sub: cfg.clientId,
    serviceId: cfg.clientId,
    aud: cfg.audience,
    iss: cfg.issuer,
    scopes,
    iat: now,
    exp: now + cfg.tokenTtlSec,
    jti,
  };

  const accessToken = jwt.sign(claims, cfg.signingSecret, {
    algorithm: "HS256",
  });

  return {
    ok: true,
    accessToken,
    expiresIn: cfg.tokenTtlSec,
    scopes,
  };
}

export function verifyAgentAccessToken(
  token: string
):
  | { ok: true; claims: AgentAccessTokenClaims }
  | { ok: false; code: string; message: string } {
  const cfg = readGatewayConfig();
  if (!cfg.signingSecret) {
    return {
      ok: false,
      code: "GATEWAY_NOT_CONFIGURED",
      message: "Agent Gateway secretlari sozlanmagan",
    };
  }
  try {
    const payload = jwt.verify(token, cfg.signingSecret, {
      algorithms: ["HS256"],
      audience: cfg.audience,
      issuer: cfg.issuer,
    }) as AgentAccessTokenClaims;

    if (!payload?.serviceId || !Array.isArray(payload.scopes)) {
      return { ok: false, code: "INVALID_TOKEN", message: "Token yaroqsiz" };
    }
    return { ok: true, claims: payload };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TokenExpiredError") {
      return { ok: false, code: "TOKEN_EXPIRED", message: "Token muddati tugagan" };
    }
    return { ok: false, code: "INVALID_TOKEN", message: "Token yaroqsiz" };
  }
}
