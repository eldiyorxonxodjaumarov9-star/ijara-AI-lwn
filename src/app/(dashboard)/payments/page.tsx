"use client";

import { useMemo, useState } from "react";
import {
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
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import type { Payment } from "@/types";

export default function PaymentsPage() {
  const { data, loading } = useCollection<Payment>("payments");
  const { remove } = useCollectionActions<Payment>("payments");

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

  const {
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total: count,
    paged,
  } = useTableData<Payment>({
    data,
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
          title="Tranzaksiyalar"
          value={String(data.length)}
          icon={Banknote}
          tone="violet"
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
                {paged.map((p) => (
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
                      <Badge variant="secondary">
                        {PAYMENT_METHOD_MAP[p.method]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(p.amount)}
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
