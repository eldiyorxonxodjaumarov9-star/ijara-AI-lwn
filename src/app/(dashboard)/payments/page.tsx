"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTashkentNow } from "@/context/tashkent-time-context";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { paymentBillingPeriod } from "@/lib/debt-calculator";
import {
  BILLING_STATUS_LABEL,
  buildMonthlyBillingLedger,
  summarizeBillingLedger,
  type BillingInvoiceStatus,
  type MonthlyBillingInvoice,
} from "@/lib/monthly-billing-ledger";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import type { Contract, Payment, Tenant } from "@/types";

function statusClass(status: BillingInvoiceStatus) {
  switch (status) {
    case "PAID":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "PARTIALLY_PAID":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "OVERDUE":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function methodLabel(row: MonthlyBillingInvoice) {
  if (row.paymentMethods.length === 0) return "—";
  return row.paymentMethods.map((m) => PAYMENT_METHOD_MAP[m]).join(", ");
}

export default function PaymentsPage() {
  const { data, loading: loadingPayments } = useCollection<Payment>("payments");
  const { data: contracts, loading: loadingContracts } =
    useCollection<Contract>("contracts");
  const { data: tenants, loading: loadingTenants } =
    useCollection<Tenant>("tenants");
  const { remove } = useCollectionActions<Payment>("payments");
  const tashkentNow = useTashkentNow();
  const loading = loadingPayments || loadingContracts || loadingTenants;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const ledger = useMemo(
    () => buildMonthlyBillingLedger(contracts, data, tenants, tashkentNow),
    [contracts, data, tenants, tashkentNow]
  );

  const debtSummary = useMemo(
    () => summarizeBillingLedger(ledger),
    [ledger]
  );

  const paymentsById = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const p of data) map.set(p.id, p);
    return map;
  }, [data]);

  /** Faqat haqiqiy qabul qilingan to'lovlar — qarzdorlik tushumga kirmaydi */
  const totalRevenue = useMemo(
    () => data.reduce((s, p) => s + (p.amount || 0), 0),
    [data]
  );
  const thisMonthRevenue = useMemo(() => {
    const today = getTashkentDateParts(tashkentNow);
    return data
      .filter((p) => {
        const period = paymentBillingPeriod(p);
        return period.year === today.year && period.month === today.month;
      })
      .reduce((s, p) => s + (p.amount || 0), 0);
  }, [data, tashkentNow]);

  const {
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total: count,
    paged,
  } = useTableData<MonthlyBillingInvoice>({
    data: ledger,
    searchFields: [
      "tenantName",
      "propertyName",
      "billingMonthLabel",
      "status",
    ],
    pageSize: 10,
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    toast.success("To'lov o'chirildi");
    setDeleteId(null);
  };

  const openEditForRow = (row: MonthlyBillingInvoice) => {
    const lastId = row.paymentIds[row.paymentIds.length - 1];
    const payment = lastId ? paymentsById.get(lastId) : undefined;
    if (!payment) {
      setEditing(null);
      setDialogOpen(true);
      return;
    }
    setEditing(payment);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="To'lovlar"
        description="Har bir shartnoma va oy uchun bitta hisob. Holat va to'lov usuli alohida."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> To&apos;lov qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Jami tushum"
          value={formatCurrency(totalRevenue)}
          icon={Banknote}
          tone="primary"
          loading={loading}
        />
        <StatCard
          title="Bu oy uchun"
          value={formatCurrency(thisMonthRevenue)}
          icon={Banknote}
          tone="blue"
          loading={loading}
          index={1}
        />
        <StatCard
          title="Qarzdorlar"
          value={`${debtSummary.uniqueDebtorCount} · ${formatCurrency(debtSummary.totalDebtAmount)}`}
          icon={AlertTriangle}
          tone="rose"
          loading={loading}
          index={2}
        />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Arendator yoki mulk bo'yicha..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Banknote}
                title="Hisoblar yo'q"
                description="Faol shartnomalar uchun oylik hisoblar shu yerda chiqadi."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arendator</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Mulk yoki xona
                    </TableHead>
                    <TableHead>Hisoblangan oy</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      To&apos;lov muddati
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Hisoblangan summa
                    </TableHead>
                    <TableHead>To&apos;langan summa</TableHead>
                    <TableHead>Qolgan qarz</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="hidden md:table-cell">
                      To&apos;lov usuli
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        row.status === "OVERDUE" && "bg-destructive/[0.04]",
                        row.status === "PARTIALLY_PAID" && "bg-amber-500/[0.04]",
                        row.status === "PAID" && "bg-emerald-500/[0.03]"
                      )}
                    >
                      <TableCell className="font-medium">
                        {row.tenantName}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {row.propertyName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.billingMonthLabel}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                        {formatDate(row.dueDate)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatCurrency(row.invoiceAmount)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-semibold",
                          row.paidAmount > 0 && "text-emerald-700 dark:text-emerald-400"
                        )}
                      >
                        {formatCurrency(row.paidAmount)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-semibold",
                          row.remainingAmount > 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatCurrency(row.remainingAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn("border-0", statusClass(row.status))}
                        >
                          {BILLING_STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{methodLabel(row)}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.paymentIds.length > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditForRow(row)}
                              >
                                <Pencil className="size-4" /> Oxirgi to&apos;lovni
                                tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  const last =
                                    row.paymentIds[row.paymentIds.length - 1];
                                  if (last) setDeleteId(last);
                                }}
                              >
                                <Trash2 className="size-4" /> Oxirgi to&apos;lovni
                                o&apos;chirish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={count}
        onPageChange={setPage}
      />

      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="To'lovni o'chirish"
        onConfirm={handleDelete}
      />
    </div>
  );
}
