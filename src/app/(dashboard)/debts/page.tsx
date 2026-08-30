"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SendPaymentRemindersButton } from "@/components/shared/send-payment-reminders-button";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollection } from "@/hooks/use-collection";
import { useTashkentNow } from "@/context/tashkent-time-context";
import { computeDebts } from "@/lib/analytics";
import { formatTashkentClock } from "@/lib/payment-due-schedule";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Contract, Payment, Tenant } from "@/types";

export default function DebtsPage() {
  const { data: contracts, loading: lc } = useCollection<Contract>("contracts");
  const { data: payments, loading: lp } = useCollection<Payment>("payments");
  const { data: tenants, loading: lt } = useCollection<Tenant>("tenants");
  const tashkentNow = useTashkentNow();
  const loading = lc || lp || lt;

  const debts = useMemo(
    () => computeDebts(contracts, payments, tenants, tashkentNow),
    [contracts, payments, tenants, tashkentNow]
  );

  const totals = useMemo(() => {
    const expected = debts.reduce((s, d) => s + d.expected, 0);
    const paid = debts.reduce((s, d) => s + d.paid, 0);
    const debt = debts.reduce((s, d) => s + d.debt, 0);
    return { expected, paid, debt };
  }, [debts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Qarzdorliklar"
        description={`Haqiqiy sana: ${formatTashkentClock(tashkentNow)} — muddat o'tgach avtomatik ro'yxatga tushadi.`}
        action={
          <SendPaymentRemindersButton label="Barchaga eslatma yuborish" />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Umumiy qarzdorlik"
          value={formatCurrency(totals.debt)}
          icon={TrendingDown}
          tone="rose"
          loading={loading}
        />
        <StatCard
          title="Qarzdor shartnomalar"
          value={String(debts.length)}
          icon={AlertTriangle}
          tone="amber"
          loading={loading}
          index={1}
        />
        <StatCard
          title="Faol shartnomalar"
          value={String(contracts.filter((c) => c.status === "active").length)}
          icon={CheckCircle2}
          tone="primary"
          loading={loading}
          index={2}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : debts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CheckCircle2}
                title="Qarzdorlik yo'q"
                description="Barcha to'lovlar o'z vaqtida amalga oshirilgan."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mulk</TableHead>
                  <TableHead>Arendator</TableHead>
                  <TableHead className="hidden md:table-cell">Oylar</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    To&apos;lov sanasi
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Kutilgan</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    To&apos;langan
                  </TableHead>
                  <TableHead>Qarz</TableHead>
                  <TableHead>Holat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((d) => (
                  <TableRow key={d.contractId} className="bg-destructive/[0.03]">
                    <TableCell className="font-medium">{d.propertyName}</TableCell>
                    <TableCell>{d.tenantName}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {d.monthsDue} oy
                    </TableCell>
                    <TableCell className="hidden sm:table-cell whitespace-nowrap">
                      <span className="font-medium">
                        {formatDate(d.paymentDueDate)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        har oy {d.paymentDay}-kuni
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatCurrency(d.expected)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatCurrency(d.paid)}
                    </TableCell>
                    <TableCell className="font-bold text-destructive">
                      {formatCurrency(d.debt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        <AlertTriangle className="mr-1 size-3" />
                        {d.overdueDays > 0
                          ? `${d.overdueDays} kun kechikkan`
                          : "Qarzdor"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/70 hover:bg-muted/70">
                  <TableCell className="font-bold" colSpan={2}>
                    JAMI ({debts.length} ta)
                  </TableCell>
                  <TableCell className="hidden md:table-cell" />
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="hidden lg:table-cell font-semibold">
                    {formatCurrency(totals.expected)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(totals.paid)}
                  </TableCell>
                  <TableCell className="font-bold text-destructive">
                    {formatCurrency(totals.debt)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4 text-primary" />
            Hisob-kitob
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  Jami kutilgan (shartnomalar bo&apos;yicha)
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(totals.expected)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  Jami to&apos;langan (qarzdan ayiriladi)
                </span>
                <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                  − {formatCurrency(totals.paid)}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold">Qolgan umumiy qarz</span>
                  <span className="text-lg font-bold tabular-nums text-destructive">
                    {formatCurrency(totals.debt)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Formula: <strong>Kutilgan − To&apos;langan = Qarz</strong>.
                  To&apos;lovlar bo&apos;limida to&apos;lov kiritilganda
                  «To&apos;langan» oshadi, jami qarz shu summadan avtomatik
                  kamayadi. Oy to&apos;liq yopilsa qator ro&apos;yxatdan
                  chiqadi.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * Qarzdorlik Toshkent vaqti bo&apos;yicha hisoblanadi. «Qarzga»
        biriktirilgan klient darhol ro&apos;yxatga tushadi. To&apos;lov
        kiritilsa (oy to&apos;liq yopilsa) chiqadi. «Xonadan chiqish» /
        «Yakunlash» qilinganlar chiqadi, to&apos;lovlar saqlanadi.
      </p>
    </div>
  );
}
