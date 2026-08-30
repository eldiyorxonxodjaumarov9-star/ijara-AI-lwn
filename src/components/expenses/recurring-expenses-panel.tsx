"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { RecurringExpenseDialog } from "@/components/expenses/recurring-expense-dialog";
import { RecurringPayDialog } from "@/components/expenses/recurring-pay-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { MONTHS_UZ_FULL } from "@/lib/analytics";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import {
  EXPENSE_CATEGORY_MAP,
  RECURRENCE_INTERVAL_MAP,
} from "@/lib/constants";
import { refreshCollection } from "@/lib/data/store";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import {
  RECURRING_STATUS_LABEL,
  buildMonthlyRecurringPlan,
} from "@/lib/recurring-expense";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  Expense,
  RecurringExpense,
  RecurringOccurrence,
  RecurringPlanSummary,
} from "@/types";

export function RecurringExpensesPanel() {
  const { data: schedules, loading: schedulesLoading } =
    useCollection<RecurringExpense>("recurring-expenses");
  const { data: expenses, loading: expensesLoading } =
    useCollection<Expense>("expenses");
  const { update, remove } = useCollectionActions<RecurringExpense>(
    "recurring-expenses"
  );
  const { create: createExpense } = useCollectionActions<Expense>("expenses");

  const nowParts = getTashkentDateParts();
  const [month, setMonth] = useState(String(nowParts.month));
  const [year, setYear] = useState(String(nowParts.year));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [payTarget, setPayTarget] = useState<RecurringOccurrence | null>(null);
  const [apiPlan, setApiPlan] = useState<RecurringPlanSummary | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planTick, setPlanTick] = useState(0);

  const monthNum = Number(month);
  const yearNum = Number(year);
  const periodLabel = `${MONTHS_UZ_FULL[monthNum - 1]} ${yearNum}`;

  const yearOptions = useMemo(() => {
    const y = nowParts.year;
    return Array.from({ length: 6 }, (_, i) => y - 2 + i);
  }, [nowParts.year]);

  const localPlan = useMemo(
    () => buildMonthlyRecurringPlan(schedules, expenses, yearNum, monthNum),
    [schedules, expenses, yearNum, monthNum]
  );

  const loadApiPlan = useCallback(async () => {
    if (!isApiConfigured) {
      setApiPlan(null);
      return;
    }
    setPlanLoading(true);
    try {
      const plan = await apiFetch<RecurringPlanSummary>(
        `/recurring-expenses/plan?year=${yearNum}&month=${monthNum}`
      );
      setApiPlan(plan);
    } catch {
      setApiPlan(null);
    } finally {
      setPlanLoading(false);
    }
  }, [yearNum, monthNum]);

  useEffect(() => {
    void loadApiPlan();
  }, [loadApiPlan, planTick]);

  const plan = apiPlan ?? localPlan;
  const loading = schedulesLoading || expensesLoading || planLoading;

  const refreshAll = async () => {
    await Promise.all([
      refreshCollection("recurring-expenses"),
      refreshCollection("expenses"),
    ]);
    setPlanTick((t) => t + 1);
  };

  const handleToggleActive = async (item: RecurringExpense) => {
    try {
      await update(item.id, { active: !item.active });
      toast.success(item.active ? "Nofaol qilindi" : "Faollashtirildi");
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await remove(id);
      toast.success("Doimiy xarajat nofaol qilindi");
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    }
  };

  const handleLocalPay = async (payload: {
    amount: number;
    date: string;
    notes?: string;
  }) => {
    if (!payTarget) return;
    const already = expenses.some(
      (e) =>
        e.recurringExpenseId === payTarget.recurringExpenseId &&
        e.paymentPeriodKey === payTarget.paymentPeriodKey &&
        (e.source === "recurring_expense" || !e.source)
    );
    if (already) {
      throw new Error("Bu oy allaqachon to'langan");
    }
    await createExpense({
      category: payTarget.category,
      amount: payload.amount,
      date: payload.date,
      note:
        payload.notes ||
        `${payTarget.name}${
          payTarget.monthlyExpenseLabel
            ? ` — ${payTarget.monthlyExpenseLabel}`
            : ""
        }`,
      monthlyExpenseType: payTarget.monthlyExpenseType,
      monthlyExpenseCustomName: payTarget.monthlyExpenseCustomName,
      source: "recurring_expense",
      recurringExpenseId: payTarget.recurringExpenseId,
      paymentPeriodKey: payTarget.paymentPeriodKey,
      plannedDueDate: payTarget.dueDate,
    } as Omit<Expense, "id" | "createdAt">);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Oy" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_UZ_FULL.map((name, i) => (
                <SelectItem key={name} value={String(i + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Yil" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> Doimiy xarajat qo&apos;shish
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Jami reja"
          value={formatCurrency(plan.plannedTotal)}
          icon={Receipt}
          tone="rose"
          loading={loading}
        />
        <StatCard
          title="To'langan"
          value={formatCurrency(plan.paidTotal)}
          icon={CheckCircle2}
          tone="blue"
          loading={loading}
          index={1}
        />
        <StatCard
          title="Qolgan"
          value={formatCurrency(plan.remainingTotal)}
          icon={Wallet}
          tone="amber"
          loading={loading}
          index={2}
        />
        <StatCard
          title="Muddati o'tgan"
          value={String(plan.overdueCount)}
          icon={AlertTriangle}
          tone="rose"
          loading={loading}
          index={3}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Jadval ({schedules.length})
        </h3>
        <Card>
          <CardContent className="p-0">
            {schedulesLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CalendarClock}
                  title="Doimiy xarajat yo'q"
                  description="Suv, elektr, internet va boshqa muntazam to'lovlar uchun jadval qo'shing."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomi</TableHead>
                    <TableHead className="hidden md:table-cell">Tur</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Takrorlash
                    </TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {s.monthlyExpenseLabel ||
                          EXPENSE_CATEGORY_MAP[s.category]}
                      </TableCell>
                      <TableCell>{formatCurrency(s.amount)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {RECURRENCE_INTERVAL_MAP[s.interval]}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.active ? "secondary" : "outline"}>
                          {s.active ? "Faol" : "Nofaol"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(s);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-4" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void handleToggleActive(s)}
                            >
                              {s.active ? "Nofaol qilish" : "Faollashtirish"}
                            </DropdownMenuItem>
                            {s.active && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void handleDeactivate(s.id)}
                              >
                                O&apos;chirish (nofaol)
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {periodLabel} reja ({plan.count} ta)
        </h3>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : plan.occurrences.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CalendarClock}
                  title={`${periodLabel}da reja yo'q`}
                  description="Faol jadval yo'q yoki bu oyda to'lov kuni mos kelmaydi."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holat</TableHead>
                    <TableHead>Nomi</TableHead>
                    <TableHead className="hidden md:table-cell">Sana</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.occurrences.map((o) => (
                    <TableRow
                      key={`${o.recurringExpenseId}-${o.paymentPeriodKey}`}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {RECURRING_STATUS_LABEL[o.status]}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{o.name}</div>
                        {o.monthlyExpenseLabel && (
                          <div className="text-xs text-muted-foreground">
                            {o.monthlyExpenseLabel}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">
                        {formatDate(o.dueDate)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(o.amount)}
                      </TableCell>
                      <TableCell>
                        {!o.paid && (
                          <Button size="sm" onClick={() => setPayTarget(o)}>
                            To&apos;lash
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <RecurringExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSaved={() => void refreshAll()}
      />

      <RecurringPayDialog
        open={!!payTarget}
        onOpenChange={(open) => !open && setPayTarget(null)}
        occurrence={payTarget}
        onPaid={() => void refreshAll()}
        onSubmit={isApiConfigured ? undefined : handleLocalPay}
      />
    </div>
  );
}
