"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CircleDollarSign,
  DoorOpen,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import "@/components/dashboard/dashboard.css";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { StatusChart } from "@/components/charts/status-chart";
import { useCollection } from "@/hooks/use-collection";
import { useTashkentNow } from "@/context/tashkent-time-context";
import { useLanguage } from "@/context/language-context";
import {
  buildRevenueSeries,
  computeMetrics,
  getOverdueContracts,
} from "@/lib/analytics";
import { getLwnRoomStats } from "@/lib/lwn-rooms";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import {
  PAYMENT_METHOD_MAP,
  PROPERTY_STATUS_MAP,
  CLIENT_STATUS_MAP,
} from "@/lib/constants";
import { useAuth } from "@/context/auth-context";
import type {
  Client,
  Contract,
  Expense,
  Payment,
  Property,
  Tenant,
} from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: properties, loading: lp } = useCollection<Property>("properties");
  const { data: tenants, loading: lt } = useCollection<Tenant>("tenants");
  const { data: clients, loading: lcl } = useCollection<Client>("clients");
  const { data: contracts, loading: lc } = useCollection<Contract>("contracts");
  const { data: payments, loading: lpay } = useCollection<Payment>("payments");
  const { data: expenses, loading: le } = useCollection<Expense>("expenses");

  const loading = lp || lt || lcl || lc || lpay || le;
  const tashkentNow = useTashkentNow();

  const metrics = useMemo(
    () =>
      computeMetrics({ properties, contracts, payments, expenses, tenants }),
    [properties, contracts, payments, expenses, tenants]
  );

  const revenueSeries = useMemo(
    () => buildRevenueSeries({ payments, expenses, contracts, tenants }),
    [payments, expenses, contracts, tenants]
  );

  const statusSeries = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: PROPERTY_STATUS_MAP[key as Property["status"]]?.label ?? key,
      value,
    }));
  }, [properties]);

  const recentPayments = payments.slice(0, 5);
  const recentTenants = tenants.slice(0, 5);
  const recentClients = clients.slice(0, 5);
  const overdue = useMemo(
    () => getOverdueContracts(contracts, tashkentNow),
    [contracts, tashkentNow]
  );

  const roomStats = useMemo(
    () => getLwnRoomStats(properties),
    [properties]
  );

  const monthlyExpense = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((e) => {
        const d = new Date(e.date);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const incomeSpark = useMemo(
    () => revenueSeries.map((p) => p.daromad),
    [revenueSeries]
  );
  const expenseSpark = useMemo(
    () => revenueSeries.map((p) => p.xarajat),
    [revenueSeries]
  );

  const expenseDelta = useMemo(() => {
    if (revenueSeries.length < 2) return null;
    const prev = revenueSeries[revenueSeries.length - 2]?.xarajat ?? 0;
    const curr = revenueSeries[revenueSeries.length - 1]?.xarajat ?? 0;
    if (prev <= 0) return null;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }, [revenueSeries]);

  const insights = useMemo(() => {
    const items: { title: string; detail: string }[] = [];
    if (expenseDelta !== null && expenseDelta !== 0) {
      items.push({
        title: "Xarajat dinamikasi",
        detail:
          expenseDelta > 0
            ? `Joriy oy xarajati oldingi oyga nisbatan +${expenseDelta}% oshgan.`
            : `Joriy oy xarajati oldingi oyga nisbatan ${expenseDelta}% kamaygan.`,
      });
    }
    if (overdue.length > 0) {
      items.push({
        title: "Shartnoma riski",
        detail: `${overdue.length} ta shartnoma muddati o‘tgan yoki tugash arafasida.`,
      });
    }
    if (roomStats.vacant > 0) {
      items.push({
        title: "Bo‘sh xonalar",
        detail: `${roomStats.vacant} ta xona bo‘sh — bandlikni oshirish imkoniyati bor.`,
      });
    }
    const nearPayments = payments.filter((p) => {
      const d = new Date(p.date);
      const diff = Math.abs(d.getTime() - tashkentNow.getTime());
      return diff < 1000 * 60 * 60 * 24 * 7;
    }).length;
    if (nearPayments > 0) {
      items.push({
        title: "To‘lov faolligi",
        detail: `Oxirgi 7 kunda ${nearPayments} ta to‘lov yozuvi qayd etilgan.`,
      });
    }
    if (items.length === 0) {
      items.push({
        title: "Operatsion holat",
        detail: "Asosiy ko‘rsatkichlar barqaror. Qarzdorlik va xarajatlarni kuzatishda davom eting.",
      });
    }
    return items.slice(0, 3);
  }, [expenseDelta, overdue.length, roomStats.vacant, payments, tashkentNow]);

  const firstName =
    user?.displayName?.split(" ")[0] ?? t("dashboard.user");

  return (
    <div className="relative space-y-5 sm:space-y-6">
      <div className="dash-grid-fade pointer-events-none absolute inset-x-0 -top-4 h-64 opacity-60" aria-hidden />

      <div className="relative space-y-5 sm:space-y-6">
        <header className="app-panel app-reveal overflow-hidden p-5 sm:p-6">
          <div
            className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-sky-500/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-cyan-400/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="app-chip text-sky-200">
                <Sparkles className="size-3.5" aria-hidden />
                AI Property Management
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {t("dashboard.greeting")}, {firstName}!
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {t("dashboard.desc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                className="bg-sky-500 text-white hover:bg-sky-400"
              >
                <Link href="/contracts">Yangi shartnoma</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-border bg-white/5 hover:bg-white/10"
              >
                <Link href="/payments">To‘lov qo‘shish</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-border bg-white/5 hover:bg-white/10"
              >
                <Link href="/tasks">Vazifa yaratish</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-border bg-white/5 hover:bg-white/10"
              >
                <Link href="/lwn-rooms">Xona qo‘shish</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardKpiCard
            index={0}
            title={t("dashboard.monthlyIncome")}
            value={formatCurrency(metrics.monthlyIncome)}
            icon={Banknote}
            tone="emerald"
            spark={incomeSpark}
            loading={loading}
            subtitle={
              metrics.incomeSource === "expected"
                ? t("dashboard.expectedIncomeHint")
                : metrics.monthlyIncomeActual > 0
                  ? t("dashboard.actualIncomeHint")
                  : undefined
            }
          />
          <DashboardKpiCard
            index={1}
            title="Oylik chiqim"
            value={formatCurrency(monthlyExpense)}
            icon={Wallet}
            tone="rose"
            spark={expenseSpark}
            loading={loading}
            trend={expenseDelta ?? undefined}
            trendLabel="oldingi oyga nisbatan"
          />
          <DashboardKpiCard
            index={2}
            title={t("dashboard.overdueContracts")}
            value={String(metrics.overdueContracts)}
            icon={AlertTriangle}
            tone="amber"
            loading={loading}
          />
          <DashboardKpiCard
            index={3}
            title={t("dashboard.occupancy")}
            value={`${metrics.occupancyRate}%`}
            icon={TrendingUp}
            tone="cyan"
            loading={loading}
            subtitle={t("dashboard.occupancyTrend")}
          />
          <DashboardKpiCard
            index={4}
            title={t("dashboard.totalProperties")}
            value={String(metrics.totalProperties)}
            icon={Building2}
            tone="blue"
            loading={loading}
          />
          <DashboardKpiCard
            index={5}
            title={t("dashboard.totalRooms")}
            value={String(roomStats.total)}
            icon={DoorOpen}
            tone="violet"
            loading={loading}
            subtitle={
              roomStats.total > 0
                ? t("dashboard.roomsVacantHint").replace(
                    "{count}",
                    String(roomStats.vacant)
                  )
                : undefined
            }
          />
          <DashboardKpiCard
            index={6}
            title={t("dashboard.totalTenants")}
            value={String(tenants.length)}
            icon={Users}
            tone="blue"
            loading={loading}
          />
          <DashboardKpiCard
            index={7}
            title={t("dashboard.netIncome")}
            value={formatCurrency(metrics.netIncome)}
            icon={CircleDollarSign}
            tone="emerald"
            loading={loading}
            subtitle={
              metrics.incomeSource === "expected"
                ? t("dashboard.expectedIncomeHint")
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <DashboardPanel
            className="xl:col-span-2"
            title={t("dashboard.revenueChart")}
            description={t("dashboard.revenueChartDesc")}
            delayMs={120}
          >
            {loading ? (
              <Skeleton className="h-[300px] w-full bg-white/10" />
            ) : (
              <RevenueChart data={revenueSeries} premium />
            )}
          </DashboardPanel>

          <DashboardPanel
            title="AI insight"
            description="Operatsion signal va tavsiyalar"
            delayMs={160}
          >
            <div className="space-y-3">
              {insights.map((item) => (
                <div
                  key={item.title}
                  className="app-insight rounded-xl px-3 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-3 text-sm font-medium text-slate-200">
                {t("dashboard.propertyStatus")}
              </p>
              {loading ? (
                <Skeleton className="mx-auto h-[180px] w-[180px] rounded-full bg-white/10" />
              ) : statusSeries.length > 0 ? (
                <StatusChart data={statusSeries} premium />
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">
                  {t("dashboard.noData")}
                </p>
              )}
            </div>
          </DashboardPanel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardPanel
            title={t("dashboard.recentTenants")}
            description={t("dashboard.recentTenantsDesc")}
            actionHref="/tenants"
            actionLabel={t("dashboard.all")}
            delayMs={180}
          >
            <ListBody
              loading={loading}
              empty={t("dashboard.noTenants")}
              items={recentTenants.map((tenant) => (
                <div key={tenant.id} className="app-row">
                  <Avatar className="size-9 border border-white/10">
                    <AvatarFallback className="bg-sky-500/15 text-sky-200">
                      {getInitials(tenant.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {tenant.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {tenant.phone}
                      {tenant.telegram ? ` • ${tenant.telegram}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">
                    {formatCurrency(tenant.rentAmount)}
                  </p>
                </div>
              ))}
            />
          </DashboardPanel>

          <DashboardPanel
            title={t("dashboard.recentClients")}
            description={t("dashboard.recentClientsDesc")}
            actionHref="/clients"
            actionLabel={t("dashboard.all")}
            delayMs={200}
          >
            <ListBody
              loading={loading}
              empty={t("dashboard.noClients")}
              items={recentClients.map((client) => {
                const st = CLIENT_STATUS_MAP[client.status];
                return (
                  <div key={client.id} className="app-row">
                    <Avatar className="size-9 border border-white/10">
                      <AvatarFallback className="bg-violet-500/15 text-violet-200">
                        {getInitials(client.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {client.fullName}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {client.phone} • {formatDate(client.lastLoginAt)}
                      </p>
                    </div>
                    <Badge
                      variant={st?.variant}
                      className="border-white/10 bg-white/5 text-slate-200"
                    >
                      {st?.label}
                    </Badge>
                  </div>
                );
              })}
            />
          </DashboardPanel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DashboardPanel
            className="lg:col-span-2"
            title={t("dashboard.recentPayments")}
            description={t("dashboard.recentPaymentsDesc")}
            actionHref="/payments"
            actionLabel={t("dashboard.all")}
            delayMs={220}
          >
            <ListBody
              loading={loading}
              empty={t("dashboard.noPayments")}
              items={recentPayments.map((p) => (
                <div key={p.id} className="app-row">
                  <Avatar className="size-9 border border-white/10">
                    <AvatarFallback className="bg-emerald-500/15 text-emerald-200">
                      {getInitials(p.tenantName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {p.tenantName ?? t("dashboard.unknown")}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {p.propertyName ?? "—"} • {formatDate(p.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-sky-300">
                      {formatCurrency(p.amount)}
                    </p>
                    <Badge
                      variant="secondary"
                      className="mt-0.5 border-white/10 bg-white/5 text-slate-300"
                    >
                      {PAYMENT_METHOD_MAP[p.method]}
                    </Badge>
                  </div>
                </div>
              ))}
            />
          </DashboardPanel>

          <DashboardPanel
            title={t("dashboard.warnings")}
            description={t("dashboard.warningsDesc")}
            delayMs={240}
          >
            <ListBody
              loading={loading}
              empty={t("dashboard.noOverdue")}
              items={overdue.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="app-row border border-rose-400/15 bg-rose-500/5"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-rose-300"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {c.propertyName ?? t("dashboard.property")}
                    </p>
                    <p className="text-xs text-slate-400">
                      {c.tenantName} • {t("dashboard.ended")}:{" "}
                      {formatDate(c.endDate)}
                    </p>
                  </div>
                </div>
              ))}
            />
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}

function ListBody({
  loading,
  empty,
  items,
}: {
  loading: boolean;
  empty: string;
  items: ReactNode[];
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/10" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">{empty}</p>
    );
  }
  return <div className="space-y-1">{items}</div>;
}
