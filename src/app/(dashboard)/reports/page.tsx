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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollection } from "@/hooks/use-collection";
import { buildPaymentReportRows, buildRevenueSeries } from "@/lib/analytics";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense, Payment, Tenant } from "@/types";

function ReportsContent() {
  const { data: payments, loading: lp } = useCollection<Payment>("payments");
  const { data: expenses, loading: le } = useCollection<Expense>("expenses");
  const { data: tenants, loading: lt } = useCollection<Tenant>("tenants");
  const [range, setRange] = useState("6");
  const loading = lp || le || lt;

  const months = Number(range);
  const series = useMemo(
    () => buildRevenueSeries({ payments, expenses, months }),
    [payments, expenses, months]
  );

  const paymentRows = useMemo(
    () => buildPaymentReportRows({ payments, tenants, months }),
    [payments, tenants, months]
  );

  const totals = useMemo(() => {
    const income = paymentRows.reduce((s, p) => s + p.amount, 0);
    const expense = series.reduce((s, p) => s + p.xarajat, 0);
    const profit = income - expense;
    return { income, expense, profit };
  }, [paymentRows, series]);

  const reportHead = ["№", "Ism familiyasi", "Mulk", "Sana", "Berilgan summa", "Usul"];

  const reportBody = paymentRows.map((r) => [
    r.index,
    r.tenantName,
    r.propertyName,
    formatDate(r.date),
    formatCurrency(r.amount),
    PAYMENT_METHOD_MAP[r.method] ?? r.method,
  ]);

  const reportFoot = [
    ["", "JAMI", "", `${paymentRows.length} ta to'lov`, formatCurrency(totals.income), ""],
  ];

  const handleExcel = () => {
    exportToExcel(
      [
        ...paymentRows.map((r) => ({
          "№": r.index,
          "Ism familiyasi": r.tenantName,
          Mulk: r.propertyName,
          Sana: formatDate(r.date),
          "Berilgan summa": r.amount,
          Usul: PAYMENT_METHOD_MAP[r.method] ?? r.method,
          Izoh: r.note,
        })),
        {
          "№": "",
          "Ism familiyasi": "JAMI",
          Mulk: "",
          Sana: "",
          "Berilgan summa": totals.income,
          Usul: "",
          Izoh: `${paymentRows.length} ta to'lov`,
        },
      ],
      "arendahub-hisobot"
    );
  };

  const handlePdf = () => {
    exportToPdf({
      title: `To'lovlar hisoboti (${months} oy)`,
      head: reportHead,
      body: reportBody.length
        ? reportBody
        : [["—", "To'lovlar yo'q", "—", "—", "0 so'm", "—"]],
      foot: reportFoot,
      fileName: "arendahub-hisobot",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hisobotlar"
        description="To'lovlar ro'yxati, ism-familiya va umumiy summa."
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Jami to'langan"
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
          title="Sof foyda"
          value={formatCurrency(totals.profit)}
          icon={TrendingUp}
          tone="violet"
          loading={loading}
          index={2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lovlar ro&apos;yxati</CardTitle>
          <CardDescription>
            Har bir arendatorning ism-familiyasi va berilgan summa ({months} oy)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : paymentRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Tanlangan davrda to&apos;lovlar yo&apos;q
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {reportHead.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRows.map((r) => (
                    <TableRow key={`${r.index}-${r.date}-${r.tenantName}`}>
                      <TableCell>{r.index}</TableCell>
                      <TableCell className="font-medium">{r.tenantName}</TableCell>
                      <TableCell>{r.propertyName}</TableCell>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell>{formatCurrency(r.amount)}</TableCell>
                      <TableCell>{PAYMENT_METHOD_MAP[r.method] ?? r.method}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell />
                    <TableCell>JAMI</TableCell>
                    <TableCell />
                    <TableCell>{paymentRows.length} ta</TableCell>
                    <TableCell className="text-primary">
                      {formatCurrency(totals.income)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
