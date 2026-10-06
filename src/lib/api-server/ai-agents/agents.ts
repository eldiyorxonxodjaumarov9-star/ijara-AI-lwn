import type { ActivityAction } from "@/lib/usage-analytics";
import { formatCurrency } from "@/lib/utils";

import type { ChatMessage } from "./deepseek";
import type { AgentToolName } from "./tools";

export const AI_AGENT_KINDS = ["MANAGER", "PAYMENT", "ANALYST"] as const;
export type AiAgentKind = (typeof AI_AGENT_KINDS)[number];

export function isAiAgentKind(value: unknown): value is AiAgentKind {
  return typeof value === "string" && (AI_AGENT_KINDS as readonly string[]).includes(value);
}

type AgentDef = {
  label: string;
  role: string;
  focus: string;
  tools: readonly AgentToolName[];
  /** Counted as AI work only for successful non-test, non-dry-run runs. */
  activity: ActivityAction;
  settingKey: "managerEnabled" | "paymentEnabled" | "analystEnabled";
};

export const AI_AGENTS: Record<AiAgentKind, AgentDef> = {
  MANAGER: {
    label: "Manager",
    role: "Manager Agent — workspace bo‘yicha umumiy boshqaruv holatini tahlil qiluvchi",
    focus:
      "Umumiy holat: xonalar bandligi, ijarachilar, shartnomalar, to‘lovlar, qarzlar, xarajatlar, vazifalar va platformadan foydalanish. Eng muhim 3–5 ta e’tibor talab qiladigan joyni ko‘rsat.",
    tools: [
      "get_workspace_summary",
      "get_properties_summary",
      "get_tenants_summary",
      "get_contracts_summary",
      "get_canonical_debts",
      "get_payment_summary",
      "get_expenses_summary",
      "get_bookings_summary",
      "get_vehicle_rentals_summary",
      "get_tasks_summary",
      "get_usage_analytics",
    ],
    activity: "AI_EMPLOYEE_ACTION",
    settingKey: "managerEnabled",
  },
  PAYMENT: {
    label: "Payment",
    role: "Payment Agent — faqat moliyaviy holatni chuqur tahlil qiluvchi",
    focus:
      "Tushum (bugun, joriy oy), kutilgan va real tushum, qarzdorlik (shartnoma va qo‘lda qo‘shilgan qarzlar alohida), eng katta va eng eski qarzlar, qisman to‘lovlar, hisobdan chiqarilgan summalar va xarajatlar. 'Nimalarga e’tibor berish kerak' degan qisqa tahlil ber.",
    tools: [
      "get_workspace_summary",
      "get_canonical_debts",
      "get_payment_summary",
      "get_recent_payments",
      "get_expenses_summary",
      "get_bookings_summary",
      "get_vehicle_rentals_summary",
    ],
    activity: "AI_FINANCE_ANALYSIS",
    settingKey: "paymentEnabled",
  },
  ANALYST: {
    label: "Analyst",
    role: "Analyst Agent — trend va ko‘rsatkichlar bo‘yicha tahlilchi",
    focus:
      "Bandlik, daromad, xarajat, qarz, to‘lov yig‘ilishi, bron/ijara faolligi, platformadan foydalanish va Odam / AI / Avtomatika ulushi bo‘yicha trend va xulosa. get_monthly_trend.enoughHistoryForTrend false bo‘lsa trend haqida xulosa qilma — 'Ma’lumot yetarli emas' de.",
    tools: [
      "get_workspace_summary",
      "get_properties_summary",
      "get_payment_summary",
      "get_expenses_summary",
      "get_canonical_debts",
      "get_bookings_summary",
      "get_vehicle_rentals_summary",
      "get_usage_analytics",
      "get_monthly_trend",
    ],
    activity: "AI_RECOMMENDATION",
    settingKey: "analystEnabled",
  },
};

export type AgentAnalysis = {
  summary: string;
  attention: string[];
  recommendations: string[];
  dataGaps: string[];
};

