"use client";

import { useState } from "react";
import Image from "next/image";
import {
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MaintenanceDialog } from "@/components/maintenance/maintenance-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MAINTENANCE_STATUS_MAP } from "@/lib/constants";
import type { Maintenance } from "@/types";

export default function MaintenancePage() {
  const { data, loading } = useCollection<Maintenance>("maintenance");
  const { remove } = useCollectionActions<Maintenance>("maintenance");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<Maintenance>({
      data,
      searchFields: ["propertyName", "issue", "status"],
      pageSize: 8,
    });

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    toast.success("Yozuv o'chirildi");
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ta'mirlash"
        description="Mulklardagi ta'mirlash ishlarini kuzating."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> Ta&apos;mirlash qo&apos;shish
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Mulk yoki muammo bo'yicha..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Ta'mirlash ishlari yo'q"
          description="Birinchi ta'mirlash yozuvini qo'shing."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {paged.map((m, index) => {
            const status = MAINTENANCE_STATUS_MAP[m.status];
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold">
                            {m.propertyName ?? "Mulk"}
                          </h3>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {m.issue}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(m);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" /> Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(m.id)}
                          >
                            <Trash2 className="size-4" /> O&apos;chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {m.images?.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {m.images.slice(0, 4).map((url) => (
                          <div
                            key={url}
                            className="relative size-14 overflow-hidden rounded-lg border"
                          >
                            <Image
                              src={url}
                              alt="rasm"
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                      <span className="text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(m.cost)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      <MaintenanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Yozuvni o'chirish"
        onConfirm={handleDelete}
      />
    </div>
  );
}
