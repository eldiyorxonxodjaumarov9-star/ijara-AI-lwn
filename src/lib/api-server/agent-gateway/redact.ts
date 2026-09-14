const SECRET_KEYS =
  /password|secret|token|authorization|cookie|apikey|api_key|bearer|pin\b|passport|md5/i;

export function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEYS.test(key)) return "[REDACTED]";
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}…`;
  }
  return value;
}

export function redactObject(
  input: Record<string, unknown> | null | undefined,
  maxKeys = 40
): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  let i = 0;
  for (const [k, v] of Object.entries(input)) {
    if (i++ >= maxKeys) {
      out._truncated = true;
      break;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactObject(v as Record<string, unknown>, 20);
    } else if (Array.isArray(v)) {
      out[k] = `[array:${v.length}]`;
    } else {
      out[k] = redactValue(k, v);
    }
  }
  return out;
}

export function summarizeForAudit(input: unknown, maxLen = 800): string {
  try {
    const raw =
      typeof input === "string"
        ? input
        : JSON.stringify(
            typeof input === "object" && input
              ? redactObject(input as Record<string, unknown>)
              : input
          );
    if (raw.length <= maxLen) return raw;
    return `${raw.slice(0, maxLen)}…`;
  } catch {
    return "[unserializable]";
  }
}
