import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

import { MAPPERS } from "@/lib/api/mappers";
import { prisma } from "@/lib/api-server/prisma";
import { selectCanonicalDebts, summarizeCanonicalDebts } from "@/lib/debts/canonical-debts";
import { summarizeAllDebts } from "@/lib/manual-debts";
import type { Contract, Payment, Tenant } from "@/types";

import { AI_AGENTS, buildAgentMessages, enforceGrounding, parseAgentAnalysis } from "./agents";
import { deepSeekChat, DeepSeekError, deepSeekStatus, readDeepSeekConfig, DEEPSEEK_MAX_RETRIES } from "./deepseek";
import { countsAsAiWork, runAiAgent, runDailyReport } from "./run-agent";
import { AGENT_TOOLS, runAgentTools, type ToolDb } from "./tools";
import { createFakeDb, NOW, seedTwoWorkspaces, type FakeData } from "./test-fixtures";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- tool payloads

const KEY = "sk-test-deepseek-secret-value";
const ENV = { DEEPSEEK_API_KEY: KEY, DEEPSEEK_MODEL: "deepseek-test-model" } as unknown as NodeJS.ProcessEnv;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function completion(content: unknown, usage: unknown = { prompt_tokens: 1234, completion_tokens: 321 }) {
  return jsonResponse({
    id: "resp-1",
    model: "deepseek-test-model",
    choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
    ...(usage ? { usage } : {}),
  });
}

const GOOD_ANALYSIS = {
  summary: "Holat barqaror.",
  attention: ["Qarzdor shartnoma bor — undirish kerak."],
  recommendations: ["Qarzdorga eslatma yuboring."],
  dataGaps: [],
};

function toolsCtx(db: unknown, workspaceId = "ws-a") {
  return { db: db as ToolDb, workspaceId, now: NOW, loadUsageAnalytics: async () => ({ workShare: { total: 0 } }) };
}

/* ---------------------------------- provider --------------------------------- */

