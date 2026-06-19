"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
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
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { isApiConfigured } from "@/lib/api/client";
import {
  syncAllPaymentsFromContractsLocal,
  syncPaymentsFromContractsApi,
} from "@/lib/payment-sync";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import type { Contract, Payment } from "@/types";

export default function PaymentsPage() {
  const { data, loading, api } = useCollection<Payment>("payments");
  const { data: contracts, loading: loadingContracts } =
    useCollection<Contract>("contracts");
  const { remove } = useCollectionActions<Payment>("payments");
  const [syncing, setSyncing] = useState(false);
  const autoSynced = useRef(false);

  const runSync = async (silent = false) => {
    setSyncing(true);
    try {
      const count = isApiConfigured
        ? await syncPaymentsFromContractsApi()
        : await syncAllPaymentsFromContractsLocal();
      await api.list();
      if (!silent) {
        toast.success(
          count > 0
            ? `${count} ta to'lov shartnomalardan yuklandi`
            : "To'lovlar yangilandi"
        );
      }
    } catch {
      if (!silent) toast.error("Sinxronlash xatosi");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (loading || loadingContracts || autoSynced.current) return;
    if (data.length === 0 && contracts.length > 0) {
      autoSynced.current = true;
      void runSync(true);
    }
  }, [loading, loadingContracts, data.length, contracts.length]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const total = useMemo(
    () => data.reduce((s, p) => s + (p.amount || 0), 0),
    [data]
  );

  const thisMonth = useMemo(() => {
    const now = new Date();
    return data
      .filter((p) => {
        const d = new Date(p.date);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((s, p) => s + (p.amount || 0), 0);
  }, [data]);

  const expectedThisMonth = useMemo(
    () =>
      contracts
        .filter((c) => c.status === "active" && (c.monthlyPayment ?? 0) > 0)
        .reduce((s, c) => s + (c.monthlyPayment ?? 0), 0),
    [contracts]
  );

  const displayTotal = total > 0 ? total : expectedThisMonth;
  const displayThisMonth = thisMonth > 0 ? thisMonth : expectedThisMonth;
  const displayCount =
    data.length > 0
      ? data.length
      : contracts.filter(
          (c) => c.status === "active" && (c.monthlyPayment ?? 0) > 0
        ).length;
  const usingExpected = data.length === 0 && expectedThisMonth > 0;

  const tableRows = useMemo(() => {
    if (data.length > 0) return data;
    return contracts
      .filter((c) => c.status === "active" && (c.monthlyPayment ?? 0) > 0)
      .map((c) => ({
        id: `expected-${c.id}`,
        contractId: c.id,
        tenantName: c.tenantName,
        propertyName: c.propertyName,
        amount: c.monthlyPayment,
        date: new Date().toISOString(),
        method: "cash" as const,
        note: "Kutilayotgan (shartnoma)",
        createdAt: c.createdAt ?? new Date().toISOString(),
      }));
  }, [data, contracts]);

  const {
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total: count,
    paged,
  } = useTableData<Payment>({
    data: tableRows,
    searchFields: ["tenantName", "propertyName", "note"],
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
        description="Barcha kirim to'lovlarini kuzating."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => runSync()}
              disabled={syncing || loading || loadingContracts}
            >
              <RefreshCw
                className={`mr-1.5 size-4 ${syncing ? "animate-spin" : ""}`}
              />
              Shartnomalardan yuklash
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> To&apos;lov qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Jami tushum"
          value={formatCurrency(displayTotal)}
          icon={Banknote}
          tone="primary"
          loading={loading || loadingContracts}
          subtitle={
            usingExpected ? "Kutilayotgan ijara (shartnomalar)" : undefined
          }
        />
        <StatCard
          title="Bu oy"
          value={formatCurrency(displayThisMonth)}
          icon={Banknote}
          tone="blue"
          loading={loading || loadingContracts}
          index={1}
          subtitle={
            usingExpected ? "Kutilayotgan ijara (shartnomalar)" : undefined
          }
        />
        <StatCard
          title="Tranzaksiyalar"
          value={String(displayCount)}
          icon={Banknote}
          tone="violet"
          loading={loading || loadingContracts}
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
          {loading || loadingContracts ? (
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
                description="Avval shartnoma yarating yoki to'lov qo'shing."
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
                {paged.map((p) => {
                  const isExpected = p.id.startsWith("expected-");
                  return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.tenantName ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {p.propertyName ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(p.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isExpected ? "outline" : "secondary"}>
                        {isExpected
                          ? "Kutilmoqda"
                          : PAYMENT_METHOD_MAP[p.method]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell>
                      {!isExpected && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(p);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" /> Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(p.id)}
                          >
                            <Trash2 className="size-4" /> O&apos;chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
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
