"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, MoreVertical, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VehicleRentalDialog } from "@/components/vehicle-rentals/vehicle-rental-dialog";
import { useCollection } from "@/hooks/use-collection";
import { useVehicleRentals } from "@/hooks/use-vehicle-rentals";
import { useVehicles } from "@/hooks/use-vehicles";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  VEHICLE_RENTAL_STATUS_LABELS,
  type VehicleRental,
  type VehicleRentalStatus,
} from "@/lib/vehicle-rentals";
import type { Tenant } from "@/types";

const STATUS_VARIANT: Record<VehicleRentalStatus, "success" | "secondary" | "warning" | "outline"> = {
  PLANNED: "warning",
  ACTIVE: "success",
  COMPLETED: "secondary",
  CANCELLED: "outline",
};

type PendingAction = { rental: VehicleRental; kind: "complete" | "cancel" | "delete" };

const ACTION_COPY: Record<PendingAction["kind"], { title: string; description: string; confirm: string; toast: string }> = {
  complete: {
    title: "Ijarani yakunlash",
    description: "Avtomobil qaytarildi deb belgilanadi va boshqa faol ijara bo‘lmasa «Bo‘sh» holatiga o‘tadi.",
    confirm: "Yakunlash",
    toast: "Ijara yakunlandi",
  },
  cancel: {
    title: "Ijarani bekor qilish",
    description: "Ijara bekor qilinadi va avtomobil bu sanalar uchun bo‘shatiladi.",
    confirm: "Bekor qilish",
    toast: "Ijara bekor qilindi",
  },
  delete: {
    title: "Ijarani o‘chirish",
    description: "Ijara yozuvi butunlay o‘chiriladi.",
    confirm: "O‘chirish",
    toast: "Ijara o‘chirildi",
  },
};

/** CAR_RENTAL replacement for the property contracts table on /contracts. */
export function CarRentalsView() {
  const { rentals, loading, error, reload } = useVehicleRentals(true);
  const { vehicles, reload: reloadVehicles } = useVehicles(true);
  const { data: customers } = useCollection<Tenant>("tenants");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRental | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const refresh = async () => {
    await Promise.all([reload(), reloadVehicles()]);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const runPending = async () => {
    if (!pending) return;
    const { rental, kind } = pending;
    try {
      if (kind === "delete") {
        await apiFetch(`/vehicle-rentals/${rental.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/vehicle-rentals/${rental.id}`, {
          method: "PATCH",
          body: { status: kind === "complete" ? "COMPLETED" : "CANCELLED" },
        });
      }
      toast.success(ACTION_COPY[kind].toast);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setPending(null);
    }
  };

  const actions = (rental: VehicleRental) => {
    const open = rental.status === "PLANNED" || rental.status === "ACTIVE";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Amallar">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {open && (
            <DropdownMenuItem
              onClick={() => {
                setEditing(rental);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-4" /> Tahrirlash
            </DropdownMenuItem>
          )}
          {rental.status === "ACTIVE" && (
            <DropdownMenuItem onClick={() => setPending({ rental, kind: "complete" })}>
              <CheckCircle2 className="size-4" /> Yakunlash
            </DropdownMenuItem>
          )}
          {open && (
            <DropdownMenuItem onClick={() => setPending({ rental, kind: "cancel" })}>
              <XCircle className="size-4" /> Bekor qilish
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setPending({ rental, kind: "delete" })}
          >
            <Trash2 className="size-4" /> O‘chirish
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const statusBadge = (status: VehicleRentalStatus) => (
    <Badge variant={STATUS_VARIANT[status]}>{VEHICLE_RENTAL_STATUS_LABELS[status]}</Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ijaralar"
        description="Avtomobil ijaralari: kim, qaysi avtomobil, qachongacha va qancha."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Ijara yaratish
          </Button>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rentals.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={KeyRound}
                title="Hali ijara yo‘q"
                description="Avtomobil va mijozni tanlab birinchi ijarani yarating."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="size-4" /> Ijara yaratish
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Avtomobil</TableHead>
                      <TableHead>Mijoz</TableHead>
                      <TableHead>Boshlanish</TableHead>
                      <TableHead>Tugash</TableHead>
                      <TableHead className="hidden lg:table-cell">Kunlik narx</TableHead>
                      <TableHead>Jami</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Amallar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.map((rental) => (
                      <TableRow key={rental.id}>
                        <TableCell>
                          <p className="font-medium">{rental.vehicleName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{rental.plateNumber}</p>
                        </TableCell>
                        <TableCell>{rental.customerName}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(rental.startDate)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(rental.endDate)}</TableCell>
                        <TableCell className="hidden whitespace-nowrap lg:table-cell">
                          {formatCurrency(rental.dailyRate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {formatCurrency(rental.totalAmount)}
                          <p className="text-xs font-normal text-muted-foreground">{rental.days} kun</p>
                        </TableCell>
                        <TableCell>{statusBadge(rental.status)}</TableCell>
                        <TableCell>{actions(rental)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y divide-border md:hidden">
                {rentals.map((rental) => (
                  <li key={rental.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{rental.vehicleName}</p>
                        {statusBadge(rental.status)}
                      </div>
                      <p className="text-sm">{rental.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(rental.startDate)} – {formatDate(rental.endDate)} • {rental.days} kun
                      </p>
                      <p className="text-sm font-medium">
                        {formatCurrency(rental.totalAmount)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({formatCurrency(rental.dailyRate)} / kun)
                        </span>
                      </p>
                    </div>
                    {actions(rental)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <VehicleRentalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rental={editing}
        vehicles={vehicles}
        customers={customers}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? ACTION_COPY[pending.kind].title : undefined}
        description={pending ? ACTION_COPY[pending.kind].description : undefined}
        confirmText={pending ? ACTION_COPY[pending.kind].confirm : undefined}
        onConfirm={runPending}
      />
    </div>
  );
}
