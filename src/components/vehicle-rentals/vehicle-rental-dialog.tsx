"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import {
  addDays,
  parseRentalInput,
  parseRentalUpdate,
  rentalDays,
  rentalTotal,
  tashkentToday,
  type VehicleRental,
} from "@/lib/vehicle-rentals";
import { VEHICLE_STATUS_LABELS, type Vehicle } from "@/lib/vehicles";
import type { Tenant } from "@/types";

type FormState = {
  vehicleId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  notes: string;
};

const emptyForm = (): FormState => {
  const today = tashkentToday();
  return { vehicleId: "", tenantId: "", startDate: today, endDate: addDays(today, 2), dailyRate: 0, notes: "" };
};

const isRentable = (v: Vehicle) => v.status === "AVAILABLE" || v.status === "RENTED";

export function VehicleRentalDialog({
  open,
  onOpenChange,
  rental,
  vehicles,
  customers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: VehicleRental | null;
  vehicles: Vehicle[];
  customers: Tenant[];
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset when the dialog opens or its target changes (state adjusted during render, not in an effect).
  const resetTarget = open ? (rental ?? "new") : null;
  const [resetFor, setResetFor] = useState<typeof resetTarget>(null);
  if (resetTarget !== resetFor) {
    setResetFor(resetTarget);
    if (open) {
      setError(null);
      setForm(
        rental
          ? {
              vehicleId: rental.vehicleId,
              tenantId: rental.tenantId,
              startDate: rental.startDate,
              endDate: rental.endDate,
              dailyRate: rental.dailyRate,
              notes: rental.notes ?? "",
            }
          : emptyForm()
      );
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectVehicle = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    setForm((prev) => ({ ...prev, vehicleId, dailyRate: vehicle?.dailyRate ?? prev.dailyRate }));
  };

  const days = rentalDays(form.startDate, form.endDate);
  const total = days && form.dailyRate > 0 ? rentalTotal(days, form.dailyRate) : 0;
  const activeCustomers = useMemo(
    () => customers.filter((c) => !c.leftAt || c.id === rental?.tenantId),
    [customers, rental]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = rental
      ? parseRentalUpdate({
          tenantId: form.tenantId,
          startDate: form.startDate,
          endDate: form.endDate,
          dailyRate: form.dailyRate,
          notes: form.notes,
        })
      : parseRentalInput(form);
    if (parsed.error !== undefined) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (rental) {
        await apiFetch(`/vehicle-rentals/${rental.id}`, { method: "PATCH", body: parsed.data });
        toast.success("Ijara yangilandi");
      } else {
        await apiFetch("/vehicle-rentals", { method: "POST", body: parsed.data });
        toast.success("Ijara yaratildi");
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rental ? "Ijarani tahrirlash" : "Ijara yaratish"}</DialogTitle>
          <DialogDescription>
            Narx: kunlar soni × kunlik narx. Boshlanish va tugash kunlari ham hisoblanadi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Avtomobil *</Label>
              <Select value={form.vehicleId} onValueChange={selectVehicle} disabled={!!rental}>
                <SelectTrigger aria-label="Avtomobil">
                  <SelectValue placeholder="Avtomobilni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id} disabled={!isRentable(v) && v.id !== rental?.vehicleId}>
                      {v.name} • {v.plateNumber}
                      {!isRentable(v) ? ` (${VEHICLE_STATUS_LABELS[v.status]})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mijoz *</Label>
              <Select value={form.tenantId} onValueChange={(v) => set("tenantId", v)}>
                <SelectTrigger aria-label="Mijoz">
                  <SelectValue placeholder="Mijozni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {activeCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rental-start">Boshlanish sanasi *</Label>
              <Input
                id="rental-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rental-end">Tugash sanasi *</Label>
              <Input
                id="rental-end"
                type="date"
                min={form.startDate}
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kunlik narx (so&apos;m) *</Label>
              <MoneyInput value={form.dailyRate} onChange={(v) => set("dailyRate", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jami summa</Label>
              <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-semibold">
                {formatCurrency(total)}
              </div>
              <p className="text-xs text-muted-foreground">
                {days ? `${days} kun × ${formatCurrency(form.dailyRate)}` : "Sanalarni to‘g‘ri tanlang"}
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rental-notes">Izoh</Label>
              <Textarea
                id="rental-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {rental ? "Saqlash" : "Ijara yaratish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