export function buildAgentMessages(agent: AiAgentKind, context: unknown): ChatMessage[] {
  const def = AI_AGENTS[agent];
  const system = [
    `Sen Ijara AI platformasidagi ${def.role}.`,
    `Vazifa: ${def.focus}`,
    "",
    "QAT’IY QOIDALAR:",
    "1. Faqat foydalanuvchi xabaridagi JSON tool ma’lumotlaridan fakt ayt. Boshqa manba yo‘q.",
    "2. Sonlarni o‘ylab topma va yangi son hisoblab chiqarma: faqat JSON’da bor sonlarni aynan keltir.",
    "3. Ma’lumot yo‘q yoki yetarli bo‘lmasa, buni dataGaps’ga yoz va 'Ma’lumot yetarli emas' de. Trend uydirma.",
    "4. Faqat shu bitta workspace haqida gapir. Boshqa workspace yoki kompaniyalar haqida gapirma.",
    "5. Sen READ-ONLY agentsan: hech narsani o‘zgartirmaysan va bajarmaysan. Harakat taklif qilishing mumkin, lekin 'bajarildi' dema.",
    "6. Pul summalari UZS da. Javob o‘zbek tilida (lotin yozuvi), qisqa va aniq.",
    "7. Faqat JSON qaytar, boshqa matn yo‘q:",
    '{"summary": "2-3 gap", "attention": ["e’tibor talab qiladigan joy", "..."], "recommendations": ["tavsiya", "..."], "dataGaps": ["yetishmayotgan ma’lumot", "..."]}',
    "attention va recommendations — har biri ko‘pi bilan 5 ta qisqa band.",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(context) },
  ];
}

const MAX_ITEMS = 5;
const MAX_TEXT = 600;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, MAX_TEXT) : null;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter((v): v is string => v !== null).slice(0, MAX_ITEMS);
}

