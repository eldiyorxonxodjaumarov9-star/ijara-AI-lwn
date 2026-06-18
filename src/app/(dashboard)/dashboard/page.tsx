"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Building2,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { StatusChart } from "@/components/charts/status-chart";
import { useCollection } from "@/hooks/use-collection";
import { useLanguage } from "@/context/language-context";
import {
  buildRevenueSeries,
  computeMetrics,
  getOverdueContracts,
} from "@/lib/analytics";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import {
  PAYMENT_METHOD_MAP,
  PROPERTY_STATUS_MAP,
} from "@/lib/constants";
import { useAuth } from "@/context/auth-context";
import type {
  Contract,
  Expense,
  Payment,
  Property,
} from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: properties, loading: lp } = useCollection<Property>("properties");
  const { data: contracts, loading: lc } = useCollection<Contract>("contracts");
  const { data: payments, loading: lpay } = useCollection<Payment>("payments");
  const { data: expenses, loading: le } = useCollection<Expense>("expenses");

  const loading = lp || lc || lpay || le;

  const metrics = useMemo(
    () => computeMetrics({ properties, contracts, payments, expenses }),
    [properties, contracts, payments, expenses]
  );

  const revenueSeries = useMemo(
    () => buildRevenueSeries({ payments, expenses }),
    [payments, expenses]
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
  const overdue = useMemo(() => getOverdueContracts(contracts), [contracts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("dashboard.greeting")}, ${user?.displayName?.split(" ")[0] ?? t("dashboard.user")}!`}
        description={t("dashboard.desc")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          index={0}
          title={t("dashboard.totalProperties")}
          value={String(metrics.totalProperties)}
          icon={Building2}
          tone="primary"
          trend={metrics.occupancyRate}
          trendLabel={t("dashboard.occupancyTrend")}
          loading={loading}
        />
        <StatCard
          index={1}
          title={t("dashboard.monthlyIncome")}
          value={formatCurrency(metrics.monthlyIncome)}
          icon={Banknote}
          tone="blue"
          loading={loading}
        />
        <StatCard
          index={2}
          title={t("dashboard.overdueContracts")}
          value={String(metrics.overdueContracts)}
          icon={AlertTriangle}
          tone="rose"
          loading={loading}
        />
        <StatCard
          index={3}
          title={t("dashboard.netIncome")}
          value={formatCurrency(metrics.netIncome)}
          icon={TrendingUp}
          tone="primary"
          loading={loading}
        />
        <StatCard
          index={4}
          title={t("dashboard.occupancy")}
          value={`${metrics.occupancyRate}%`}
          icon={Wallet}
          tone="violet"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.revenueChart")}</CardTitle>
            <CardDescription>{t("dashboard.revenueChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <RevenueChart data={revenueSeries} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.propertyStatus")}</CardTitle>
            <CardDescription>{t("dashboard.propertyStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="mx-auto h-[200px] w-[200px] rounded-full" />
            ) : statusSeries.length > 0 ? (
              <StatusChart data={statusSeries} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("dashboard.noData")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{t("dashboard.recentPayments")}</CardTitle>
              <CardDescription>{t("dashboard.recentPaymentsDesc")}</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/payments">{t("dashboard.all")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : recentPayments.length > 0 ? (
              recentPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(p.tenantName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.tenantName ?? t("dashboard.unknown")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.propertyName ?? "—"} • {formatDate(p.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">
                      {formatCurrency(p.amount)}
                    </p>
                    <Badge variant="secondary" className="mt-0.5">
                      {PAYMENT_METHOD_MAP[p.method]}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("dashboard.noPayments")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{t("dashboard.warnings")}</CardTitle>
              <CardDescription>{t("dashboard.warningsDesc")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : overdue.length > 0 ? (
              overdue.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.propertyName ?? t("dashboard.property")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.tenantName} • {t("dashboard.ended")}: {formatDate(c.endDate)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("dashboard.noOverdue")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
