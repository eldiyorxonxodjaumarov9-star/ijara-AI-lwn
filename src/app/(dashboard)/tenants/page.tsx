"use client";

import { useMemo, useState } from "react";
import {
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SendPaymentRemindersButton } from "@/components/shared/send-payment-reminders-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TenantDialog } from "@/components/tenants/tenant-dialog";
import { TenantAssignDialog } from "@/components/tenants/tenant-assign-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
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
import { getTenantRoomMaps } from "@/lib/tenant-room-assign";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { deleteTenantWithLinkedClients } from "@/lib/tenant-client-sync";
import type { Contract, Tenant } from "@/types";

type TenantRow = Tenant & { assignedRoom: string };

export default function TenantsPage() {
  const { data, loading } = useCollection<Tenant>("tenants");
  const { data: contracts } = useCollection<Contract>("contracts");
  const { remove } = useCollectionActions<Tenant>("tenants");

  const { byTenant: roomByTenant } = useMemo(
    () => getTenantRoomMaps(contracts),
    [contracts]
  );

  const tenantsWithRoom = useMemo<TenantRow[]>(
    () =>
      data.map((t) => ({
        ...t,
        assignedRoom: roomByTenant.get(t.id) ?? "",
      })),
    [data, roomByTenant]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [assigning, setAssigning] = useState<Tenant | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<TenantRow>({
      data: tenantsWithRoom,
      searchFields: ["fullName", "phone", "assignedRoom"],
      pageSize: 10,
    });

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isApiConfigured) {
      await remove(deleteId);
      await refreshCollection("clients");
    } else {
      await deleteTenantWithLinkedClients(deleteId);
    }
    toast.success("Arendator o'chirildi");
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arendatorlar"
        description="Ijarachilar ro'yxati va ularning ma'lumotlari."
        action={
          <div className="flex flex-wrap gap-2">
            <SendPaymentRemindersButton variant="outline" />
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> Arendator qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Ism, telefon yoki xona bo'yicha..."
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
                icon={Users}
                title="Arendatorlar yo'q"
                description="Birinchi arendatorni qo'shing."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>F.I.O</TableHead>
                  <TableHead>Xona</TableHead>
                  <TableHead className="hidden md:table-cell">Telefon</TableHead>
                  <TableHead className="hidden lg:table-cell">Arenda kirish</TableHead>
                  <TableHead className="hidden lg:table-cell">To&apos;lov muddati</TableHead>
                  <TableHead className="hidden xl:table-cell">Shartnoma</TableHead>
                  <TableHead>Ijara</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setAssigning(tenant);
                      setAssignOpen(true);
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(tenant.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {tenant.fullName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground md:hidden">
                            {tenant.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.assignedRoom ? (
                        <Badge variant="secondary">{tenant.assignedRoom}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Biriktirilmagan
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {tenant.phone}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                      {tenant.entryDate ? formatDate(tenant.entryDate) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                      {tenant.paymentDueDate
                        ? formatDate(tenant.paymentDueDate)
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {tenant.contractDuration
                        ? `${tenant.contractDuration} oy`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(tenant.rentAmount)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setAssigning(tenant);
                              setAssignOpen(true);
                            }}
                          >
                            <Link2 className="size-4" /> Xonaga biriktirish
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(tenant);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" /> Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(tenant.id)}
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
        total={total}
        onPageChange={setPage}
      />

      <TenantDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={editing}
      />
      <TenantAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        tenant={assigning}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Arendatorni o'chirish"
        onConfirm={handleDelete}
      />
    </div>
  );
}
