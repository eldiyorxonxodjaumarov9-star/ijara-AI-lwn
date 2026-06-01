"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  FileSpreadsheet,
  FileText,
  Receipt,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BarCompareChart } from "@/components/charts/bar-compare-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollection } from "@/hooks/use-collection";
import { buildRevenueSeries } from "@/lib/analytics";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { formatCurrency } from "@/lib/utils";
import { TAX_RATE } from "@/lib/constants";
import type { Expense, Payment } from "@/types";

function ReportsContent() {
  const { data: payments, loading: lp } = useCollection<Payment>("payments");
  const { data: expenses, loading: le } = useCollection<Expense>("expenses");
  const [range, setRange] = useState("6");
  const loading = lp || le;

  const months = Number(range);
  const series = useMemo(
    () => buildRevenueSeries({ payments, expenses, months }),
    [payments, expenses, months]
  );

  const totals = useMemo(() => {
    const income = series.reduce((s, p) => s + p.daromad, 0);
    const expense = series.reduce((s, p) => s + p.xarajat, 0);
    const tax = Math.round(income * TAX_RATE);
    const profit = income - expense - tax;
    return { income, expense, tax, profit };
  }, [series]);

  const handleExcel = () => {
    exportToExcel(
      series.map((s) => ({
        Oy: s.month,
        Daromad: s.daromad,
        Xarajat: s.xarajat,
        Foyda: s.daromad - s.xarajat,
      })),
      "arendahub-hisobot"
    );
  };

  const handlePdf = () => {
    exportToPdf({
      title: `Moliyaviy hisobot (${months} oy)`,
      head: ["Oy", "Daromad", "Xarajat", "Foyda"],
      body: series.map((s) => [
        s.month,
        formatCurrency(s.daromad),
        formatCurrency(s.xarajat),
        formatCurrency(s.daromad - s.xarajat),
      ]),
      fileName: "arendahub-hisobot",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hisobotlar"
        description="Moliyaviy ko'rsatkichlar va eksport."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 oy</SelectItem>
                <SelectItem value="6">6 oy</SelectItem>
                <SelectItem value="12">12 oy</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExcel}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button onClick={handlePdf}>
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Jami daromad"
          value={formatCurrency(totals.income)}
          icon={Banknote}
          tone="primary"
          loading={loading}
        />
        <StatCard
          title="Jami xarajat"
          value={formatCurrency(totals.expense)}
          icon={Receipt}
          tone="rose"
          loading={loading}
          index={1}
        />
        <StatCard
          title="Soliq (4%)"
          value={formatCurrency(totals.tax)}
          icon={Receipt}
          tone="amber"
          loading={loading}
          index={2}
        />
        <StatCard
          title="Sof foyda"
          value={formatCurrency(totals.profit)}
          icon={TrendingUp}
          tone="violet"
          loading={loading}
          index={3}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daromad va xarajat taqqoslamasi</CardTitle>
          <CardDescription>Oylik kesimda</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <BarCompareChart data={series} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute roles={["admin", "manager"]}>
      <ReportsContent />
    </ProtectedRoute>
  );
}
