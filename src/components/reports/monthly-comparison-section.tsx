"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Lightbulb,
  PiggyBank,
  Receipt,
  Scale,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { MonthCompareBarChart } from "@/components/charts/month-compare-bar-chart";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MONTHS_UZ_FULL } from "@/lib/analytics";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import {
  buildMonthlyComparison,
  COMPARISON_PAGE_SIZE,
  defaultComparisonMonths,
  expenseFilterOptions,
  expenseOutcomeLabels,
  filterExpenseRows,
  formatYearMonth,
  paginateRows,
  type CategoryComparisonRow,
  type DiffMetric,
  type ExpenseDetailRow,
  type ExpenseNameComparisonRow,
  type IncomeDetailRow,
  type MetricDelta,
  type MonthlyComparisonResult,
  type MonthTotals,
  type YearMonth,
} from "@/lib/monthly-comparison";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Expense, Payment } from "@/types";

function yearOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => current - i + 1);
}

function ymFromParts(year: string, monthIndex0: string): YearMonth {
  return { year: Number(year), month: Number(monthIndex0) + 1 };
}

/** income/net: up=green; expense: up=red */
function directionTone(
  metric: DiffMetric,
  invertUpIsBad = false
): "good" | "bad" | "neutral" {
  if (metric.direction === "same") return "neutral";
  if (metric.direction === "new") {
    return invertUpIsBad ? "bad" : "good";
  }
  const up = metric.direction === "up";
  if (invertUpIsBad) return up ? "bad" : "good";
  return up ? "good" : "bad";
}

function toneClass(tone: "good" | "bad" | "neutral") {
  switch (tone) {
    case "good":
      return "text-emerald-500";
    case "bad":
      return "text-rose-500";
    default:
      return "text-muted-foreground";
  }
}

function formatValue(
  value: number,
  unit: "currency" | "count" | "percent_points"
) {
  if (unit === "count") return `${Math.round(value)} ta`;
  if (unit === "percent_points") return `${value.toFixed(2)}%`;
  return formatCurrency(value);
}

