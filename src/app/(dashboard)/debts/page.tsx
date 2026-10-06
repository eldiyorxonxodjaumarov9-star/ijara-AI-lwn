"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  TrendingDown,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SendPaymentRemindersButton } from "@/components/shared/send-payment-reminders-button";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollection } from "@/hooks/use-collection";
import { useTashkentNow } from "@/context/tashkent-time-context";
import { computeDebts } from "@/lib/analytics";
import { summarizeCanonicalDebts } from "@/lib/debts/canonical-debts";
import { MONTHS_UZ } from "@/lib/payment-reminder-utils";
import { formatTashkentClock } from "@/lib/payment-due-schedule";
import { formatCurrency } from "@/lib/utils";
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
  const summary = useMemo(() => summarizeCanonicalDebts(debts), [debts]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
          value={formatCurrency(summary.totalDebtAmount)}
          icon={TrendingDown}
          tone="rose"
          loading={loading}
        />
        <StatCard
          title="Qarzdor shartnomalar"
          value={String(summary.debtorContractCount)}
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
                  <TableHead>Ijarachi</TableHead>
                  <TableHead className="hidden md:table-cell">Qarzdor oylar</TableHead>
                  <TableHead className="hidden lg:table-cell">Kutilgan</TableHead>
                  <TableHead className="hidden lg:table-cell">To&apos;langan</TableHead>
                  <TableHead>Qarz jami</TableHead>
                  <TableHead className="hidden md:table-cell">Eng eski qarz</TableHead>
                  <TableHead>Holat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((d) => {
                  const open = expanded.has(d.contractId);
                  const ended =
                    d.contractStatus === "expired" ||
                    d.contractStatus === "terminated";
                  return (
                    <Fragment key={d.contractId}>
                      <TableRow className="bg-destructive/[0.03]">
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => toggle(d.contractId)}
                            className="inline-flex items-center gap-1 text-left hover:underline"
                            aria-expanded={open}
                            aria-label="Qarzdorlik tafsiloti"
                          >
                            <ChevronRight
                              className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                            />
                            {d.propertyName}
                          </button>
                        </TableCell>
                        <TableCell>{d.tenantName}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {d.unpaidMonths} oy
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
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {d.oldestUnpaidDueDate ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 size-3" />
                              {d.overdueDays > 0
                                ? `${d.overdueDays} kun kechikkan`
                                : "Qarzdor"}
                            </Badge>
                            {ended && (
                              <Badge variant="outline">Shartnoma tugagan</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="py-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              Qarzdorlik tafsiloti
                            </p>
                            <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                              {d.unpaidPeriods.map((p) => (
                                <li
                                  key={`${p.year}-${p.month}`}
                                  className="flex justify-between gap-4 rounded-md border border-border/60 px-3 py-1.5"
                                >
                                  <span>
                                    {MONTHS_UZ[p.month - 1]} {p.year}
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      ({p.dueDate})
                                    </span>
                                  </span>
                                  <span className="font-semibold text-destructive">
                                    {formatCurrency(p.remaining)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * Qarzdorlik Toshkent vaqti bo&apos;yicha hisoblanadi. To&apos;lanmagan
        oylar keyingi oyga o&apos;tib boradi va to&apos;liq yopilmaguncha
        ro&apos;yxatda qoladi — shartnoma tugagan bo&apos;lsa ham. Bir oy uchun
        to&apos;langan summa shu oyda saqlanib qoladi. Soat yarim tunda va har
        daqiqada yangilanadi.
      </p>
    </div>
  );
}
