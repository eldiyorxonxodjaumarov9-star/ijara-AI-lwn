"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookUser,
  FileDown,
  MoreVertical,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { refreshCollection } from "@/lib/data/store";
import { CLIENT_STATUS_MAP } from "@/lib/constants";
import { syncClientsFromTenants } from "@/lib/clients";
import { deleteClientWithLinkedTenant } from "@/lib/tenant-client-sync";
import { exportToPdf } from "@/lib/export";
import { formatDate } from "@/lib/utils";
import type { Client } from "@/types";

export default function ClientsPage() {
  const { data, loading, api } = useCollection<Client>("clients");
  const { remove } = useCollectionActions<Client>("clients");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const autoSynced = useRef(false);

  const runSync = async (silent = false) => {
    if (!isApiConfigured) return;
    setSyncing(true);
    try {
      const count = await syncClientsFromTenants();
      await api.list();
      if (!silent) {
        toast.success(
          count > 0
            ? `${count} ta klient arendatorlardan yuklandi`
            : "Klientlar yangilandi"
        );
      }
    } catch {
      if (!silent) toast.error("Sinxronlash xatosi");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!isApiConfigured || autoSynced.current) return;
    autoSynced.current = true;
    void runSync(true);
  }, [isApiConfigured]);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<Client>({
      data,
      searchFields: ["fullName", "phone"],
      pageSize: 10,
    });

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isApiConfigured) {
      await remove(deleteId);
      await refreshCollection("tenants");
    } else {
      await deleteClientWithLinkedTenant(deleteId);
    }
    toast.success("Klient o'chirildi");
    setDeleteId(null);
  };

  const exportPdf = () => {
    if (data.length === 0) {
      toast.error("Eksport qilish uchun ma'lumot yo'q");
      return;
    }
    exportToPdf({
      title: "Klientlar ro'yxati (CRM)",
      head: [
        "Ism familiya",
        "Telefon",
        "Holat",
        "Kirishlar",
        "Birinchi kirish",
        "Oxirgi kirish",
      ],
      body: data.map((c) => [
        c.fullName,
        c.phone,
        CLIENT_STATUS_MAP[c.status]?.label ?? c.status,
        String(c.loginCount ?? 1),
        formatDate(c.firstLoginAt),
        formatDate(c.lastLoginAt),
      ]),
      fileName: `klientlar-${new Date().toISOString().slice(0, 10)}`,
    });
    toast.success("PDF yuklab olindi");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klientlar"
        description="Arendatorlar bilan avtomatik sinxron. Qo'shilsa qo'shiladi, o'chirilsa o'chiriladi."
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
            <Button variant="outline" onClick={exportPdf} disabled={loading}>
              <FileDown className="mr-1.5 size-4" />
              PDF yuklab olish
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ism yoki telefon bo'yicha qidirish..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Jami: <span className="font-medium text-foreground">{total}</span>
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <EmptyState
              icon={BookUser}
              title="Klientlar yo'q"
              description="Ijarachi portaliga ism va telefon bilan kirganlar shu yerda ko'rinadi."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ism familiya</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-center">Kirishlar</TableHead>
                    <TableHead>Birinchi kirish</TableHead>
                    <TableHead>Oxirgi kirish</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((client) => {
                    const st = CLIENT_STATUS_MAP[client.status];
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.fullName}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`tel:${client.phone}`}
                            className="text-primary hover:underline"
                          >
                            {client.phone}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st?.variant}>{st?.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {client.loginCount ?? 1}
                        </TableCell>
                        <TableCell>{formatDate(client.firstLoginAt)}</TableCell>
                        <TableCell>{formatDate(client.lastLoginAt)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(client.id)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                O&apos;chirish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Klientni o'chirish"
        description="Bu yozuvni o'chirmoqchimisiz? Amal qaytarib bo'lmaydi."
        onConfirm={handleDelete}
      />
    </div>
  );
}
