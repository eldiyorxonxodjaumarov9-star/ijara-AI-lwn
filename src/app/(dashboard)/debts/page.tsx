"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";

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
import { useTashkentClock } from "@/hooks/use-tashkent-clock";
import { computeDebts } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import type { Contract, Payment, Tenant } from "@/types";

export default function DebtsPage() {
  const { data: contracts, loading: lc } = useCollection<Contract>("contracts");
  const { data: payments, loading: lp } = useCollection<Payment>("payments");
  const { data: tenants, loading: lt } = useCollection<Tenant>("tenants");
  const tashkentNow = useTashkentClock();
  const loading = lc || lp || lt;

  const debts = useMemo(
    () => computeDebts(contracts, payments, tenants, tashkentNow),
    [contracts, payments, tenants, tashkentNow]
  );
  const totalDebt = debts.reduce((s, d) => s + d.debt, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Qarzdorliklar"
        description="To'lov muddati o'tgach (Toshkent vaqti) avtomatik qarzga o'tkaziladi."
        action={
          <SendPaymentRemindersButton label="Barchaga eslatma yuborish" />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Umumiy qarzdorlik"
          value={formatCurrency(totalDebt)}
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
                  <TableHead className="hidden lg:table-cell">Kutilgan</TableHead>
                  <TableHead className="hidden lg:table-cell">To&apos;langan</TableHead>
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
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * Qarzdorlik Toshkent vaqti bo&apos;yicha hisoblanadi: har oyning belgilangan
        to&apos;lov kunidan keyin to&apos;lanmagan summa avtomatik qarz bo&apos;limiga
        tushadi. Soat yarim tunda va har daqiqada yangilanadi.
      </p>
    </div>
  );
}
