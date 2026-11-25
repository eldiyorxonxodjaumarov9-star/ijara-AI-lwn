/**
 * Public base URL encoded into printable QR codes.
 * Must be reachable from a phone (LAN IP, tunnel, or production domain).
 * Never encode localhost / null / relative hosts into QR payloads.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "null",
  "undefined",
]);

export type QrPublicOriginResult =
  | { ok: true; origin: string; source: string }
  | { ok: false; error: string; raw: string | null };

function cleanEnv(value: string | undefined | null): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "null" || lower === "undefined") return null;
  return trimmed.replace(/\/$/, "");
}

function candidates(): Array<{ raw: string; source: string }> {
  const keys: Array<[string, string]> = [
    ["IJARA_QR_PUBLIC_ORIGIN", "IJARA_QR_PUBLIC_ORIGIN"],
    ["QR_PUBLIC_ORIGIN", "QR_PUBLIC_ORIGIN"],
    ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_APP_URL"],
    ["APP_URL", "APP_URL"],
  ];
  const out: Array<{ raw: string; source: string }> = [];
  for (const [key, source] of keys) {
    const raw = cleanEnv(process.env[key]);
    if (raw) out.push({ raw, source });
  }
  return out;
}

export function inspectQrPublicOrigin(): QrPublicOriginResult {
  const allowLocalhost = process.env.IJARA_QR_ALLOW_LOCALHOST === "1";
  const list = candidates();
  if (list.length === 0) {
    return {
      ok: false,
      raw: null,
      error:
        "QR public URL sozlanmagan. IJARA_QR_PUBLIC_ORIGIN yoki NEXT_PUBLIC_APP_URL qo‘ying (masalan https://ijaraai.uz).",
    };
  }

  let lastBlocked: { raw: string; source: string } | null = null;

  for (const { raw, source } of list) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      // Skip invalid candidate; try next env var
      continue;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      continue;
    }

    const host = (parsed.hostname || "").toLowerCase();
    if (!host || BLOCKED_HOSTS.has(host)) {
      if (allowLocalhost && (host === "localhost" || host === "127.0.0.1")) {
        return { ok: true, origin: parsed.origin, source };
      }
      lastBlocked = { raw, source };
      continue;
    }

    return { ok: true, origin: parsed.origin, source };
  }

  if (lastBlocked) {
    return {
      ok: false,
      raw: lastBlocked.raw,
      error:
        `QR ichiga localhost/null yozilmaydi (${lastBlocked.source}=${lastBlocked.raw}). ` +
        `Production uchun IJARA_QR_PUBLIC_ORIGIN=https://ijaraai.uz qo‘ying.`,
    };
  }

  return {
    ok: false,
    raw: null,
    error: "QR public URL topilmadi yoki noto‘g‘ri.",
  };
}

/** Throws status 400 when origin is not phone-safe. */
export function requireQrPublicOrigin(): { origin: string; source: string } {
  const result = inspectQrPublicOrigin();
  if (!result.ok) {
    throw Object.assign(new Error(result.error), { status: 400 });
  }
  return { origin: result.origin, source: result.source };
}

export function feedbackPublicUrlForToken(token: string) {
  const { origin } = requireQrPublicOrigin();
  const path = `/f/${token}`;
  return `${origin}${path}`;
}
