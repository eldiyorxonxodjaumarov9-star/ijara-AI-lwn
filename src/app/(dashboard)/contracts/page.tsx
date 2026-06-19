"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
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
import { ContractDialog } from "@/components/contracts/contract-dialog";
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
import { syncContractsFromTenantsApi } from "@/lib/contract-sync";
import { syncPaymentsFromContractsApi } from "@/lib/payment-sync";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CONTRACT_STATUS_MAP } from "@/lib/constants";
import { generateContractPdf } from "@/lib/pdf";
import type { Contract } from "@/types";

export default function ContractsPage() {
  const { data, loading, api } = useCollection<Contract>("contracts");
  const { remove } = useCollectionActions<Contract>("contracts");
  const [syncing, setSyncing] = useState(false);
  const autoSynced = useRef(false);

  const runSync = async (silent = false) => {
    if (!isApiConfigured) return;
    setSyncing(true);
    try {
      const count = await syncContractsFromTenantsApi();
      await syncPaymentsFromContractsApi();
      await api.list();
      if (!silent) {
        toast.success(
          count > 0
            ? `${count} ta shartnoma arendatorlardan yuklandi`
            : "Shartnomalar yangilandi"
        );
      }
    } catch {
      if (!silent) toast.error("Sinxronlash xatosi");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!isApiConfigured || loading || autoSynced.current) return;
    if (data.length === 0) {
      autoSynced.current = true;
      void runSync(true);
    }
  }, [loading, data.length]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<Contract>({
      data,
      searchFields: ["propertyName", "tenantName", "status"],
      pageSize: 10,
    });

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    toast.success("Shartnoma o'chirildi");
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shartnomalar"
        description="Ijara shartnomalarini boshqaring va PDF yarating."
        action={
          <div className="flex flex-wrap gap-2">
            {isApiConfigured && (
              <Button
                variant="outline"
                onClick={() => runSync()}
                disabled={syncing || loading}
              >
                <RefreshCw
                  className={`mr-1.5 size-4 ${syncing ? "animate-spin" : ""}`}
                />
                Arendatorlardan yuklash
              </Button>
            )}
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> Shartnoma
            </Button>
          </div>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Mulk yoki arendator bo'yicha..."
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
                icon={FileText}
                title="Shartnomalar yo'q"
                description="Birinchi shartnomangizni yarating."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mulk</TableHead>
                  <TableHead>Arendator</TableHead>
                  <TableHead className="hidden md:table-cell">Muddat</TableHead>
                  <TableHead>Oylik</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c) => {
                  const status = CONTRACT_STATUS_MAP[c.status];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.propertyName ?? "—"}
                      </TableCell>
                      <TableCell>{c.tenantName ?? "—"}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                        {formatDate(c.startDate)} — {formatDate(c.endDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(c.monthlyPayment)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
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
                              onClick={() => generateContractPdf(c)}
                            >
                              <Download className="size-4" /> PDF yuklab olish
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(c);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-4" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(c.id)}
                            >
                              <Trash2 className="size-4" /> O&apos;chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        total={total}
        onPageChange={setPage}
      />

      <ContractDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contract={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Shartnomani o'chirish"
        onConfirm={handleDelete}
      />
    </div>
  );
}
