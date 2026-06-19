"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  DoorOpen,
  Maximize,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { LwnRoomDialog } from "@/components/lwn/lwn-room-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { PROPERTY_STATUS_MAP } from "@/lib/constants";
import { filterLwnRooms } from "@/lib/lwn-rooms";
import { getTenantRoomMaps } from "@/lib/tenant-room-assign";
import { formatCurrency } from "@/lib/utils";
import type { Contract, Property } from "@/types";

export default function LwnRoomsPage() {
  const { data, loading } = useCollection<Property>("properties");
  const { data: contracts } = useCollection<Contract>("contracts");
  const { remove } = useCollectionActions<Property>("properties");

  const { byProperty: tenantByRoom } = useMemo(
    () => getTenantRoomMaps(contracts),
    [contracts]
  );

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const lwnRooms = useMemo(() => filterLwnRooms(data), [data]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? lwnRooms
        : lwnRooms.filter((r) => r.status === statusFilter),
    [lwnRooms, statusFilter]
  );

  const vacant = lwnRooms.filter((r) => r.status === "available").length;
  const rented = lwnRooms.filter((r) => r.status === "rented").length;

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<Property>({
      data: filtered,
      searchFields: ["name"],
      pageSize: 12,
    });

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    toast.success("Xona o'chirildi");
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="LWN xonalar"
        description="Live Work Network xonalarini boshqaring: narx, kv, holat va rasm."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> Xona qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Jami xonalar"
          value={String(lwnRooms.length)}
          icon={DoorOpen}
          tone="primary"
          loading={loading}
        />
        <StatCard
          title="Bo'sh xonalar"
          value={String(vacant)}
          icon={DoorOpen}
          tone="blue"
          loading={loading}
          index={1}
        />
        <StatCard
          title="Band xonalar"
          value={String(rented)}
          icon={DoorOpen}
          tone="amber"
          loading={loading}
          index={2}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Xona raqami bo'yicha qidirish..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barchasi</SelectItem>
            {Object.entries(PROPERTY_STATUS_MAP).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={DoorOpen}
                title="Xonalar yo'q"
                description="Birinchi LWN xonasini qo'shing."
                action={
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" /> Xona qo&apos;shish
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rasm</TableHead>
                  <TableHead>Xona</TableHead>
                  <TableHead className="hidden lg:table-cell">Arendator</TableHead>
                  <TableHead className="hidden md:table-cell">Narx</TableHead>
                  <TableHead className="hidden sm:table-cell">Kv (m²)</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((room) => {
                  const status = PROPERTY_STATUS_MAP[room.status];
                  return (
                    <TableRow key={room.id}>
                      <TableCell>
                        <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                          {room.images[0] ? (
                            <Image
                              src={room.images[0]}
                              alt={room.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center">
                              <DoorOpen className="size-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{room.name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">
                          {formatCurrency(room.price)} · {room.area} m²
                        </p>
                        <p className="text-xs text-muted-foreground lg:hidden">
                          {tenantByRoom.get(room.id) ?? "Bo'sh"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {tenantByRoom.get(room.id) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-medium">
                        {formatCurrency(room.price)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Maximize className="size-3.5" />
                          {room.area} m²
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status?.variant}>{status?.label}</Badge>
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
                                setEditing(room);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-4" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(room.id)}
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

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      )}

      <LwnRoomDialog open={dialogOpen} onOpenChange={setDialogOpen} room={editing} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Xonani o'chirish"
        onConfirm={handleDelete}
      />
    </div>
  );
}
