"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Building2,
  MapPin,
  Maximize,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { formatCurrency } from "@/lib/utils";
import { PROPERTY_STATUS_MAP } from "@/lib/constants";
import type { Property } from "@/types";

export default function PropertiesPage() {
  const { data, loading } = useCollection<Property>("properties");
  const { remove } = useCollectionActions<Property>("properties");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredByStatus = useMemo(
    () =>
      statusFilter === "all"
        ? data
        : data.filter((p) => p.status === statusFilter),
    [data, statusFilter]
  );

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<Property>({
      data: filteredByStatus,
      searchFields: ["name", "address", "region", "district"],
      pageSize: 9,
    });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (property: Property) => {
    setEditing(property);
    setDialogOpen(true);
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    toast.success("Mulk o'chirildi");
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aktivlar"
        description="Barcha ko'chmas mulklaringizni boshqaring."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Mulk qo&apos;shish
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nomi, manzil bo'yicha qidirish..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            {Object.entries(PROPERTY_STATUS_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>
                {val.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Mulklar topilmadi"
          description="Birinchi mulkingizni qo'shing yoki qidiruvni o'zgartiring."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Mulk qo&apos;shish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((property, index) => {
            const status = PROPERTY_STATUS_MAP[property.status];
            return (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <Card className="group overflow-hidden">
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {property.images?.[0] ? (
                      <Image
                        src={property.images[0]}
                        alt={property.name}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Building2 className="size-10 text-muted-foreground/40" />
                      </div>
                    )}
                    <Badge
                      variant={status.variant}
                      className="absolute left-3 top-3 shadow-sm"
                    >
                      {status.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute right-3 top-3 size-8 shadow-sm"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(property)}>
                          <Pencil className="size-4" /> Tahrirlash
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(property.id)}
                        >
                          <Trash2 className="size-4" /> O&apos;chirish
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="truncate font-semibold">{property.name}</h3>
                    <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      {property.district}, {property.region}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3.5" /> {property.rooms} xona
                      </span>
                      <span className="flex items-center gap-1">
                        <Maximize className="size-3.5" /> {property.area} m²
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(property.price)}
                      </span>
                      <span className="text-xs text-muted-foreground">/oy</span>
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

      <PropertyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        property={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Mulkni o'chirish"
        description="Ushbu mulk butunlay o'chiriladi. Davom etasizmi?"
        onConfirm={handleDelete}
      />
    </div>
  );
}
