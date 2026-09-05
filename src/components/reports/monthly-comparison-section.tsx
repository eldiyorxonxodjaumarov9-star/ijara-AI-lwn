"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Lightbulb,
  Minus,
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
  filterExpenseRows,
  formatYearMonth,
  paginateRows,
  type CategoryComparisonRow,
  type CategoryStatus,
  type ExpenseDetailRow,
  type IncomeDetailRow,
  type MetricDelta,
  type MonthlyComparisonResult,
  type MonthTotals,
  type PercentChange,
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

function deltaTone(
  improved: boolean | null,
  invertExpense = false
): "good" | "bad" | "neutral" {
  if (improved === null) return "neutral";
  if (invertExpense) return improved ? "good" : "bad";
  return improved ? "good" : "bad";
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

function formatPercentLabel(p: PercentChange) {
  if (p.kind !== "ok" || p.percent === null) return p.label;
  const sign = p.percent > 0 ? "+" : "";
  return `${sign}${p.percent.toFixed(1)}%`;
}

function statusBadge(status: CategoryStatus): {
  label: string;
  variant: "success" | "destructive" | "warning" | "secondary";
} {
  switch (status) {
    case "high_increase":
      return { label: "Yuqori o'sish", variant: "destructive" };
    case "increase":
      return { label: "O'sish", variant: "warning" };
    case "saving":
      return { label: "Tejash", variant: "success" };
    case "new_expense":
      return { label: "Yangi", variant: "warning" };
    default:
      return { label: "Barqaror", variant: "secondary" };
  }
}

function paymentStatusBadge(status: ExpenseDetailRow["paymentStatus"]) {
  if (status === "paid") return { label: "To'langan", variant: "success" as const };
  if (status === "unpaid")
    return { label: "To'lanmagan", variant: "warning" as const };
  return { label: "Rejalashtirilgan", variant: "secondary" as const };
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
  const tone = deltaTone(metric.improved, expenseStyle);
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
                  <p>1-oy: {formatCurrency(metric.base)}</p>
                  <p>2-oy: {formatCurrency(metric.compare)}</p>
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
            {metric.diff === 0 ? (
              <Minus className="size-4" />
            ) : metric.diff > 0 ? (
              <ArrowUpRight className="size-4" />
            ) : (
              <ArrowDownRight className="size-4" />
            )}
            <span>
              Farq: {metric.diff > 0 ? "+" : ""}
              {formatCurrency(metric.diff)}
            </span>
            <span className="font-medium">
              ({formatPercentLabel(metric.percent)})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
  return (
    <div className="space-y-6">
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
                    const badge = statusBadge(row.status);
                    const tone =
                      row.diff > 0 ? "bad" : row.diff < 0 ? "good" : "neutral";
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell>{formatCurrency(row.baseAmount)}</TableCell>
                        <TableCell>
                          {formatCurrency(row.compareAmount)}
                        </TableCell>
                        <TableCell className={toneClass(tone)}>
                          {row.diff > 0 ? "+" : ""}
                          {formatCurrency(row.diff)}
                        </TableCell>
                        <TableCell>{formatPercentLabel(row.percent)}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
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
    Array.isArray(apiData.baseIncomes)
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
            title="1-oy xarajatlari"
            totals={result.base}
            rows={result.baseExpenses}
            filter={expenseFilter}
            search={expenseSearch}
            loading={loading}
          />
          <ExpenseMonthBlock
            key={`exp-compare-${result.compare.label}-${expenseFilter}-${expenseSearch}`}
            title="2-oy xarajatlari"
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
