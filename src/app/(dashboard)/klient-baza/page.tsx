"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Search, UserRound } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableData } from "@/hooks/use-table-data";
import { fetchTenantArchives } from "@/lib/tenant-archives-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TenantArchive } from "@/types";

export default function KlientBazaPage() {
  const [rows, setRows] = useState<TenantArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TenantArchive | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchTenantArchives());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<TenantArchive>({
      data: rows,
      searchFields: [
        "clientNumber",
        "fullName",
        "phone",
        "propertyName",
        "passport",
      ],
      pageSize: 12,
    });

  const totalPaidAll = useMemo(
    () => rows.reduce((s, r) => s + (r.totalPaid || 0), 0),
    [rows]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klient bazasi"
        description="Chiqib ketgan klientlar tarixi — to'lovlar, xona va shartnoma ma'lumotlari saqlanadi."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Jami arxiv</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Jami to&apos;langan</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totalPaidAll)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Eslatma</p>
            <p className="text-sm">
              Klient chiqsa pul kamaymaydi — barcha to&apos;lovlar saqlanadi.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Raqam, ism, telefon yoki xona..."
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
                icon={Archive}
                title="Arxiv bo'sh"
                description="Arendator xonadan chiqganda ma'lumotlari shu yerda saqlanadi."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>F.I.O</TableHead>
                  <TableHead>Xona</TableHead>
                  <TableHead className="hidden md:table-cell">Kirish</TableHead>
                  <TableHead className="hidden md:table-cell">Chiqish</TableHead>
                  <TableHead className="hidden lg:table-cell">Shartnoma</TableHead>
                  <TableHead>To&apos;langan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(row)}
                  >
                    <TableCell>
                      <Badge variant="outline">{row.clientNumber}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.fullName}</TableCell>
                    <TableCell>{row.propertyName}</TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell text-muted-foreground">
                      {row.entryDate ? formatDate(row.entryDate) : "—"}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell text-muted-foreground">
                      {formatDate(row.leaveDate)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {row.contractDuration
                        ? `${row.contractDuration} oy`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(row.totalPaid)}
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
        total={total}
        onPageChange={setPage}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-5" />
              {selected?.fullName}
            </DialogTitle>
            <DialogDescription>
              Klient raqami: {selected?.clientNumber}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Telefon</dt>
                <dd className="font-medium">{selected.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pasport</dt>
                <dd className="font-medium">{selected.passport ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Xona</dt>
                <dd className="font-medium">{selected.propertyName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Oylik ijara</dt>
                <dd className="font-medium">
                  {formatCurrency(selected.monthlyRent)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Kirish sanasi</dt>
                <dd className="font-medium">
                  {selected.entryDate ? formatDate(selected.entryDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chiqish sanasi</dt>
                <dd className="font-medium">{formatDate(selected.leaveDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shartnoma boshlanishi</dt>
                <dd className="font-medium">
                  {formatDate(selected.contractStart)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shartnoma tugashi</dt>
                <dd className="font-medium">
                  {formatDate(selected.contractEnd)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shartnoma muddati</dt>
                <dd className="font-medium">
                  {selected.contractDuration
                    ? `${selected.contractDuration} oy`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Depozit</dt>
                <dd className="font-medium">
                  {selected.depositPaid
                    ? `✅ ${formatCurrency(selected.deposit)}`
                    : "Berilmagan"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">To&apos;lovlar soni</dt>
                <dd className="font-medium">{selected.paymentCount} ta</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Jami to&apos;langan</dt>
                <dd className="text-lg font-bold text-primary">
                  {formatCurrency(selected.totalPaid)}
                </dd>
              </div>
              {selected.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Izoh</dt>
                  <dd>{selected.notes}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