/** Null when the model did not return the required JSON shape. */
export function parseAgentAnalysis(content: string): AgentAnalysis | null {
  let raw: unknown;
  try {
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const summary = cleanText(o.summary);
  if (!summary) return null;
  return {
    summary,
    attention: cleanList(o.attention),
    recommendations: cleanList(o.recommendations),
    dataGaps: cleanList(o.dataGaps),
  };
}

const NUMBER_RE = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;

export function extractNumbers(text: string): number[] {
  return (text.match(NUMBER_RE) ?? [])
    .map((m) => Number(m.replace(/[ \u00a0\u202f]/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n));
}

/** Every number present in the tool context (values and digits inside strings such as dates). */
export function groundedNumberSet(context: unknown): Set<number> {
  const set = new Set<number>([0, 1]);
  const add = (n: number) => {
    set.add(n);
    set.add(Math.round(n));
    set.add(Math.round(n * 10) / 10);
  };
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) add(v);
    else if (typeof v === "string") extractNumbers(v).forEach(add);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(context);
  return set;
}

function isGrounded(text: string, grounded: Set<number>) {
  return extractNumbers(text).every((n) => grounded.has(n) || grounded.has(Math.round(n)));
}

/**
 * Drops any sentence/bullet quoting a number absent from the tool data, so an
 * invented figure never reaches the report.
 */
export function enforceGrounding(analysis: AgentAnalysis, context: unknown) {
  const grounded = groundedNumberSet(context);
  let dropped = 0;
  const keep = (items: string[]) =>
    items.filter((item) => {
      const ok = isGrounded(item, grounded);
      if (!ok) dropped += 1;
      return ok;
    });
  const sentences = analysis.summary.split(/(?<=[.!?])\s+/);
  const summary = keep(sentences).join(" ").trim();
  return {
    analysis: {
      summary: summary || "Tahlil xulosasida ma’lumot bilan tasdiqlanmagan son bor edi — olib tashlandi.",
      attention: keep(analysis.attention),
      recommendations: keep(analysis.recommendations),
      dataGaps: keep(analysis.dataGaps),
    },
    dropped,
  };
}

/* ------------------------------ report text ------------------------------ */

type Data = Partial<Record<AgentToolName, unknown>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool payloads are rendered defensively
type Any = any;

const money = (n: unknown) => formatCurrency(Number(n) || 0);

export function formatDataAsOf(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

function managerFacts(d: Data): string[] {
  const p = d.get_properties_summary as Any;
  const t = d.get_tenants_summary as Any;
  const c = d.get_contracts_summary as Any;
  const debt = d.get_canonical_debts as Any;
  const pay = d.get_payment_summary as Any;
  const exp = d.get_expenses_summary as Any;
  const tasks = d.get_tasks_summary as Any;
  const bk = d.get_bookings_summary as Any;
  const veh = d.get_vehicle_rentals_summary as Any;
  const lines = ["📊 Bugungi holat"];
  if (p) lines.push(`• ${p.total} ta xona: ${p.occupied} band, ${p.vacant} bo‘sh (bandlik ${p.occupancyRatePercent}%)`);
  if (t) lines.push(`• Faol ijarachilar: ${t.active} ta`);
  if (c) {
    lines.push(
      `• Faol shartnomalar: ${c.byStatus?.ACTIVE ?? 0} ta, 30 kun ichida tugaydi: ${c.expiringWithin30Days?.length ?? 0} ta`
    );
  }
  if (debt) lines.push(`• Qarzdor yozuvlar: ${debt.debtRecordCount} ta, jami qarz ${money(debt.totalUnresolvedDebt)}`);
  if (pay) lines.push(`• Bugungi tushum: ${money(pay.todayIncome)}, joriy oy: ${money(pay.currentMonthIncome)}`);
  if (exp) lines.push(`• Joriy oy xarajatlari: ${money(exp.currentMonthTotal)}`);
  if (tasks) lines.push(`• Ochiq vazifalar: ${tasks.open} ta (muddati o‘tgan: ${tasks.overdueOpen})`);
  if (bk && bk.total > 0) {
    lines.push(`• Bronlar: joriy oy ${bk.currentMonthBookings} ta, 7 kunda keladi ${bk.arrivalsNext7Days} ta`);
  }
  const vehicles = veh ? Object.values(veh.vehiclesByStatus ?? {}).reduce((s: number, n) => s + Number(n), 0) : 0;
  if (veh && vehicles > 0) lines.push(`• Avto ijaralar: joriy oy ${veh.currentMonthRentals} ta, ${money(veh.currentMonthRevenue)}`);
  return lines;
}

function paymentFacts(d: Data): string[] {
  const debt = d.get_canonical_debts as Any;
  const pay = d.get_payment_summary as Any;
  const exp = d.get_expenses_summary as Any;
  const lines = ["💰 Moliyaviy holat"];
  if (pay) {
    lines.push(`• Bugungi tushum: ${money(pay.todayIncome)} (${pay.todayPaymentCount} ta to‘lov)`);
    lines.push(`• Joriy oy real tushum: ${money(pay.currentMonthIncome)}`);
    lines.push(`• Kutilgan oylik ijara (faol shartnomalar): ${money(pay.expectedMonthlyRentFromActiveContracts)}`);
    if (pay.currentMonthCollectionPercent !== null) lines.push(`• Yig‘ilish: ${pay.currentMonthCollectionPercent}%`);
  }
  if (debt) {
    const cd = debt.contractDebts;
    lines.push(`• Jami hal qilinmagan qarz: ${money(debt.totalUnresolvedDebt)} (${debt.debtRecordCount} ta yozuv)`);
    lines.push(
      `• Shartnoma qarzlari: ${money(cd.remaining)} — ${cd.debtorContractCount} ta shartnoma, ${cd.unpaidMonths} ta qarzdor oy`
    );
    lines.push(`  kutilgan ${money(cd.expected)}, to‘langan ${money(cd.paid)}, hisobdan chiqarilgan ${money(cd.writtenOff)}`);
    lines.push(`• Qo‘lda qo‘shilgan qarzlar: ${debt.manualDebts.count} ta, ${money(debt.manualDebts.total)}`);
    if (cd.endedContractsWithDebt.count > 0) {
      lines.push(
        `• Tugagan/bekor qilingan shartnomalardagi qarz: ${cd.endedContractsWithDebt.count} ta, ${money(cd.endedContractsWithDebt.total)}`
      );
    }
    if (cd.oldestDebt) {
      lines.push(
        `• Eng eski qarz: ${cd.oldestDebt.tenant} (${cd.oldestDebt.property}) — ${cd.oldestDebt.oldestUnpaidDueDate}, ${cd.oldestDebt.overdueDays} kun`
      );
    }
    for (const r of (cd.largest ?? []).slice(0, 5)) {
      lines.push(`  – ${r.tenant} (${r.property}): ${money(r.remaining)}, ${r.unpaidMonths} oy, ${r.overdueDays} kun`);
    }
    lines.push(`• Qisman to‘lovlar: ${debt.partialPayments.count} ta`);
    lines.push(`• Hisobdan chiqarilgan (write-off): ${money(debt.writeOffs.totalWrittenOff)}`);
  }
  if (exp) lines.push(`• Joriy oy xarajatlari: ${money(exp.currentMonthTotal)} (o‘tgan oy ${money(exp.previousMonthTotal)})`);
  return lines;
}

function analystFacts(d: Data): string[] {
  const p = d.get_properties_summary as Any;
  const pay = d.get_payment_summary as Any;
  const exp = d.get_expenses_summary as Any;
  const debt = d.get_canonical_debts as Any;
  const usage = d.get_usage_analytics as Any;
  const trend = d.get_monthly_trend as Any;
  const lines = ["📈 Ko‘rsatkichlar"];
  if (p) lines.push(`• Bandlik: ${p.occupancyRatePercent}% (${p.occupied}/${p.total})`);
  if (pay) lines.push(`• Tushum: joriy oy ${money(pay.currentMonthIncome)}, o‘tgan oy ${money(pay.previousMonthIncome)}`);
  if (exp) lines.push(`• Xarajat: joriy oy ${money(exp.currentMonthTotal)}, o‘tgan oy ${money(exp.previousMonthTotal)}`);
  if (debt) lines.push(`• Qarz: ${money(debt.totalUnresolvedDebt)}`);
  if (pay && pay.currentMonthCollectionPercent !== null) lines.push(`• To‘lov yig‘ilishi: ${pay.currentMonthCollectionPercent}%`);
  if (usage?.platformUsage) {
    lines.push(
      `• Platformadan foydalanish: ${usage.platformUsage.percentage}% (${usage.platformUsage.usedFeatures}/${usage.platformUsage.eligibleFeatures})`
    );
    const ws = usage.workShare;
    if (ws && ws.total > 0) {
      lines.push(
        `• Bajarilgan ishlar (${usage.periodDays} kun): Odam ${ws.human.percentage}%, AI ${ws.ai.percentage}%, Avtomatika ${ws.automation.percentage}%`
      );
    }
  }
  if (trend) {
    lines.push(
      trend.enoughHistoryForTrend
        ? `• Trend: oxirgi ${trend.months.length} oydan ${trend.monthsWithData} tasida ma’lumot bor`
        : `• Trend: Ma’lumot yetarli emas (${trend.monthsWithData} oy ma’lumot)`
    );
  }
  return lines;
}

const FACTS: Record<AiAgentKind, (d: Data) => string[]> = {
  MANAGER: managerFacts,
  PAYMENT: paymentFacts,
  ANALYST: analystFacts,
};

export function renderAgentReport(input: {
  agent: AiAgentKind;
  data: Data;
  analysis: AgentAnalysis;
  dataAsOf: string;
}): string {
  const a = input.analysis;
  const lines = [`🤖 ${AI_AGENTS[input.agent].label} Agent`, ...FACTS[input.agent](input.data), "", "🧠 Tahlil", a.summary];
  if (a.attention.length > 0) lines.push("", "⚠️ E’tibor talab qiladigan joylar", ...a.attention.map((x) => `• ${x}`));
  if (a.recommendations.length > 0) lines.push("", "💡 Tavsiyalar", ...a.recommendations.map((x) => `• ${x}`));
  if (a.dataGaps.length > 0) lines.push("", "ℹ️ Ma’lumot yetarli emas", ...a.dataGaps.map((x) => `• ${x}`));
  lines.push("", `Ma’lumot vaqti: ${formatDataAsOf(input.dataAsOf)}`);
  return lines.join("\n");
}
