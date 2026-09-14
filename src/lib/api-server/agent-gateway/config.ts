import { timingSafeSecretEqual } from "@/lib/api-server/cron-auth";
import type { AgentScope } from "@/lib/api-server/agent-gateway/scopes";
import { ALL_SERVICE_SCOPES, isAgentScope } from "@/lib/api-server/agent-gateway/scopes";

export function envFlagTrue(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isAiEmployeesEnvEnabled(): boolean {
  // Default fail-closed in production unless explicitly enabled.
  if (process.env.NODE_ENV === "production") {
    return envFlagTrue("AI_EMPLOYEES_ENABLED");
  }
  // Local/dev: allow when unset so tests can run; still require secrets for token.
  if (process.env.AI_EMPLOYEES_ENABLED === undefined) return true;
  return envFlagTrue("AI_EMPLOYEES_ENABLED");
}

export function readGatewayConfig() {
  const issuer =
    process.env.AGENT_GATEWAY_ISSUER?.trim() || "arenda-ai-agent-gateway";
  const audience =
    process.env.AGENT_GATEWAY_AUDIENCE?.trim() || "hermes-arenda-ai";
  const clientId =
    process.env.AGENT_GATEWAY_CLIENT_ID?.trim() || "hermes-arenda-ai";
  const clientSecret = process.env.AGENT_GATEWAY_CLIENT_SECRET?.trim() || "";
  const signingSecret = process.env.AGENT_GATEWAY_SIGNING_SECRET?.trim() || "";
  const tokenTtlSec = Math.min(
    900,
    Math.max(60, Number(process.env.AGENT_GATEWAY_TOKEN_TTL_SEC ?? 600) || 600)
  );
  return { issuer, audience, clientId, clientSecret, signingSecret, tokenTtlSec };
}

export function isGatewayConfigured(): boolean {
  const c = readGatewayConfig();
  return Boolean(c.clientSecret && c.signingSecret && c.clientId);
}

export function verifyClientCredentials(
  clientId: string,
  clientSecret: string
): boolean {
  const c = readGatewayConfig();
  if (!c.clientSecret || !c.clientId) return false;
  if (clientId !== c.clientId) return false;
  return timingSafeSecretEqual(clientSecret, c.clientSecret);
}

/** Server-owned allowlist — client cannot invent scopes. */
export function resolveGrantedScopes(
  requested: string[] | undefined
): AgentScope[] {
  const allow = ALL_SERVICE_SCOPES;
  if (!requested || requested.length === 0) return [...allow];
  return requested.filter(isAgentScope).filter((s) => allow.includes(s));
}
