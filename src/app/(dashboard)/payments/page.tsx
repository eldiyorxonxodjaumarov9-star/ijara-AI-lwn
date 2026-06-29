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
import { computeDebts } from "@/lib/analytics";
import { isSameMonthTashkent, getTashkentDateParts } from "@/lib/payment-due-schedule";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import type { Contract, Payment, Tenant } from "@/types";

type PaymentTableRow = {
  id: string;
  tenantName: string;
  propertyName: string;
  dateLabel: string;
  methodLabel: string;
  amount: number;
  isDebtor: boolean;
  isDebtOnly: boolean;
  payment?: Payment;
};

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

  const debts = useMemo(
    () => computeDebts(contracts, data, tenants, tashkentNow),
    [contracts, data, tenants, tashkentNow]
  );

  const debtorContractIds = useMemo(
    () => new Set(debts.map((d) => d.contractId)),
    [debts]
  );

  const tableRows = useMemo<PaymentTableRow[]>(() => {
    const contractsWithPayment = new Set(
      data.map((p) => p.contractId).filter(Boolean) as string[]
    );

    const rows: PaymentTableRow[] = [];

    for (const d of debts) {
      if (!contractsWithPayment.has(d.contractId)) {
        rows.push({
          id: `debt-${d.contractId}`,
          tenantName: d.tenantName,
          propertyName: d.propertyName,
          dateLabel:
            d.overdueDays > 0
              ? `Kechikkan (${d.overdueDays} kun)`
              : "Muddati o'tgan",
          methodLabel: "Qarzdor",
          amount: d.debt,
          isDebtor: true,
          isDebtOnly: true,
        });
      }
    }

    for (const p of data) {
      const isDebtor = !!p.contractId && debtorContractIds.has(p.contractId);
      rows.push({
        id: p.id,
        tenantName: p.tenantName ?? "—",
        propertyName: p.propertyName ?? "—",
        dateLabel: formatDate(p.date),
        methodLabel: PAYMENT_METHOD_MAP[p.method],
        amount: p.amount,
        isDebtor,
        isDebtOnly: false,
        payment: p,
      });
    }

    return rows.sort((a, b) => Number(b.isDebtor) - Number(a.isDebtor));
  }, [data, debts, debtorContractIds]);

  const total = useMemo(
    () => data.reduce((s, p) => s + (p.amount || 0), 0),
    [data]
  );
  const thisMonth = useMemo(() => {
    const today = getTashkentDateParts(tashkentNow);
    return data
      .filter((p) => isSameMonthTashkent(p.date, today.year, today.month))
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
  } = useTableData<PaymentTableRow>({
    data: tableRows,
    searchFields: ["tenantName", "propertyName", "dateLabel"],
    pageSize: 10,
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    toast.success("To'lov o'chirildi");
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="To'lovlar"
        description="Qarzdorlar qizil rangda — to'lov muddati o'tgan arendatorlar."
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
          value={formatCurrency(total)}
          icon={Banknote}
          tone="primary"
          loading={loading}
        />
        <StatCard
          title="Bu oy"
          value={formatCurrency(thisMonth)}
          icon={Banknote}
          tone="blue"
          loading={loading}
          index={1}
        />
        <StatCard
          title="Qarzdorlar"
          value={String(debts.length)}
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
                title="To'lovlar yo'q"
                description="Birinchi to'lovni qo'shing."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arendator</TableHead>
                  <TableHead className="hidden md:table-cell">Mulk</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Usul</TableHead>
                  <TableHead>Summa</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.isDebtor && "bg-destructive/[0.05]"
                    )}
                  >
                    <TableCell
                      className={cn(
                        "font-medium",
                        row.isDebtor && "text-destructive"
                      )}
                    >
                      {row.tenantName}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden md:table-cell",
                        row.isDebtor
                          ? "text-destructive/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {row.propertyName}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap",
                        row.isDebtor && "text-destructive"
                      )}
                    >
                      {row.dateLabel}
                    </TableCell>
                    <TableCell>
                      {row.isDebtor ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 size-3" />
                          {row.isDebtOnly ? "Qarzdor" : "Qarzdorlik"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{row.methodLabel}</Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-semibold",
                        row.isDebtor ? "text-destructive" : "text-primary"
                      )}
                    >
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell>
                      {row.payment ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(row.payment!);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-4" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(row.payment!.id)}
                            >
                              <Trash2 className="size-4" /> O&apos;chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