function DiffMetricCard({
  title,
  metric,
  unit = "currency",
  invertColors = false,
  loading,
  baseMonthLabel,
  compareMonthLabel,
  expenseMode = false,
}: {
  title: string;
  metric: DiffMetric;
  unit?: "currency" | "count" | "percent_points";
  invertColors?: boolean;
  loading?: boolean;
  baseMonthLabel?: string;
  compareMonthLabel?: string;
  /** Xarajat: Ko'proq/Kamroq matnlari */
  expenseMode?: boolean;
}) {
  const tone = directionTone(metric, invertColors);
  const outcome = expenseMode ? expenseOutcomeLabels(metric) : null;
  const labeled = Boolean(baseMonthLabel && compareMonthLabel);

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {loading ? (
          <Skeleton className="mt-2 h-28 w-full" />
        ) : labeled ? (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Bazaviy oy
                </p>
                <p className="mt-1 text-sm font-semibold">{baseMonthLabel}</p>
                <p className="mt-1 text-lg font-bold">
                  {formatValue(metric.base, unit)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Taqqoslanayotgan oy
                </p>
                <p className="mt-1 text-sm font-semibold">{compareMonthLabel}</p>
                <p className="mt-1 text-lg font-bold">
                  {formatValue(metric.compare, unit)}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1 border-t pt-3">
              <p className="text-xs text-muted-foreground">Farq</p>
              <p className={cn("text-xl font-bold tracking-tight", toneClass(tone))}>
                {metric.diffLabel}
              </p>
              <p className="text-xs text-muted-foreground">Natija</p>
              <p className={cn("text-sm font-semibold", toneClass(tone))}>
                {outcome
                  ? unit === "count" &&
                    (outcome.word === "Ko'proq" || outcome.word === "Kamroq")
                    ? `${outcome.phrase} xarajat yozuvi`
                    : outcome.phrase
                  : metric.percentLabel}
              </p>
              {outcome && (
                <Badge
                  variant={
                    metric.direction === "up"
                      ? "destructive"
                      : metric.direction === "down"
                        ? "success"
                        : metric.direction === "new"
                          ? "warning"
                          : "secondary"
                  }
                  className="mt-1"
                >
                  {outcome.word}
                </Badge>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatValue(metric.base, unit)} → {formatValue(metric.compare, unit)}
            </p>
            <p className={cn("mt-2 text-xl font-bold tracking-tight", toneClass(tone))}>
              {metric.arrow} {metric.diffLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={cn("font-semibold", toneClass(tone))}>
                {metric.percentLabel}
              </span>
              <Badge
                variant={
                  metric.direction === "up"
                    ? invertColors
                      ? "destructive"
                      : "success"
                    : metric.direction === "down"
                      ? invertColors
                        ? "success"
                        : "destructive"
                      : metric.direction === "new"
                        ? "warning"
                        : "secondary"
                }
              >
                {metric.statusLabel}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonMetricCard({
  title,
  icon: Icon,
  metric,
  loading,
  expenseStyle,
}: {
  title: string;
  icon: typeof Banknote;
  metric: MetricDelta;
  loading?: boolean;
  expenseStyle?: boolean;
}) {
  const tone = directionTone(metric.metric, expenseStyle);
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <>
                <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                  {formatCurrency(metric.compare)}
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>
                    {formatCurrency(metric.base)} → {formatCurrency(metric.compare)}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
        </div>
        {!loading && (
          <div
            className={cn(
              "mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold",
              toneClass(tone)
            )}
          >
            <span>
              {metric.metric.arrow} {metric.metric.diffLabel}
            </span>
            <span className="font-medium">({metric.metric.percentLabel})</span>
            <span className="text-xs font-normal opacity-80">
              {metric.metric.statusLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function paymentStatusBadge(status: ExpenseDetailRow["paymentStatus"]) {
  if (status === "paid") return { label: "To'langan", variant: "success" as const };
  if (status === "unpaid")
    return { label: "To'lanmagan", variant: "warning" as const };
  return { label: "Rejalashtirilgan", variant: "secondary" as const };
}

function MonthSummaryCard({
  title,
  totals,
  loading,
}: {
  title: string;
  totals: MonthTotals;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{totals.label}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {loading ? (
          <Skeleton className="col-span-full h-24 w-full" />
        ) : (
          <>
            <div>
              <p className="text-muted-foreground">Jami kirim</p>
              <p className="font-semibold text-emerald-500">
                {formatCurrency(totals.income)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Haqiqiy chiqim</p>
              <p className="font-semibold text-rose-500">
                {formatCurrency(totals.expense)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Rejalashtirilgan</p>
              <p className="font-semibold text-amber-500">
                {formatCurrency(totals.plannedExpense)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Sof natija</p>
              <p className="font-semibold">{formatCurrency(totals.net)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Xarajat/kirim</p>
              <p className="font-semibold">
                {totals.expenseToIncomeRatioPercent == null
                  ? "—"
                  : `${totals.expenseToIncomeRatioPercent.toFixed(1)}%`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">To&apos;lovlar</p>
              <p className="font-semibold">{totals.paymentCount} ta</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryHighlights({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: CategoryComparisonRow[];
  mode: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {mode === "up" ? (
            <TrendingUp className="size-4 text-rose-500" />
          ) : (
            <TrendingDown className="size-4 text-emerald-500" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.key}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="font-medium">{r.label}</span>
              <span
                className={cn(
                  "shrink-0 font-semibold",
                  mode === "up" ? "text-rose-500" : "text-emerald-500"
                )}
              >
                {r.diff > 0 ? "+" : ""}
                {formatCurrency(r.diff)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function IncomeMonthBlock({
  title,
  totals,
  rows,
  loading,
}: {
  title: string;
  totals: MonthTotals;
  rows: IncomeDetailRow[];
  loading?: boolean;
}) {
  const [page, setPage] = useState(1);
  const paged = useMemo(
    () => paginateRows(rows, page, COMPARISON_PAGE_SIZE),
    [rows, page]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{totals.label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Jami kirim</p>
            <p className="text-lg font-semibold text-emerald-500">
              {formatCurrency(totals.income)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">To&apos;lovlar soni</p>
            <p className="text-lg font-semibold">{totals.paymentCount} ta</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">O&apos;rtacha to&apos;lov</p>
            <p className="text-lg font-semibold">
              {formatCurrency(totals.averagePayment)}
            </p>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Bu oyda haqiqiy to&apos;lovlar yo&apos;q
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Arendator</TableHead>
                    <TableHead>Xona / mulk</TableHead>
                    <TableHead>Qaysi oy uchun</TableHead>
                    <TableHead>To&apos;lov usuli</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell className="font-medium">{r.tenantName}</TableCell>
                      <TableCell>{r.propertyName}</TableCell>
                      <TableCell>{r.periodLabel}</TableCell>
                      <TableCell>{r.methodLabel}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">
                        {r.note}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(r.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              onPageChange={setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseMonthBlock({
  title,
  totals,
  rows,
  filter,
  search,
  loading,
}: {
  title: string;
  totals: MonthTotals;
  rows: ExpenseDetailRow[];
  filter: string;
  search: string;
  loading?: boolean;
}) {
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () => filterExpenseRows(rows, { filter, search }),
    [rows, filter, search]
  );
  const paged = useMemo(
    () => paginateRows(filtered, page, COMPARISON_PAGE_SIZE),
    [filtered, page]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{totals.label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Jami kiritilgan</p>
            <p className="font-semibold">
              {formatCurrency(totals.listedExpenseTotal)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Haqiqiy chiqim</p>
            <p className="font-semibold text-rose-500">
              {formatCurrency(totals.expense)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Reja / to&apos;lanmagan</p>
            <p className="font-semibold text-amber-500">
              {formatCurrency(totals.plannedExpense)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Xarajatlar soni</p>
            <p className="font-semibold">{totals.expenseCount} ta</p>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Mos xarajatlar topilmadi
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Xarajat nomi</TableHead>
                    <TableHead>Turi / kategoriya</TableHead>
                    <TableHead>Davriylik</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>To&apos;lov usuli</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.items.map((r) => {
                    const badge = paymentStatusBadge(r.paymentStatus);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p>{r.typeLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.categoryLabel}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{r.cadenceLabel}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>{r.methodLabel}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-muted-foreground">
                          {r.note}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            !r.countsTowardCashOutflow && "text-amber-500"
                          )}
                        >
                          {formatCurrency(r.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Filtrlangan: {filtered.length} ta · Sahifa summasi faqat ko&apos;rinish
              uchun — yuqoridagi jami barcha yozuvlar asosida.
            </p>
            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              onPageChange={setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({
  result,
  loading,
}: {
  result: MonthlyComparisonResult;
  loading: boolean;
}) {
  const d = result.overviewDiffs;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Umumiy farqlar</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DiffMetricCard
            title="Jami kirim farqi"
            metric={d.income}
            loading={loading}
          />
          <DiffMetricCard
            title="Haqiqiy chiqim farqi"
            metric={d.paidExpense}
            invertColors
            loading={loading}
          />
          <DiffMetricCard
            title="Sof natija farqi"
            metric={d.net}
            loading={loading}
          />
          <DiffMetricCard
            title="Xarajat/kirim nisbati farqi"
            metric={d.expenseToIncomeRatio}
            unit="percent_points"
            invertColors
            loading={loading}
          />
          <DiffMetricCard
            title="Taxminiy tejash imkoniyati"
            metric={d.estimatedSavings}
            invertColors
            loading={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthSummaryCard
          title="1-oy xulosasi"
          totals={result.base}
          loading={loading}
        />
        <MonthSummaryCard
          title="2-oy xulosasi"
          totals={result.compare}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ComparisonMetricCard
          title="Jami kirim"
          icon={Banknote}
          metric={result.income}
          loading={loading}
        />
        <ComparisonMetricCard
          title="Haqiqiy chiqim"
          icon={Receipt}
          metric={result.expense}
          loading={loading}
          expenseStyle
        />
        <ComparisonMetricCard
          title="Sof natija"
          icon={Scale}
          metric={result.net}
          loading={loading}
        />
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Taxminiy tejash imkoniyati
                </p>
                {loading ? (
                  <Skeleton className="mt-2 h-8 w-32" />
                ) : (
                  <>
                    <p className="mt-2 text-xl font-bold tracking-tight text-amber-500 sm:text-2xl">
                      {formatCurrency(result.estimatedSavingsOpportunity)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Taxminiy — haqiqiy xarajat toifalaridagi o&apos;sishlar
                      yig&apos;indisi
                    </p>
                  </>
                )}
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                <PiggyBank className="size-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Rejalashtirilgan xarajat (1-oy)
            </p>
            <p className="mt-1 text-xl font-bold text-amber-500">
              {formatCurrency(result.base.plannedExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Rejalashtirilgan xarajat (2-oy)
            </p>
            <p className="mt-1 text-xl font-bold text-amber-500">
              {formatCurrency(result.compare.plannedExpense)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kirim, chiqim va sof natija</CardTitle>
          <CardDescription>
            {result.base.label} va {result.compare.label} yonma-yon
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <MonthCompareBarChart
              data={result.chart}
              baseLabel={result.base.label}
              compareLabel={result.compare.label}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryHighlights
          title="Eng ko'p oshgan 3 ta"
          rows={result.topIncreases}
          mode="up"
        />
        <CategoryHighlights
          title="Eng ko'p kamaygan 3 ta"
          rows={result.topDecreases}
          mode="down"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-4" />
            Xarajat toifalari taqqosi (haqiqiy chiqim)
          </CardTitle>
          <CardDescription>
            Rule-based tavsiyalar — rejalashtirilgan summa bu jadvalga
            kiritilmaydi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : result.categories.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tanlangan oylarda haqiqiy xarajat toifalari yo&apos;q
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Xarajat turi</TableHead>
                    <TableHead>1-oy summasi</TableHead>
                    <TableHead>2-oy summasi</TableHead>
                    <TableHead>Farq</TableHead>
                    <TableHead>Foiz</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Tavsiya</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.categories.map((row) => {
                    const tone = directionTone(
                      {
                        direction: row.direction,
                        base: row.baseAmount,
                        compare: row.compareAmount,
                        diff: row.diff,
                        percent: row.percent.percent,
                        statusLabel: row.statusLabel,
                        arrow:
                          row.direction === "up"
                            ? "↑"
                            : row.direction === "down"
                              ? "↓"
                              : "→",
                        diffLabel: row.diffLabel,
                        percentLabel: row.percentLabel,
                      },
                      true
                    );
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell>{formatCurrency(row.baseAmount)}</TableCell>
                        <TableCell>
                          {formatCurrency(row.compareAmount)}
                        </TableCell>
                        <TableCell className={toneClass(tone)}>
                          {row.diffLabel}
                        </TableCell>
                        <TableCell className={toneClass(tone)}>
                          {row.percentLabel}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.direction === "up"
                                ? "destructive"
                                : row.direction === "down"
                                  ? "success"
                                  : row.direction === "new"
                                    ? "warning"
                                    : "secondary"
                            }
                          >
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                          {row.recommendation}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExpenseNameRowsTable({
  rows,
  baseLabel,
  compareLabel,
  emptyText,
}: {
  rows: ExpenseNameComparisonRow[];
  baseLabel: string;
  compareLabel: string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Xarajat nomi</TableHead>
            <TableHead>Kategoriya</TableHead>
            <TableHead>{baseLabel}</TableHead>
            <TableHead>{compareLabel}</TableHead>
            <TableHead>Farq</TableHead>
            <TableHead>Foiz</TableHead>
            <TableHead>Holat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.categoryLabel}</TableCell>
              <TableCell>{formatCurrency(row.baseAmount)}</TableCell>
              <TableCell>{formatCurrency(row.compareAmount)}</TableCell>
              <TableCell
                className={toneClass(
                  row.direction === "up"
                    ? "bad"
                    : row.direction === "down"
                      ? "good"
                      : "neutral"
                )}
              >
                {row.diffLabel}
              </TableCell>
              <TableCell>{row.percentLabel}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.direction === "up"
                      ? "destructive"
                      : row.direction === "down"
                        ? "success"
                        : row.direction === "new"
                          ? "warning"
                          : "secondary"
                  }
                >
                  {row.statusLabel}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ExpenseDiffExplainSection({
  result,
  loading,
}: {
  result: MonthlyComparisonResult;
  loading?: boolean;
}) {
  const [showAllRisingNames, setShowAllRisingNames] = useState(false);
  const [showAllFallingNames, setShowAllFallingNames] = useState(false);
  const expl = result.expenseExplanation;
  const baseLabel = expl?.baseLabel ?? result.base.label;
  const compareLabel = expl?.compareLabel ?? result.compare.label;

  const categoriesSorted = useMemo(() => {
    return [...result.categories].sort((a, b) => b.diff - a.diff);
  }, [result.categories]);

  const risingNamesVisible = useMemo(() => {
    const all = expl?.risingNames ?? [];
    return showAllRisingNames ? all : all.slice(0, 5);
  }, [expl?.risingNames, showAllRisingNames]);

  const fallingNamesVisible = useMemo(() => {
    const all = expl?.fallingNames ?? [];
    return showAllFallingNames ? all : all.slice(0, 5);
  }, [expl?.fallingNames, showAllFallingNames]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold sm:text-lg">
          {loading ? "Xarajatlar farqi" : expl?.title ?? "Xarajatlar farqi"}
        </h3>
        {loading ? (
          <Skeleton className="mt-2 h-5 w-full max-w-xl" />
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{expl?.headline}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DiffMetricCard
          title="Jami kiritilgan xarajat"
          metric={result.expenseDiffs.listedTotal}
          invertColors
          loading={loading}
          baseMonthLabel={baseLabel}
          compareMonthLabel={compareLabel}
          expenseMode
        />
        <DiffMetricCard
          title="Haqiqiy to'langan chiqim"
          metric={result.expenseDiffs.paidOutflow}
          invertColors
          loading={loading}
          baseMonthLabel={baseLabel}
          compareMonthLabel={compareLabel}
          expenseMode
        />
        <DiffMetricCard
          title="Rejalashtirilgan/to'lanmagan"
          metric={result.expenseDiffs.planned}
          invertColors
          loading={loading}
          baseMonthLabel={baseLabel}
          compareMonthLabel={compareLabel}
          expenseMode
        />
        <DiffMetricCard
          title="Xarajatlar soni"
          metric={result.expenseDiffs.expenseCount}
          unit="count"
          invertColors
          loading={loading}
          baseMonthLabel={baseLabel}
          compareMonthLabel={compareLabel}
          expenseMode
        />
        <DiffMetricCard
          title="O'rtacha xarajat"
          metric={result.expenseDiffs.averageExpense}
          invertColors
          loading={loading}
          baseMonthLabel={baseLabel}
          compareMonthLabel={compareLabel}
          expenseMode
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Xarajat o&apos;zgarishining sabablari
          </CardTitle>
          <CardDescription>
            Faqat haqiqiy to&apos;langan chiqim kategoriyalari asosida
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !expl ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Xarajatlar oshishi
                  </p>
                  <p className="mt-1 text-lg font-bold text-rose-500">
                    {expl.totalIncreaseLabel}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Xarajatlar kamayishi
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-500">
                    {expl.totalDecreaseLabel}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Yakuniy farq</p>
                  <p
                    className={cn(
                      "mt-1 text-lg font-bold",
                      expl.netDiff > 0
                        ? "text-rose-500"
                        : expl.netDiff < 0
                          ? "text-emerald-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {expl.netDiffLabel}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {expl.narrative}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Qaysi xarajatlar oshgan?</CardTitle>
          <CardDescription>
            Kategoriyalar eng ko&apos;p oshgan summadan boshlab
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : categoriesSorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Kategoriya farqlari yo&apos;q
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Xarajat kategoriyasi</TableHead>
                    <TableHead>{baseLabel}</TableHead>
                    <TableHead>{compareLabel}</TableHead>
                    <TableHead>Farq</TableHead>
                    <TableHead>Foiz</TableHead>
                    <TableHead>Umumiy o&apos;sishga hissasi</TableHead>
                    <TableHead>Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoriesSorted.map((row: CategoryComparisonRow) => (
                    <TableRow key={`exp-cat-${row.key}`}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>{formatCurrency(row.baseAmount)}</TableCell>
                      <TableCell>{formatCurrency(row.compareAmount)}</TableCell>
                      <TableCell
                        className={toneClass(
                          row.direction === "up"
                            ? "bad"
                            : row.direction === "down"
                              ? "good"
                              : "neutral"
                        )}
                      >
                        {row.diffLabel}
                      </TableCell>
                      <TableCell>{row.percentLabel}</TableCell>
                      <TableCell>{row.shareLabel || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.direction === "up"
                              ? "destructive"
                              : row.direction === "down"
                                ? "success"
                                : row.direction === "new"
                                  ? "warning"
                                  : "secondary"
                          }
                        >
                          {row.statusLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Eng ko&apos;p pul ishlatilgan xarajatlar
          </CardTitle>
          <CardDescription>
            Bir xil nom va kategoriya bo&apos;yicha jamlangan (haqiqiy chiqim)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading || !expl ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  Ko&apos;paygan va yangi xarajatlar
                </h4>
                <ExpenseNameRowsTable
                  rows={risingNamesVisible}
                  baseLabel={baseLabel}
                  compareLabel={compareLabel}
                  emptyText="Ko'paygan yoki yangi xarajat yo'q"
                />
                {(expl.risingNames?.length ?? 0) > 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllRisingNames((v) => !v)}
                  >
                    {showAllRisingNames
                      ? "Yig'ish"
                      : `Barchasini ko'rish (${expl.risingNames.length})`}
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Kamaygan xarajatlar</h4>
                <ExpenseNameRowsTable
                  rows={fallingNamesVisible}
                  baseLabel={baseLabel}
                  compareLabel={compareLabel}
                  emptyText="Kamaygan xarajat yo'q"
                />
                {(expl.fallingNames?.length ?? 0) > 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllFallingNames((v) => !v)}
                  >
                    {showAllFallingNames
                      ? "Yig'ish"
                      : `Barchasini ko'rish (${expl.fallingNames.length})`}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MonthlyComparisonSection({
  payments,
  expenses,
  collectionLoading,
}: {
  payments: Payment[];
  expenses: Expense[];
  collectionLoading: boolean;
}) {
  const defaults = useMemo(() => defaultComparisonMonths(), []);
  const [baseYear, setBaseYear] = useState(String(defaults.base.year));
  const [baseMonthIdx, setBaseMonthIdx] = useState(
    String(defaults.base.month - 1)
  );
  const [compareYear, setCompareYear] = useState(String(defaults.compare.year));
  const [compareMonthIdx, setCompareMonthIdx] = useState(
    String(defaults.compare.month - 1)
  );
  const [apiData, setApiData] = useState<MonthlyComparisonResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [expenseSearch, setExpenseSearch] = useState("");

  const baseMonth = useMemo(
    () => ymFromParts(baseYear, baseMonthIdx),
    [baseYear, baseMonthIdx]
  );
  const compareMonth = useMemo(
    () => ymFromParts(compareYear, compareMonthIdx),
    [compareYear, compareMonthIdx]
  );

  const localResult = useMemo(
    () =>
      buildMonthlyComparison({
        payments,
        expenses,
        baseMonth,
        compareMonth,
      }),
    [payments, expenses, baseMonth, compareMonth]
  );

  useEffect(() => {
    if (!isApiConfigured) return;
    const baseKey = formatYearMonth(baseMonth);
    const compareKey = formatYearMonth(compareMonth);
    let cancelled = false;

    void (async () => {
      try {
        const data = await apiFetch<MonthlyComparisonResult>(
          `/reports/monthly-comparison?baseMonth=${baseKey}&compareMonth=${compareKey}`
        );
        if (!cancelled) {
          setApiData(data);
          setApiError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setApiData(null);
          setApiError(
            err instanceof Error ? err.message : "Solishtirish yuklanmadi"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseMonth, compareMonth]);

  const result =
    apiData &&
    apiData.base.year === baseMonth.year &&
    apiData.base.month === baseMonth.month &&
    apiData.compare.year === compareMonth.year &&
    apiData.compare.month === compareMonth.month &&
    Array.isArray(apiData.baseExpenses) &&
    Array.isArray(apiData.baseIncomes) &&
    apiData.incomeDiffs &&
    apiData.expenseDiffs &&
    apiData.overviewDiffs &&
    apiData.expenseExplanation
      ? apiData
      : localResult;

  const loading = collectionLoading;
  const years = yearOptions();
  const filterOptions = expenseFilterOptions();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Oylarni solishtirish</CardTitle>
          <CardDescription>
            Ikkita oy uchun haqiqiy kirim va barcha xarajat yozuvlarini batafsil
            ko&apos;ring. Qarzdorlik kirimga kiritilmaydi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Birinchi oy (bazaviy)</p>
              <div className="flex flex-wrap gap-2">
                <Select value={baseMonthIdx} onValueChange={setBaseMonthIdx}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Oy" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_UZ_FULL.map((name, i) => (
                      <SelectItem key={name} value={String(i)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={baseYear} onValueChange={setBaseYear}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Yil" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Ikkinchi oy (taqqoslash)</p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={compareMonthIdx}
                  onValueChange={setCompareMonthIdx}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Oy" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_UZ_FULL.map((name, i) => (
                      <SelectItem key={`c-${name}`} value={String(i)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={compareYear} onValueChange={setCompareYear}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Yil" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={`c-${y}`} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {result.sameMonth && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              Bir xil oy tanlangan. Taqqoslash uchun boshqa oyni tanlang.
            </div>
          )}
          {apiError && (
            <p className="text-xs text-muted-foreground">
              Server solishtirishiga ulanishda muammo — lokal hisob
              ko&apos;rsatilmoqda ({payments.length} to&apos;lov,{" "}
              {expenses.length} xarajat).
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="overview">Umumiy taqqoslash</TabsTrigger>
          <TabsTrigger value="income">Kirimlar</TabsTrigger>
          <TabsTrigger value="expenses">Xarajatlar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab result={result} loading={loading} />
        </TabsContent>

        <TabsContent value="income" className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Kirimlar farqi</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DiffMetricCard
                title="Jami kirim farqi"
                metric={result.incomeDiffs.totalIncome}
                loading={loading}
              />
              <DiffMetricCard
                title="To'lovlar soni farqi"
                metric={result.incomeDiffs.paymentCount}
                unit="count"
                loading={loading}
              />
              <DiffMetricCard
                title="O'rtacha to'lov farqi"
                metric={result.incomeDiffs.averagePayment}
                loading={loading}
              />
            </div>
          </div>
          <IncomeMonthBlock
            key={`income-base-${result.base.label}`}
            title="1-oy kirimlari"
            totals={result.base}
            rows={result.baseIncomes}
            loading={loading}
          />
          <IncomeMonthBlock
            key={`income-compare-${result.compare.label}`}
            title="2-oy kirimlari"
            totals={result.compare}
            rows={result.compareIncomes}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <ExpenseDiffExplainSection
            result={result}
            loading={loading}
          />

          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Xarajat nomi yoki izoh bo'yicha qidirish..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                />
              </div>
              <Select value={expenseFilter} onValueChange={setExpenseFilter}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Kategoriya" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <ExpenseMonthBlock
            key={`exp-base-${result.base.label}-${expenseFilter}-${expenseSearch}`}
            title={`${result.base.label} xarajatlari`}
            totals={result.base}
            rows={result.baseExpenses}
            filter={expenseFilter}
            search={expenseSearch}
            loading={loading}
          />
          <ExpenseMonthBlock
            key={`exp-compare-${result.compare.label}-${expenseFilter}-${expenseSearch}`}
            title={`${result.compare.label} xarajatlari`}
            totals={result.compare}
            rows={result.compareExpenses}
            filter={expenseFilter}
            search={expenseSearch}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