describe("DeepSeek provider", () => {
  it("1. configured from DEEPSEEK_API_KEY + DEEPSEEK_MODEL (model not hardcoded)", () => {
    const cfg = readDeepSeekConfig(ENV);
    assert.equal(cfg?.model, "deepseek-test-model");
    assert.equal(cfg?.baseUrl, "https://api.deepseek.com");
    assert.deepEqual(deepSeekStatus(ENV), { configured: true, model: "deepseek-test-model" });
    const src = readFileSync(join(__dirname, "deepseek.ts"), "utf8");
    assert.doesNotMatch(src, /deepseek-(chat|reasoner|v\d)/, "no model name in code");
  });

  it("2. missing key → safely disabled, no request, no fake answer", async () => {
    assert.deepEqual(deepSeekStatus({ DEEPSEEK_MODEL: "m" } as unknown as NodeJS.ProcessEnv), {
      configured: false,
      missing: ["DEEPSEEK_API_KEY"],
    });
    let called = false;
    await assert.rejects(
      deepSeekChat({ messages: [] }, { config: null, fetchImpl: (async () => ((called = true), completion("{}"))) as typeof fetch }),
      (e: unknown) => e instanceof DeepSeekError && e.code === "DEEPSEEK_NOT_CONFIGURED"
    );
    assert.equal(called, false);
  });

  it("21. token usage is taken from the provider; absent usage stays null (not 0)", async () => {
    const cfg = readDeepSeekConfig(ENV)!;
    const withUsage = await deepSeekChat({ messages: [] }, { config: cfg, fetchImpl: (async () => completion("{}")) as typeof fetch });
    assert.deepEqual(withUsage.usage, { inputTokens: 1234, outputTokens: 321 });
    const without = await deepSeekChat({ messages: [] }, { config: cfg, fetchImpl: (async () => completion("{}", null)) as typeof fetch });
    assert.equal(without.usage, null);
  });

  it("retries transient errors at most twice, never leaks the key", async () => {
    const cfg = readDeepSeekConfig(ENV)!;
    let calls = 0;
    const err = await deepSeekChat(
      { messages: [] },
      { config: cfg, sleep: async () => {}, fetchImpl: (async () => (calls++, jsonResponse({ error: "busy" }, 503))) as typeof fetch }
    ).then(() => assert.fail("expected failure"), (e: unknown) => e as DeepSeekError);
    assert.equal(calls, DEEPSEEK_MAX_RETRIES + 1);
    assert.equal(err.code, "DEEPSEEK_UNAVAILABLE");
    assert.equal(err.message, "DeepSeek vaqtincha mavjud emas");
    assert.ok(!JSON.stringify({ m: err.message, s: err.stack }).includes(KEY));

    calls = 0;
    const auth = await deepSeekChat(
      { messages: [] },
      { config: cfg, sleep: async () => {}, fetchImpl: (async () => (calls++, jsonResponse({}, 401))) as typeof fetch }
    ).then(() => assert.fail("expected failure"), (e: unknown) => e as DeepSeekError);
    assert.equal(calls, 1, "auth errors are not retried");
    assert.equal(auth.code, "DEEPSEEK_AUTH_FAILED");
  });

  it("sends the key only in the Authorization header to the configured endpoint", async () => {
    const cfg = readDeepSeekConfig(ENV)!;
    let seen: { url: string; init: RequestInit } | null = null;
    await deepSeekChat(
      { messages: [{ role: "user", content: "x" }], jsonMode: true },
      { config: cfg, fetchImpl: (async (url: string, init: RequestInit) => ((seen = { url, init }), completion("{}"))) as typeof fetch }
    );
    assert.equal(seen!.url, "https://api.deepseek.com/chat/completions");
    assert.equal((seen!.init.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
    assert.ok(!String(seen!.init.body).includes(KEY));
    assert.equal(JSON.parse(String(seen!.init.body)).model, "deepseek-test-model");
  });
});

/* ----------------------------------- tools ----------------------------------- */

describe("server tools — current workspace, canonical debts", () => {
  let data: FakeData;
  beforeEach(() => {
    data = seedTwoWorkspaces();
  });

  it("3. Manager tools read only the current workspace's live data", async () => {
    const { db } = createFakeDb(data);
    const res = await runAgentTools(AI_AGENTS.MANAGER.tools, toolsCtx(db));
    const props = res.data.get_properties_summary as Any;
    assert.deepEqual([props.total, props.occupied, props.vacant], [3, 2, 1]);
    assert.equal((res.data.get_workspace_summary as Any).name, "Alpha Ofis");
    assert.equal((res.data.get_tenants_summary as Any).active, 2);
    assert.equal((res.data.get_tasks_summary as Any).overdueOpen, 1);
    assert.equal(res.dataAsOf, NOW.toISOString());
  });

  it("4–7. Payment debts equal the canonical engine (+ manual), terminated kept, write-off excluded", async () => {
    const { db } = createFakeDb(data);
    const res = await runAgentTools(["get_canonical_debts"], toolsCtx(db));
    const debt = res.data.get_canonical_debts as Any;

    // Independent /debts computation from the same rows through the same client mappers.
    const asJson = (r: unknown) => JSON.parse(JSON.stringify(r));
    const enrich = await (db.contract.findMany as (a: unknown) => Promise<Any[]>)({ where: { workspaceId: "ws-a" } });
    const contracts = enrich.map((c) => {
      const { debtAdjustments, ...rest } = c;
      return MAPPERS.contracts!.fromApi(
        asJson({ ...rest, writtenOffAmount: (debtAdjustments as { amount: number }[]).reduce((s, a) => s + a.amount, 0) })
      ) as Contract;
    });
    const payments = (await (db.payment.findMany as (a: unknown) => Promise<Any[]>)({ where: { workspaceId: "ws-a" } })).map(
      (p) => MAPPERS.payments!.fromApi(asJson(p)) as Payment
    );
    const tenants = data.tenants.filter((t) => t.workspaceId === "ws-a").map((t) => MAPPERS.tenants!.fromApi(asJson(t)) as Tenant);
    const rows = selectCanonicalDebts(contracts, payments, tenants, NOW);
    const expected = summarizeAllDebts(summarizeCanonicalDebts(rows), [
      { id: "md1", status: "PARTIAL", remainingAmount: 200_000 },
    ]);

    assert.equal(debt.totalUnresolvedDebt, expected.totalDebtAmount, "4. total = /debts total");
    assert.equal(debt.debtRecordCount, expected.debtRecordCount);
    assert.ok(debt.contractDebts.total > 0);

    const terminated = debt.contractDebts.largest.find((r: Any) => r.contractStatus === "terminated");
    assert.ok(terminated && terminated.remaining > 0, "5. TERMINATED unresolved debt visible");
    assert.equal(debt.contractDebts.endedContractsWithDebt.count, 1);

    assert.equal(debt.manualDebts.count, 1, "6. only the active manual debt");
    assert.equal(debt.manualDebts.total, 200_000);
    assert.equal(debt.manualDebts.items[0].debtor, "Qo‘lda Qarzdor");
    assert.equal(debt.totalUnresolvedDebt, debt.contractDebts.total + debt.manualDebts.total, "6. no double count");

    assert.ok(!debt.contractDebts.largest.some((r: Any) => r.tenant === "Guli Sobirova"), "7. written-off contract has 0 remaining");
    assert.equal(debt.writeOffs.totalWrittenOff, 50_000_000);
    assert.ok(debt.partialPayments.count >= 1, "September partial payment surfaced");
  });

  it("8. Analyst sees real metrics and says trend data is insufficient when it is", async () => {
    const { db } = createFakeDb(data);
    const res = await runAgentTools(AI_AGENTS.ANALYST.tools, toolsCtx(db));
    const trend = res.data.get_monthly_trend as Any;
    assert.equal(trend.months.length, 6);
    assert.equal(trend.months.find((m: Any) => m.month === "2026-08").income, 1_000_000);
    assert.equal(trend.monthsWithData, 5, "Jun (contract) … Oct (expense)");
    assert.equal(trend.months[0].month, "2026-05");
    assert.equal(trend.enoughHistoryForTrend, true);
    assert.equal((res.data.get_expenses_summary as Any).currentMonthTotal, 150_000);

    const fresh = seedTwoWorkspaces();
    fresh.payments = [];
    fresh.expenses = [];
    fresh.contracts = fresh.contracts.filter((c) => c.workspaceId === "ws-b");
    const sparse = await runAgentTools(["get_monthly_trend"], toolsCtx(createFakeDb(fresh).db));
    assert.equal((sparse.data.get_monthly_trend as Any).enoughHistoryForTrend, false);
  });

  it("9–10. a payment recorded minutes ago is visible on the next run (no stale snapshot)", async () => {
    const { db } = createFakeDb(data);
    const first = await runAgentTools(["get_payment_summary", "get_recent_payments"], toolsCtx(db));
    assert.equal((first.data.get_payment_summary as Any).todayIncome, 0);

    const fiveMinAgo = new Date(NOW.getTime() - 5 * 60_000);
    data.payments.push({
      id: "pay-new", workspaceId: "ws-a", contractId: "c1", amount: 777_000, paymentDate: fiveMinAgo, periodYear: 2026,
      periodMonth: 10, paymentMethod: "CARD", notes: null, createdAt: fiveMinAgo, updatedAt: fiveMinAgo,
    });
    const second = await runAgentTools(["get_payment_summary", "get_recent_payments"], toolsCtx(db));
    assert.equal((second.data.get_payment_summary as Any).todayIncome, 777_000);
    assert.equal((second.data.get_recent_payments as Any).latest[0].amount, 777_000);
    assert.equal((second.data.get_recent_payments as Any).createdLast24h, 1);

    const src = readFileSync(join(__dirname, "tools.ts"), "utf8") + readFileSync(join(__dirname, "run-agent.ts"), "utf8");
    assert.doesNotMatch(src, /buildDailySnapshot|daily-snapshot/, "10. no pre-generated snapshot as source");
  });

  it("11. every tool query is filtered by the server workspace; other workspace data never appears", async () => {
    const { db, wheres } = createFakeDb(data);
    const all = await runAgentTools(Object.keys(AGENT_TOOLS), toolsCtx(db));
    for (const { model, where } of wheres) {
      if (model === "workspace") assert.equal(where.id, "ws-a");
      else assert.equal(where.workspaceId, "ws-a", `${model} query unscoped`);
    }
    const dump = JSON.stringify(all.data);
    for (const leak of ["B-SECRET-ROOM", "Beta Secret Guest", "Beta Manual", "9999999", "7777777", "5555555", "Beta task"]) {
      assert.ok(!dump.includes(leak), `leaked ${leak}`);
    }
  });

  it("13. tools take no model/client input — workspace cannot be chosen; unknown tools rejected", async () => {
    for (const fn of Object.values(AGENT_TOOLS)) assert.equal(fn.length, 1, "only the server context");
    const { db } = createFakeDb(data);
    await assert.rejects(runAgentTools(["get_canonical_debts", "run_sql"], toolsCtx(db)), /Unknown agent tool/);
  });
});

/* ------------------------------ grounding / prompt ----------------------------- */

describe("grounding", () => {
  it("14. invented numbers are dropped; supplied numbers are kept", () => {
    const context = { tools: { get_canonical_debts: { totalUnresolvedDebt: 12830, debtRecordCount: 4 } } };
    const { analysis, dropped } = enforceGrounding(
      {
        summary: "Jami qarz 12 830 UZS. Daromad 99 999 999 ga yetdi.",
        attention: ["4 ta qarzdor yozuv bor", "57 ta xona bo‘sh"],
        recommendations: ["Qarzdorlarga eslatma yuboring"],
        dataGaps: [],
      },
      context
    );
    assert.equal(analysis.summary, "Jami qarz 12 830 UZS.");
    assert.deepEqual(analysis.attention, ["4 ta qarzdor yozuv bor"]);
    assert.equal(dropped, 2);
  });

  it("prompt is read-only, grounded and carries only the supplied workspace context", () => {
    const [system, user] = buildAgentMessages("PAYMENT", { tools: { get_workspace_summary: { name: "Alpha Ofis" } } });
    for (const rule of ["Sonlarni o‘ylab topma", "READ-ONLY", "Boshqa workspace", "Ma’lumot yetarli emas"]) {
      assert.ok(system.content.includes(rule), rule);
    }
    assert.ok(user.content.includes("Alpha Ofis"));
    assert.ok(!/DATABASE_URL|postgres|prisma/i.test(system.content + user.content));
  });

  it("rejects non-JSON model output", () => {
    assert.equal(parseAgentAnalysis("Hammasi yaxshi"), null);
    assert.equal(parseAgentAnalysis(JSON.stringify({ attention: [] })), null);
    assert.equal(parseAgentAnalysis(JSON.stringify(GOOD_ANALYSIS))?.summary, "Holat barqaror.");
  });
});

/* --------------------------- run lifecycle (mocked DB) -------------------------- */

const restores: (() => void)[] = [];
function mock(target: object, name: string, impl: unknown) {
  const original = Reflect.get(target, name);
  Reflect.set(target, name, impl);
  restores.push(() => Reflect.set(target, name, original));
}

type RunRow = Record<string, unknown> & { id: string };
let runs: RunRow[] = [];
let audits: Record<string, unknown>[] = [];
let activity: Record<string, unknown>[] = [];
const savedEnv = { key: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL };

describe("agent runs", () => {
  before(() => {
    process.env.DEEPSEEK_API_KEY = KEY;
    process.env.DEEPSEEK_MODEL = "deepseek-test-model";
    mock(prisma.agentRun, "findUnique", async ({ where }: { where: { idempotencyKey?: string } }) =>
      runs.find((r) => where.idempotencyKey && r.idempotencyKey === where.idempotencyKey) ?? null
    );
    mock(prisma.agentRun, "create", async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `run-${runs.length + 1}`, createdAt: new Date(), ...data };
      runs.push(row);
      return row;
    });
    mock(prisma.agentRun, "update", async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = runs.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    });
    mock(prisma.agentActionAudit, "findUnique", async () => null);
    mock(prisma.agentActionAudit, "create", async ({ data }: { data: Record<string, unknown> }) => {
      audits.push(data);
      return { id: `audit-${audits.length}`, ...data };
    });
    mock(prisma.workspaceActivityEvent, "createMany", async ({ data }: { data: Record<string, unknown>[] }) => {
      activity.push(...data);
      return { count: data.length };
    });
  });
  after(() => {
    restores.reverse().forEach((r) => r());
    if (savedEnv.key === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedEnv.key;
    if (savedEnv.model === undefined) delete process.env.DEEPSEEK_MODEL;
    else process.env.DEEPSEEK_MODEL = savedEnv.model;
  });
  beforeEach(() => {
    runs = [];
    audits = [];
    activity = [];
  });

  const okChat = (async () => ({
    content: JSON.stringify(GOOD_ANALYSIS),
    model: "deepseek-test-model",
    responseId: "resp-1",
    usage: { inputTokens: 900, outputTokens: 200 },
    attempts: 1,
  })) as unknown as typeof deepSeekChat;
  const deps = (chat = okChat) => ({ db: createFakeDb(seedTwoWorkspaces()).db as unknown as ToolDb, chat, now: () => NOW });
  const base = { workspaceId: "ws-a", loadUsageAnalytics: async () => ({}) };

  it("19. successful real run: COMPLETED, workspace-scoped, real tokens, AI activity recorded", async () => {
    const out = await runAiAgent({ ...base, agent: "PAYMENT", trigger: "MANUAL", dryRun: false, userId: "u1" }, deps());
    assert.ok(out.ok);
    const run = runs[0];
    assert.equal(run.workspaceId, "ws-a");
    assert.equal(run.status, "COMPLETED");
    assert.equal(run.modelProvider, "deepseek");
    assert.deepEqual([run.inputTokens, run.outputTokens], [900, 200]);
    assert.ok(out.report.includes("Moliyaviy holat"));
    assert.ok(out.report.includes("Ma’lumot vaqti: 07.10.2026 12:00"));
    assert.deepEqual(activity.map((a) => [a.workspaceId, a.actionType, a.actorType]), [["ws-a", "AI_FINANCE_ANALYSIS", "AI"]]);
    assert.ok(audits.every((a) => a.workspaceId === "ws-a"));
    assert.ok(!JSON.stringify(runs).includes(KEY));
  });

  it("20. dry-run and test runs do not inflate AI analytics", async () => {
    await runAiAgent({ ...base, agent: "MANAGER", trigger: "MANUAL", dryRun: true }, deps());
    await runAiAgent({ ...base, agent: "ANALYST", trigger: "TEST", dryRun: false }, deps());
    assert.equal(runs.filter((r) => r.status === "COMPLETED").length, 2);
    assert.equal(activity.length, 0);
    assert.equal(countsAsAiWork("SCHEDULE", false), true);
    assert.equal(countsAsAiWork("MANUAL", true), false);
  });

  it("15. DeepSeek failure → run FAILED with code, no report, no activity", async () => {
    const down = (async () => {
      throw new DeepSeekError("DEEPSEEK_UNAVAILABLE", "DeepSeek vaqtincha mavjud emas", 503);
    }) as unknown as typeof deepSeekChat;
    const out = await runAiAgent({ ...base, agent: "MANAGER", trigger: "MANUAL", dryRun: false }, deps(down));
    assert.equal(out.ok, false);
    assert.equal(runs[0].status, "FAILED");
    assert.equal(runs[0].errorCode, "DEEPSEEK_UNAVAILABLE");
    assert.equal((runs[0].metadata as Record<string, unknown>).report, undefined);
    assert.equal(activity.length, 0);

    const garbage = (async () => ({ content: "not json", model: "m", responseId: null, usage: null, attempts: 1 })) as unknown as typeof deepSeekChat;
    const bad = await runAiAgent({ ...base, agent: "MANAGER", trigger: "MANUAL", dryRun: false }, deps(garbage));
    assert.equal(bad.ok, false);
    assert.equal(runs[1].errorCode, "DEEPSEEK_BAD_RESPONSE");
  });

  it("missing key → no run, no request", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    let called = false;
    const spy = (async () => ((called = true), {})) as unknown as typeof deepSeekChat;
    const out = await runAiAgent({ ...base, agent: "MANAGER", trigger: "MANUAL", dryRun: false }, deps(spy));
    process.env.DEEPSEEK_API_KEY = KEY;
    assert.equal(out.ok, false);
    assert.equal(!out.ok && out.errorCode, "DEEPSEEK_NOT_CONFIGURED");
    assert.equal(runs.length, 0);
    assert.equal(called, false);
  });

  const allOn = { managerEnabled: true, paymentEnabled: true, analystEnabled: true, telegramReportsEnabled: true };

  it("16. dry-run daily report sends no Telegram", async () => {
    let sends = 0;
    const out = await runDailyReport(
      { ...base, trigger: "MANUAL", dryRun: true, settings: allOn },
      { ...deps(), send: async () => (sends++, true), recipients: async () => ["chat-a"] }
    );
    assert.equal(out.status, "completed");
    assert.equal(out.status === "completed" && out.delivery?.status, "dry_run");
    assert.equal(sends, 0);
    assert.equal(out.status === "completed" && out.agents.length, 3);
  });

  it("17–18. real scheduled report is sent only to the workspace's own admin chats", async () => {
    const sentTo: string[] = [];
    let askedFor = "";
    const out = await runDailyReport(
      { ...base, trigger: "SCHEDULE", dryRun: false, settings: allOn },
      {
        ...deps(),
        send: async (chatId: string | number) => (sentTo.push(String(chatId)), true),
        recipients: async (ws: string) => ((askedFor = ws), ["chat-a"]),
      }
    );
    assert.equal(askedFor, "ws-a");
    assert.ok(sentTo.length >= 1 && sentTo.every((c) => c === "chat-a"));
    assert.equal(out.status === "completed" && out.delivery?.status, "sent");
    assert.ok(activity.some((a) => a.actionType === "SCHEDULED_REPORT_SENT" && a.workspaceId === "ws-a"));
    assert.equal(activity.filter((a) => a.actorType === "AI").length, 3, "3 real agent runs counted");

    const again = await runDailyReport(
      { ...base, trigger: "SCHEDULE", dryRun: false, settings: allOn },
      { ...deps(), send: async () => true, recipients: async () => ["chat-a"] }
    );
    assert.equal(again.status, "already_processed", "idempotent per workspace per day");
  });

  it("18. Telegram recipient lookup is filtered by workspace membership", () => {
    const src = readFileSync(join(__dirname, "../telegram-admin.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function workspaceAdminTelegramChats"));
    assert.match(fn, /workspaceMemberships: \{ some: \{ workspaceId \} \}/);
    assert.match(fn, /=== workspaceId/);
  });
});

