export const AGENT_SCOPES = [
  "agent:runs:create",
  "agent:delegate",
  "reports:compose",
  "payments:read",
  "debts:read",
  "analytics:read",
  "expenses:read",
  "rooms:read",
  "notifications:telegram",
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const MANAGER_SCOPES: AgentScope[] = [
  "agent:runs:create",
  "agent:delegate",
  "reports:compose",
  "notifications:telegram",
];

export const PAYMENT_SCOPES: AgentScope[] = ["payments:read", "debts:read"];

export const ANALYST_SCOPES: AgentScope[] = [
  "analytics:read",
  "expenses:read",
  "rooms:read",
];

export const ALL_SERVICE_SCOPES: AgentScope[] = [...AGENT_SCOPES];

export function isAgentScope(value: string): value is AgentScope {
  return (AGENT_SCOPES as readonly string[]).includes(value);
}

export function hasAllScopes(
  granted: readonly string[],
  required: readonly AgentScope[]
): boolean {
  const set = new Set(granted);
  return required.every((s) => set.has(s));
}
