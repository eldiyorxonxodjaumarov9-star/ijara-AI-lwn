/**
 * Arenda Agent Gateway — unit tests (no DB required for auth/redact/format).
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  issueAgentAccessToken,
  verifyAgentAccessToken,
} from "./auth";
import {
  isAiEmployeesEnvEnabled,
  resolveGrantedScopes,
  verifyClientCredentials,
} from "./config";
import { hasAllScopes, PAYMENT_SCOPES, MANAGER_SCOPES } from "./scopes";
import { redactObject, summarizeForAudit } from "./redact";
import {
  buildDefaultRecommendations,
  formatDailyManagerReportUz,
} from "./report-format";
import { dailyReportIdempotencyKey } from "./daily-snapshot";
import type { DailySnapshot } from "./daily-snapshot";
import { telegramNotifySchema } from "./telegram-notify";
import { __resetAgentRateLimitForTests, checkAgentRateLimit } from "./rate-limit";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockSnapshot: DailySnapshot = JSON.parse(
  readFileSync(
    join(
      __dirname,
      "../../../../services/hermes-agent/fixtures/daily-snapshot.mock.json"
    ),
    "utf8"
  )
);

describe("agent gateway auth", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.AI_EMPLOYEES_ENABLED = "true";
    process.env.AGENT_GATEWAY_CLIENT_ID = "hermes-arenda-ai";
    process.env.AGENT_GATEWAY_CLIENT_SECRET = "test-client-secret-value";
    process.env.AGENT_GATEWAY_SIGNING_SECRET = "test-signing-secret-value-32b";
    process.env.AGENT_GATEWAY_TOKEN_TTL_SEC = "300";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("issues short-lived token with server scopes", () => {
    const issued = issueAgentAccessToken({
      clientId: "hermes-arenda-ai",
      clientSecret: "test-client-secret-value",
      requestedScopes: ["payments:read", "payments:write" as string],
    });
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    assert.ok(issued.expiresIn <= 900);
    assert.ok(issued.scopes.includes("payments:read"));
    assert.ok(!issued.scopes.includes("payments:write" as never));

    const verified = verifyAgentAccessToken(issued.accessToken);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.claims.serviceId, "hermes-arenda-ai");
    assert.ok(verified.claims.jti);
    assert.ok(verified.claims.exp > verified.claims.iat);
  });

  it("rejects invalid client", () => {
    const issued = issueAgentAccessToken({
      clientId: "hermes-arenda-ai",
      clientSecret: "wrong",
    });
    assert.equal(issued.ok, false);
    if (issued.ok) return;
    assert.equal(issued.code, "INVALID_CLIENT");
  });

  it("timing-safe client verify", () => {
    assert.equal(
      verifyClientCredentials("hermes-arenda-ai", "test-client-secret-value"),
      true
    );
    assert.equal(
      verifyClientCredentials("hermes-arenda-ai", "test-client-secret-valux"),
      false
    );
  });

  it("scope rejection helper", () => {
    assert.equal(hasAllScopes(["payments:read"], PAYMENT_SCOPES), false);
    assert.equal(
      hasAllScopes(["payments:read", "debts:read"], PAYMENT_SCOPES),
      true
    );
    assert.equal(hasAllScopes(["payments:read"], MANAGER_SCOPES), false);
  });

  it("resolveGrantedScopes cannot invent scopes", () => {
    const scopes = resolveGrantedScopes(["payments:read", "admin:all"]);
    assert.deepEqual(scopes, ["payments:read"]);
  });
});

describe("kill switch env", () => {
  const envBackup = { ...process.env };
  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("production fail-closed when unset", () => {
    const prev = process.env.NODE_ENV;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
      writable: true,
    });
    delete process.env.AI_EMPLOYEES_ENABLED;
    try {
      assert.equal(isAiEmployeesEnvEnabled(), false);
    } finally {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: prev,
        configurable: true,
        writable: true,
      });
    }
  });

  it("production enabled only when true", () => {
    const prev = process.env.NODE_ENV;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
      writable: true,
    });
    process.env.AI_EMPLOYEES_ENABLED = "true";
    try {
      assert.equal(isAiEmployeesEnvEnabled(), true);
    } finally {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: prev,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe("money / report formatting", () => {
  it("keeps fixture numbers in Uzbek report", () => {
    const text = formatDailyManagerReportUz(mockSnapshot);
    assert.match(text, /3 ta/);
    assert.match(text, /2 ta/);
    assert.match(text, /8[\s\u00a0]?500[\s\u00a0]?000/);
    assert.match(text, /2026-09|sentabr|Sentabr/i);
    assert.match(text, /7\.14%/);
    assert.match(text, /18\.1%/);
    assert.match(text, /4[\s\u00a0]?200[\s\u00a0]?000/);
    assert.match(text, /4[\s\u00a0]?960[\s\u00a0]?000/);
  });

  it("percent null when previous is 0", () => {
    const s: DailySnapshot = {
      ...mockSnapshot,
      comparison: {
        ...mockSnapshot.comparison,
        income: {
          current: 100,
          previous: 0,
          difference: 100,
          percent: null,
        },
      },
    };
    const text = formatDailyManagerReportUz(s);
    assert.match(text, /foiz hisoblanmadi|oldingi qiymat 0/);
  });

  it("default recommendations evidence-based", () => {
    const recs = buildDefaultRecommendations(mockSnapshot);
    assert.ok(recs.some((r) => r.includes("kechikkan")));
    assert.ok(recs.some((r) => /Elektr|elektr/i.test(r) || r.includes("xarajat")));
  });

  it("idempotency key format", () => {
    assert.equal(
      dailyReportIdempotencyKey("2026-09-14"),
      "daily-manager-report:2026-09-14"
    );
  });
});

describe("secret redaction", () => {
  it("redacts tokens and secrets", () => {
    const out = redactObject({
      accessToken: "secret-value",
      clientSecret: "x",
      ok: 1,
    });
    assert.equal(out.accessToken, "[REDACTED]");
    assert.equal(out.clientSecret, "[REDACTED]");
    assert.equal(out.ok, 1);
    const summary = summarizeForAudit({ authorization: "Bearer abc", pin: "1234" });
    assert.ok(!summary.includes("Bearer abc"));
    assert.ok(!summary.includes("1234") || summary.includes("REDACTED"));
  });
});

describe("telegram template validation", () => {
  it("accepts DAILY_MANAGER_REPORT", () => {
    const parsed = telegramNotifySchema.safeParse({
      type: "DAILY_MANAGER_REPORT",
      reportDate: "2026-09-14",
      idempotencyKey: "daily-manager-report:2026-09-14",
      report: {
        dueTodayCount: 3,
        overdueCount: 2,
        totalDebt: 8500000,
      },
    });
    assert.equal(parsed.success, true);
  });

  it("rejects wrong type", () => {
    const parsed = telegramNotifySchema.safeParse({
      type: "RAW",
      reportDate: "2026-09-14",
      idempotencyKey: "daily-manager-report:2026-09-14",
      report: {
        dueTodayCount: 1,
        overdueCount: 0,
        totalDebt: 0,
      },
    });
    assert.equal(parsed.success, false);
  });

  it("rejects an LLM-supplied financial snapshot", () => {
    const parsed = telegramNotifySchema.safeParse({
      type: "DAILY_MANAGER_REPORT",
      reportDate: "2026-09-14",
      idempotencyKey: "daily-manager-report:2026-09-14",
      report: {
        dueTodayCount: 3,
        overdueCount: 2,
        totalDebt: 8500000,
      },
      snapshot: { payments: { totalDebt: 1 } },
    });
    assert.equal(parsed.success, false);
  });
});

describe("rate limit", () => {
  beforeEach(() => __resetAgentRateLimitForTests());
  it("allows under cap", () => {
    assert.equal(checkAgentRateLimit("t1").ok, true);
  });
});

describe("security: no TTLock write skill", () => {
  it("skills tree has no ttlock write", () => {
    const root = join(__dirname, "../../../../services/hermes-agent/skills");
    const dirs = readdirSync(root);
    assert.ok(!dirs.some((d: string) => /ttlock/i.test(d)));
    for (const d of dirs) {
      const skill = readFileSync(join(root, d, "SKILL.md"), "utf8");
      assert.ok(
        !/keyboardPwd|\/lock\/unlock|ttlock\.com/i.test(skill),
        `${d} must not include TTLock write API affordances`
      );
    }
  });
});