/* --------------------------------- Hermes / UI --------------------------------- */

describe("Hermes removed from AI Employees", () => {
  const root = join(__dirname, "../../../..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  it("22. execution path never invokes Hermes or the agent gateway", () => {
    for (const file of [
      "src/lib/api-server/ai-agents/run-agent.ts",
      "src/lib/api-server/ai-agents/tools.ts",
      "src/lib/api-server/ai-agents/agents.ts",
      "src/lib/api-server/ai-agents/deepseek.ts",
      "src/app/api/ai-employees/route.ts",
      "src/app/api/ai-employees/trigger/route.ts",
      "src/app/api/cron/ai-employees-daily/route.ts",
    ]) {
      const src = read(file);
      assert.doesNotMatch(src, /hermes/i, file);
      assert.doesNotMatch(src, /isGatewayConfigured|deliverDailyManagerTelegram|daily-snapshot/, file);
    }
  });

  it("23. UI says DeepSeek, not Hermes", () => {
    const page = read("src/app/(dashboard)/ai-employees/page.tsx");
    assert.ok(page.includes("DeepSeek AI Agents — Manager, Payment, Analyst"));
    assert.ok(page.includes("DeepSeek ulanmagan"));
    for (const label of ["{a.label}ni ishga tushirish", "Bugungi hisobotni ishga tushirish", "Read-only", "Ma’lumot vaqti", "Ulanmagan"]) {
      assert.ok(page.includes(label), label);
    }
    assert.deepEqual(Object.values(AI_AGENTS).map((a) => a.label), ["Manager", "Payment", "Analyst"]);
    assert.doesNotMatch(page, /Hermes|Gateway|alohida runtime/);
  });
});
