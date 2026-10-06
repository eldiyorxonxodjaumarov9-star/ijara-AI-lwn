import { MAPPERS } from "@/lib/api/mappers";
import { WRITE_OFF_AMOUNTS, withWrittenOff } from "@/lib/api-server/debt-adjustments";
import type { prisma } from "@/lib/api-server/prisma";
import { EXPENSE_CATEGORY_MAP, MONTHLY_EXPENSE_TYPE_MAP } from "@/lib/constants";
import { selectCanonicalDebts, summarizeCanonicalDebts } from "@/lib/debts/canonical-debts";
import { isActiveManualDebt, summarizeAllDebts } from "@/lib/manual-debts";
import { tashkentMonthBounds, type YearMonth } from "@/lib/monthly-comparison";
import { occupancyRate } from "@/lib/occupancy";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import type { Contract, Payment, Tenant } from "@/types";

export type ToolDb = typeof prisma;

/**
 * Server execution context. The workspace comes from the authenticated session
 * (or the cron's own workspace loop) — tools take no model-supplied arguments.
 */
export type ToolContext = {
  db: ToolDb;
  workspaceId: string;
  now: Date;
  loadUsageAnalytics: () => Promise<unknown>;
  /** Per-run memo so several tools share one fresh DB read. Never reused across runs. */
  memo: Map<string, Promise<unknown>>;
};

