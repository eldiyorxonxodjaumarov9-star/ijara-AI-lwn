"use client";

import { useState } from "react";
import Link from "next/link";
import { Car, CircleCheck, KeyRound, MoreVertical, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import "@/components/dashboard/dashboard.css";
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
import { VehicleDialog } from "@/components/vehicles/vehicle-dialog";
import { useAuth } from "@/context/auth-context";
import { useVehicles } from "@/hooks/use-vehicles";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import {
  countVehicleInventory,
  VEHICLE_STATUS_LABELS,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/vehicles";

const STATUS_VARIANT: Record<VehicleStatus, "success" | "secondary" | "warning" | "outline"> = {
  AVAILABLE: "success",
  RENTED: "secondary",
  MAINTENANCE: "warning",
  INACTIVE: "outline",
};

export default function VehiclesPage() {
  const { workspace, workspaceLoading } = useAuth();
  const isCarRental = workspace?.industry === "CAR_RENTAL";
  const { vehicles, loading, error, reload } = useVehicles(isCarRental);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (workspaceLoading && !workspace) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isCarRental) {
    return (
      <EmptyState
        icon={Car}
        title="Bu bo‘lim mavjud emas"
        description="Avtomobillar bo‘limi faqat avtomobil ijarasi biznesi uchun."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Bosh sahifaga qaytish</Link>
          </Button>
        }
      />
    );
  }

  const stats = countVehicleInventory(vehicles);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/vehicles/${deleteId}`, { method: "DELETE" });
      toast.success("Avtomobil o‘chirildi");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O‘chirish xatosi");
    } finally {
      setDeleteId(null);
    }
  };

  const actions = (vehicle: Vehicle) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Amallar">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openEdit(vehicle)}>
          <Pencil className="size-4" /> Tahrirlash
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setDeleteId(vehicle.id)}
        >
          <Trash2 className="size-4" /> O‘chirish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const statusBadge = (status: VehicleStatus) => (
    <Badge variant={STATUS_VARIANT[status]}>{VEHICLE_STATUS_LABELS[status]}</Badge>
  );

  const activeRentalLine = (vehicle: Vehicle) =>
    vehicle.activeRental ? (
      <p className="mt-1 text-xs text-muted-foreground">
        {vehicle.activeRental.customerName} • qaytarish {formatDate(vehicle.activeRental.endDate)}
      </p>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avtomobillar"
        description="Ijara parkidagi avtomobillarni boshqaring"
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Avtomobil qo‘shish
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DashboardKpiCard index={0} title="Jami avtomobillar" value={String(stats.total)} icon={Car} tone="blue" loading={loading} />
        <DashboardKpiCard index={1} title="Bo‘sh" value={String(stats.available)} icon={CircleCheck} tone="cyan" loading={loading} />
        <DashboardKpiCard index={2} title="Ijarada" value={String(stats.rented)} icon={KeyRound} tone="blue" loading={loading} />
        <DashboardKpiCard index={3} title="Texnik xizmatda" value={String(stats.maintenance)} icon={Wrench} tone="amber" loading={loading} />
      </div>

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
          ) : vehicles.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Car}
                title="Hali avtomobil qo‘shilmagan"
                description="Ijara parkingizdagi birinchi avtomobilni qo‘shing."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="size-4" /> Avtomobil qo‘shish
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
                      <TableHead>Davlat raqami</TableHead>
                      <TableHead>Yili</TableHead>
                      <TableHead>Kunlik narx</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Probeg</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Amallar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          <p className="font-medium">{vehicle.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.brand} {vehicle.model}
                            {vehicle.color ? ` • ${vehicle.color}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono">{vehicle.plateNumber}</TableCell>
                        <TableCell>{vehicle.year}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {formatCurrency(vehicle.dailyRate)}
                        </TableCell>
                        <TableCell>
                          {statusBadge(vehicle.status)}
                          {activeRentalLine(vehicle)}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                          {formatNumber(vehicle.mileage)} km
                        </TableCell>
                        <TableCell>{actions(vehicle)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y divide-border md:hidden">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{vehicle.name}</p>
                        {statusBadge(vehicle.status)}
                      </div>
                      <p className="font-mono text-sm">{vehicle.plateNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.year} • {formatNumber(vehicle.mileage)} km •{" "}
                        {formatCurrency(vehicle.dailyRate)} / kun
                      </p>
                      {activeRentalLine(vehicle)}
                    </div>
                    {actions(vehicle)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <VehicleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={editing}
        onSaved={reload}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Avtomobilni o‘chirish"
        description="Avtomobil ro‘yxatdan butunlay o‘chiriladi."
        confirmText="O‘chirish"
        onConfirm={handleDelete}
      />
    </div>
  );
}
