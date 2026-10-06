"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Plus,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

import { ManualDebtDialog } from "@/components/debts/manual-debt-dialog";
import { ManualDebtPaymentDialog } from "@/components/debts/manual-debt-payment-dialog";
import { ManualDebtsTable } from "@/components/debts/manual-debts-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SendPaymentRemindersButton } from "@/components/shared/send-payment-reminders-button";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/context/auth-context";
import { useCollection } from "@/hooks/use-collection";
import { useManualDebts } from "@/hooks/use-manual-debts";
import { useTashkentNow } from "@/context/tashkent-time-context";
import { computeDebts } from "@/lib/analytics";
import { summarizeCanonicalDebts } from "@/lib/debts/canonical-debts";
import {
  canManageManualDebts,
  isActiveManualDebt,
  summarizeAllDebts,
  type ManualDebtView,
} from "@/lib/manual-debts";
import { cancelManualDebtApi } from "@/lib/manual-debts-client";
import { MONTHS_UZ } from "@/lib/payment-reminder-utils";
import { formatTashkentClock } from "@/lib/payment-due-schedule";
import { formatCurrency } from "@/lib/utils";
import type { Contract, Payment, Tenant } from "@/types";

export default function DebtsPage() {
  const { data: contracts, loading: lc } = useCollection<Contract>("contracts");
  const { data: payments, loading: lp } = useCollection<Payment>("payments");
  const { data: tenants, loading: lt } = useCollection<Tenant>("tenants");
  const manual = useManualDebts();
  const { user } = useAuth();
  const canManage = manual.enabled && canManageManualDebts(user?.role);
  const tashkentNow = useTashkentNow();
  const loading = lc || lp || lt;

  const debts = useMemo(
    () => computeDebts(contracts, payments, tenants, tashkentNow),
    [contracts, payments, tenants, tashkentNow]
  );
  const activeManual = useMemo(
    () => manual.data.filter(isActiveManualDebt),
    [manual.data]
  );
  const summary = useMemo(
    () => summarizeAllDebts(summarizeCanonicalDebts(debts), activeManual),
    [debts, activeManual]
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ManualDebtView | null>(null);
  const [paying, setPaying] = useState<ManualDebtView | null>(null);
  const [cancelling, setCancelling] = useState<ManualDebtView | null>(null);
  const refreshManual = () => void manual.refresh();
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
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Qarzdor qo‘shish
              </Button>
            )}
            <SendPaymentRemindersButton
              label="Barchaga eslatma yuborish"
              extraCount={activeManual.length}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Umumiy qarzdorlik"
          value={formatCurrency(summary.totalDebtAmount)}
          icon={TrendingDown}
          tone="rose"
          loading={loading || manual.loading}
        />
        <StatCard
          title="Qarzdor yozuvlar"
          value={String(summary.debtRecordCount)}
          icon={AlertTriangle}
          tone="amber"
          loading={loading || manual.loading}
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
          ) : debts.length === 0 && activeManual.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CheckCircle2}
                title="Qarzdorlik yo'q"
                description="Barcha to'lovlar o'z vaqtida amalga oshirilgan."
              />
            </div>
          ) : debts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Shartnomalar bo&apos;yicha qarzdorlik yo&apos;q.
            </p>
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
                            <Badge variant="outline">Shartnoma</Badge>
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

      {manual.enabled && (activeManual.length > 0 || manual.error) && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Qo‘lda qo‘shilgan qarzlar</h2>
              <span className="text-xs text-muted-foreground">
                {activeManual.length} ta · {formatCurrency(summary.manualDebtAmount)}
              </span>
            </div>
            {manual.error ? (
              <p className="p-4 text-sm text-destructive">{manual.error}</p>
            ) : (
              <ManualDebtsTable
                debts={activeManual}
                canManage={canManage}
                onPay={setPaying}
                onEdit={setEditing}
                onCancel={setCancelling}
              />
            )}
          </CardContent>
        </Card>
      )}

      <ManualDebtDialog
        open={addOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditing(null);
          }
        }}
        debt={editing}
        onSaved={refreshManual}
      />
      <ManualDebtPaymentDialog
        debt={paying}
        onOpenChange={(o) => !o && setPaying(null)}
        onSaved={refreshManual}
      />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Qarzni bekor qilish"
        description={
          cancelling
            ? `${cancelling.debtorName} qarzi (${formatCurrency(cancelling.remainingAmount)}) bekor qilinadi. Yozuv va to‘lov tarixi saqlanib qoladi, eslatmalar to‘xtaydi.`
            : undefined
        }
        confirmText="Bekor qilish"
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await cancelManualDebtApi(cancelling.id);
            toast.success("Qarz bekor qilindi");
            refreshManual();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Bekor qilishda xatolik");
          }
        }}
      />

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
