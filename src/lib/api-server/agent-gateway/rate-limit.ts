type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

export function checkAgentRateLimit(key: string): { ok: true } | { ok: false } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= MAX_PER_WINDOW) return { ok: false };
  bucket.count += 1;
  return { ok: true };
}

/** Tests only */
export function __resetAgentRateLimitForTests() {
  buckets.clear();
}