function memo<T>(ctx: ToolContext, key: string, load: () => Promise<T>): Promise<T> {
  const hit = ctx.memo.get(key);
  if (hit) return hit as Promise<T>;
  const next = load();
  ctx.memo.set(key, next);
  return next;
}

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => round(xs.reduce((s, x) => s + x, 0));
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function ymKey(ym: YearMonth) {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

function monthRange(ym: YearMonth) {
  const b = tashkentMonthBounds(ym);
  return { gte: new Date(b.startInclusive), lt: new Date(b.endExclusive) };
}

function tashkentToday(now: Date) {
  const p = getTashkentDateParts(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${p.year}-${pad(p.month)}-${pad(p.day)}T00:00:00+05:00`);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    range: { gte: start, lt: new Date(start.getTime() + 86_400_000) },
    month: { year: p.year, month: p.month } as YearMonth,
  };
}

function countBy<T extends string>(rows: { key: T; n: number }[]) {
  return Object.fromEntries(rows.map((r) => [r.key, r.n])) as Record<T, number>;
}

/** Same rows and client mappers the /debts page uses, so totals match it exactly. */
async function loadLedger(ctx: ToolContext) {
  return memo(ctx, "ledger", async () => {
    const where = { workspaceId: ctx.workspaceId };
    const [contractRows, paymentRows, tenantRows] = await Promise.all([
      ctx.db.contract.findMany({
        where,
        include: { property: true, tenant: true, debtAdjustments: WRITE_OFF_AMOUNTS },
      }),
      ctx.db.payment.findMany({
        where,
        include: { contract: { include: { property: true, tenant: true } } },
      }),
      ctx.db.tenant.findMany({ where }),
    ]);
    // The client mappers expect the API's JSON (ISO date strings), exactly as /debts receives it.
    const asJson = (row: unknown) => JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
    const contracts = contractRows.map((row) => MAPPERS.contracts!.fromApi(asJson(withWrittenOff(row))) as Contract);
    const payments = paymentRows.map((row) => MAPPERS.payments!.fromApi(asJson(row)) as Payment);
    const tenants = tenantRows.map((row) => MAPPERS.tenants!.fromApi(asJson(row)) as Tenant);
    return { contracts, payments, paymentRows, tenants };
  });
}

async function getWorkspaceSummary(ctx: ToolContext) {
  const where = { workspaceId: ctx.workspaceId };
  const [workspace, properties, tenants, contracts, bookings, vehicles, employees] = await Promise.all([
    ctx.db.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { name: true, industry: true, createdAt: true, isInternal: true },
    }),
    ctx.db.property.count({ where }),
    ctx.db.tenant.count({ where }),
    ctx.db.contract.count({ where }),
    ctx.db.booking.count({ where }),
    ctx.db.vehicle.count({ where }),
    ctx.db.employee.count({ where }),
  ]);
  return {
    name: workspace?.name ?? null,
    industry: workspace?.industry ?? null,
    usingPlatformSince: iso(workspace?.createdAt),
    daysOnPlatform: workspace
      ? Math.max(0, Math.floor((ctx.now.getTime() - workspace.createdAt.getTime()) / 86_400_000))
      : null,
    counts: { properties, tenants, contracts, bookings, vehicles, employees },
  };
}

async function getPropertiesSummary(ctx: ToolContext) {
  const groups = await ctx.db.property.groupBy({
    by: ["status"],
    where: { workspaceId: ctx.workspaceId },
    _count: { _all: true },
  });
  const byStatus = countBy(groups.map((g) => ({ key: g.status, n: g._count._all })));
  const total = groups.reduce((s, g) => s + g._count._all, 0);
  const occupied = byStatus.RENTED ?? 0;
  return {
    total,
    occupied,
    vacant: byStatus.AVAILABLE ?? 0,
    maintenance: byStatus.MAINTENANCE ?? 0,
    reserved: byStatus.RESERVED ?? 0,
    occupancyRatePercent: occupancyRate({ totalRooms: total, occupiedRooms: occupied }),
  };
}

async function getTenantsSummary(ctx: ToolContext) {
  const where = { workspaceId: ctx.workspaceId };
  const month = monthRange(tashkentToday(ctx.now).month);
  const [total, active, newThisMonth] = await Promise.all([
    ctx.db.tenant.count({ where }),
    ctx.db.tenant.count({ where: { ...where, leftAt: null } }),
    ctx.db.tenant.count({ where: { ...where, createdAt: month } }),
  ]);
  return { total, active, left: total - active, newThisMonth };
}

async function getContractsSummary(ctx: ToolContext) {
  const where = { workspaceId: ctx.workspaceId };
  const in30 = new Date(ctx.now.getTime() + 30 * 86_400_000);
  const [groups, expiring] = await Promise.all([
    ctx.db.contract.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ctx.db.contract.findMany({
      where: { ...where, status: "ACTIVE", endDate: { gte: ctx.now, lte: in30 } },
      select: { endDate: true, monthlyRent: true, property: { select: { title: true } }, tenant: { select: { fullName: true } } },
      orderBy: { endDate: "asc" },
      take: 10,
    }),
  ]);
  return {
    byStatus: countBy(groups.map((g) => ({ key: g.status, n: g._count._all }))),
    expiringWithin30Days: expiring.map((c) => ({
      tenant: c.tenant.fullName,
      property: c.property.title,
      endDate: iso(c.endDate),
      monthlyRent: c.monthlyRent,
    })),
  };
}

async function getCanonicalDebts(ctx: ToolContext) {
  const { contracts, payments, tenants } = await loadLedger(ctx);
  const rows = selectCanonicalDebts(contracts, payments, tenants, ctx.now);
  const contractSummary = summarizeCanonicalDebts(rows);
  const manualRows = await ctx.db.manualDebt.findMany({
    where: { workspaceId: ctx.workspaceId, status: { in: ["OPEN", "PARTIAL"] }, remainingAmount: { gt: 0 } },
    select: {
      id: true,
      debtorName: true,
      originalAmount: true,
      paidAmount: true,
      remainingAmount: true,
      debtDate: true,
      status: true,
      property: { select: { title: true } },
    },
    orderBy: { remainingAmount: "desc" },
  });
  const manual = manualRows.filter((m) => isActiveManualDebt(m));
  const all = summarizeAllDebts(contractSummary, manual);

  const oldest = rows
    .filter((r) => r.oldestUnpaidDueDate)
    .sort((a, b) => String(a.oldestUnpaidDueDate).localeCompare(String(b.oldestUnpaidDueDate)))[0];
  const ended = rows.filter((r) => r.contractStatus === "terminated" || r.contractStatus === "expired");
  const partial = rows.flatMap((r) =>
    r.unpaidPeriods
      .filter((p) => p.paid > 0 && p.remaining > 0)
      .map((p) => ({
        tenant: r.tenantName,
        property: r.propertyName,
        period: `${p.year}-${String(p.month).padStart(2, "0")}`,
        expected: p.expected,
        paid: p.paid,
        remaining: p.remaining,
      }))
  );

  return {
    currency: "UZS",
    source: "canonical debt engine (selectCanonicalDebts) + active manual debts",
    totalUnresolvedDebt: all.totalDebtAmount,
    debtRecordCount: all.debtRecordCount,
    contractDebts: {
      total: contractSummary.totalDebtAmount,
      debtorContractCount: contractSummary.debtorContractCount,
      uniqueDebtorCount: contractSummary.uniqueDebtorCount,
      expected: sum(rows.map((r) => r.expected)),
      paid: sum(rows.map((r) => r.paid)),
      writtenOff: sum(rows.map((r) => r.writtenOff)),
      remaining: contractSummary.totalDebtAmount,
      unpaidMonths: rows.reduce((s, r) => s + r.unpaidMonths, 0),
      oldestDebt: oldest
        ? {
            tenant: oldest.tenantName,
            property: oldest.propertyName,
            oldestUnpaidDueDate: oldest.oldestUnpaidDueDate,
            overdueDays: oldest.overdueDays,
            remaining: oldest.debt,
          }
        : null,
      endedContractsWithDebt: { count: ended.length, total: sum(ended.map((r) => r.debt)) },
      largest: rows.slice(0, 15).map((r) => ({
        tenant: r.tenantName,
        property: r.propertyName,
        contractStatus: r.contractStatus,
        expected: r.expected,
        paid: r.paid,
        writtenOff: r.writtenOff,
        remaining: r.debt,
        unpaidMonths: r.unpaidMonths,
        unpaidPeriods: r.unpaidPeriods.map((p) => `${p.year}-${String(p.month).padStart(2, "0")}`),
        overdueDays: r.overdueDays,
        oldestUnpaidDueDate: r.oldestUnpaidDueDate,
      })),
    },
    manualDebts: {
      count: all.manualDebtCount,
      total: all.manualDebtAmount,
      items: manual.slice(0, 10).map((m) => ({
        debtor: m.debtorName,
        property: m.property?.title ?? null,
        original: m.originalAmount,
        paid: m.paidAmount,
        remaining: m.remainingAmount,
        debtDate: iso(m.debtDate),
        status: m.status,
      })),
    },
    writeOffs: {
      contractsWithWriteOff: contracts.filter((c) => (c.writtenOffAmount ?? 0) > 0).length,
      totalWrittenOff: sum(contracts.map((c) => c.writtenOffAmount ?? 0)),
    },
    partialPayments: { count: partial.length, items: partial.slice(0, 10) },
  };
}

async function getPaymentSummary(ctx: ToolContext) {
  const { contracts, paymentRows } = await loadLedger(ctx);
  const today = tashkentToday(ctx.now);
  const cur = monthRange(today.month);
  const prev = monthRange(shiftMonth(today.month, -1));
  const inRange = (d: Date, r: { gte: Date; lt: Date }) => d >= r.gte && d < r.lt;
  const todayRows = paymentRows.filter((p) => inRange(p.paymentDate, today.range));
  const monthRows = paymentRows.filter((p) => inRange(p.paymentDate, cur));
  const prevRows = paymentRows.filter((p) => inRange(p.paymentDate, prev));
  const expected = sum(contracts.filter((c) => c.status === "active").map((c) => c.monthlyPayment));
  const monthIncome = sum(monthRows.map((p) => p.amount));
  return {
    currency: "UZS",
    today: today.date,
    todayIncome: sum(todayRows.map((p) => p.amount)),
    todayPaymentCount: todayRows.length,
    currentMonth: ymKey(today.month),
    currentMonthIncome: monthIncome,
    currentMonthPaymentCount: monthRows.length,
    previousMonthIncome: sum(prevRows.map((p) => p.amount)),
    expectedMonthlyRentFromActiveContracts: expected,
    currentMonthCollectionPercent: expected > 0 ? round((monthIncome / expected) * 100) : null,
    note: "Income is counted by payment date (Asia/Tashkent).",
  };
}

async function getRecentPayments(ctx: ToolContext) {
  const { paymentRows } = await loadLedger(ctx);
  const dayAgo = new Date(ctx.now.getTime() - 86_400_000);
  const weekAgo = new Date(ctx.now.getTime() - 7 * 86_400_000);
  const latest = [...paymentRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
  return {
    createdLast24h: paymentRows.filter((p) => p.createdAt >= dayAgo).length,
    createdLast7d: paymentRows.filter((p) => p.createdAt >= weekAgo).length,
    latest: latest.map((p) => ({
      amount: p.amount,
      paymentDate: iso(p.paymentDate),
      recordedAt: iso(p.createdAt),
      method: p.paymentMethod,
      period: p.periodYear && p.periodMonth ? `${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}` : null,
      tenant: p.contract?.tenant?.fullName ?? null,
      property: p.contract?.property?.title ?? null,
    })),
  };
}

async function getExpensesSummary(ctx: ToolContext) {
  const today = tashkentToday(ctx.now);
  const cur = monthRange(today.month);
  const prev = monthRange(shiftMonth(today.month, -1));
  const where = { workspaceId: ctx.workspaceId };
  const [rows, prevAgg] = await Promise.all([
    ctx.db.expense.findMany({
      where: { ...where, date: cur },
      select: { title: true, amount: true, category: true, monthlyType: true, date: true },
    }),
    ctx.db.expense.aggregate({ where: { ...where, date: prev }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const byCategory: Record<string, number> = {};
  const byMonthlyType: Record<string, number> = {};
  for (const r of rows) {
    const cat = EXPENSE_CATEGORY_MAP[r.category.toLowerCase() as keyof typeof EXPENSE_CATEGORY_MAP] ?? r.category;
    byCategory[cat] = round((byCategory[cat] ?? 0) + r.amount);
    if (r.monthlyType) {
      const t =
        MONTHLY_EXPENSE_TYPE_MAP[r.monthlyType.toLowerCase() as keyof typeof MONTHLY_EXPENSE_TYPE_MAP] ?? r.monthlyType;
      byMonthlyType[t] = round((byMonthlyType[t] ?? 0) + r.amount);
    }
  }
  return {
    currency: "UZS",
    currentMonth: ymKey(today.month),
    currentMonthTotal: sum(rows.map((r) => r.amount)),
    currentMonthCount: rows.length,
    previousMonthTotal: round(prevAgg._sum.amount ?? 0),
    previousMonthCount: prevAgg._count._all,
    byCategory,
    byMonthlyType,
    largest: [...rows]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((r) => ({ title: r.title, amount: r.amount, date: iso(r.date) })),
  };
}

async function getBookingsSummary(ctx: ToolContext) {
  const where = { workspaceId: ctx.workspaceId };
  const cur = monthRange(tashkentToday(ctx.now).month);
  const week = new Date(ctx.now.getTime() + 7 * 86_400_000);
  const [groups, monthAgg, upcoming, inHouse] = await Promise.all([
    ctx.db.booking.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ctx.db.booking.aggregate({
      where: { ...where, checkInDate: cur, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true, nights: true },
      _count: { _all: true },
    }),
    ctx.db.booking.count({
      where: { ...where, checkInDate: { gte: ctx.now, lte: week }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    ctx.db.booking.count({ where: { ...where, status: "CHECKED_IN" } }),
  ]);
  return {
    total: groups.reduce((s, g) => s + g._count._all, 0),
    byStatus: countBy(groups.map((g) => ({ key: g.status, n: g._count._all }))),
    currentMonthBookings: monthAgg._count._all,
    currentMonthRevenue: round(monthAgg._sum.totalAmount ?? 0),
    currentMonthNights: monthAgg._sum.nights ?? 0,
    arrivalsNext7Days: upcoming,
    checkedInNow: inHouse,
  };
}

async function getVehicleRentalsSummary(ctx: ToolContext) {
  const where = { workspaceId: ctx.workspaceId };
  const cur = monthRange(tashkentToday(ctx.now).month);
  const [vehicles, rentals, monthAgg] = await Promise.all([
    ctx.db.vehicle.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ctx.db.vehicleRental.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ctx.db.vehicleRental.aggregate({
      where: { ...where, startDate: cur, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);
  return {
    vehiclesByStatus: countBy(vehicles.map((g) => ({ key: g.status, n: g._count._all }))),
    rentalsByStatus: countBy(rentals.map((g) => ({ key: g.status, n: g._count._all }))),
    currentMonthRentals: monthAgg._count._all,
    currentMonthRevenue: round(monthAgg._sum.totalAmount ?? 0),
  };
}

const OPEN_TASK_STATUSES = ["NEW", "IN_PROGRESS", "SUBMITTED"] as const;

async function getTasksSummary(ctx: ToolContext) {
  const where = { workspaceId: ctx.workspaceId };
  const [groups, overdue, important] = await Promise.all([
    ctx.db.workTask.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ctx.db.workTask.count({ where: { ...where, status: { in: [...OPEN_TASK_STATUSES] }, dueAt: { lt: ctx.now } } }),
    ctx.db.workTask.findMany({
      where: { ...where, status: { in: [...OPEN_TASK_STATUSES] } },
      select: { title: true, priority: true, status: true, dueAt: true },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 5,
    }),
  ]);
  const byStatus = countBy(groups.map((g) => ({ key: g.status, n: g._count._all })));
  return {
    byStatus,
    open: OPEN_TASK_STATUSES.reduce((s, k) => s + (byStatus[k] ?? 0), 0),
    overdueOpen: overdue,
    mostImportantOpen: important.map((t) => ({ title: t.title, priority: t.priority, status: t.status, dueAt: iso(t.dueAt) })),
  };
}

async function getUsageAnalytics(ctx: ToolContext) {
  return ctx.loadUsageAnalytics();
}

const TREND_MONTHS = 6;

async function getMonthlyTrend(ctx: ToolContext) {
  const { paymentRows } = await loadLedger(ctx);
  const current = tashkentToday(ctx.now).month;
  const months = Array.from({ length: TREND_MONTHS }, (_, i) => shiftMonth(current, i - (TREND_MONTHS - 1)));
  const first = monthRange(months[0]);
  const where = { workspaceId: ctx.workspaceId };
  const [expenses, contracts, bookings] = await Promise.all([
    ctx.db.expense.findMany({ where: { ...where, date: { gte: first.gte } }, select: { amount: true, date: true } }),
    ctx.db.contract.findMany({ where: { ...where, startDate: { gte: first.gte } }, select: { startDate: true } }),
    ctx.db.booking.findMany({
      where: { ...where, checkInDate: { gte: first.gte }, status: { not: "CANCELLED" } },
      select: { checkInDate: true, totalAmount: true },
    }),
  ]);
  const series = months.map((ym) => {
    const r = monthRange(ym);
    const inR = (d: Date) => d >= r.gte && d < r.lt;
    const pays = paymentRows.filter((p) => inR(p.paymentDate));
    const exps = expenses.filter((e) => inR(e.date));
    const bks = bookings.filter((b) => inR(b.checkInDate));
    return {
      month: ymKey(ym),
      income: sum(pays.map((p) => p.amount)),
      paymentCount: pays.length,
      expenses: sum(exps.map((e) => e.amount)),
      newContracts: contracts.filter((c) => inR(c.startDate)).length,
      bookingRevenue: sum(bks.map((b) => b.totalAmount)),
      partialMonth: ym.year === current.year && ym.month === current.month,
    };
  });
  const monthsWithData = series.filter(
    (m) => m.paymentCount > 0 || m.expenses > 0 || m.newContracts > 0 || m.bookingRevenue > 0
  ).length;
  return {
    currency: "UZS",
    months: series,
    monthsWithData,
    enoughHistoryForTrend: monthsWithData >= 3,
  };
}

export const AGENT_TOOLS = {
  get_workspace_summary: getWorkspaceSummary,
  get_properties_summary: getPropertiesSummary,
  get_tenants_summary: getTenantsSummary,
  get_contracts_summary: getContractsSummary,
  get_canonical_debts: getCanonicalDebts,
  get_recent_payments: getRecentPayments,
  get_payment_summary: getPaymentSummary,
  get_expenses_summary: getExpensesSummary,
  get_bookings_summary: getBookingsSummary,
  get_vehicle_rentals_summary: getVehicleRentalsSummary,
  get_tasks_summary: getTasksSummary,
  get_usage_analytics: getUsageAnalytics,
  get_monthly_trend: getMonthlyTrend,
} as const satisfies Record<string, (ctx: ToolContext) => Promise<unknown>>;

export type AgentToolName = keyof typeof AGENT_TOOLS;

export function isAgentToolName(name: string): name is AgentToolName {
  return Object.prototype.hasOwnProperty.call(AGENT_TOOLS, name);
}

/** Fresh read of every requested tool for this run. Unknown names are rejected, not executed. */
export async function runAgentTools(
  names: readonly string[],
  ctx: Omit<ToolContext, "memo">
): Promise<{ dataAsOf: string; toolsUsed: AgentToolName[]; data: Partial<Record<AgentToolName, unknown>> }> {
  const unknown = names.filter((n) => !isAgentToolName(n));
  if (unknown.length > 0) throw new Error(`Unknown agent tool: ${unknown.join(", ")}`);
  const run: ToolContext = { ...ctx, memo: new Map() };
  const toolsUsed = names as AgentToolName[];
  const results = await Promise.all(toolsUsed.map((name) => AGENT_TOOLS[name](run)));
  return {
    dataAsOf: ctx.now.toISOString(),
    toolsUsed,
    data: Object.fromEntries(toolsUsed.map((name, i) => [name, results[i]])),
  };
}
