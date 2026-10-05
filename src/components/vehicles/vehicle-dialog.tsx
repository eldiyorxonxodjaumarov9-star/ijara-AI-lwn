"use client";

import { useState, type FormEvent } from "react";
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
import {
  parseVehicleInput,
  VEHICLE_MIN_YEAR,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUSES,
  vehicleMaxYear,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/vehicles";

type FormState = {
  name: string;
  brand: string;
  model: string;
  year: string;
  plateNumber: string;
  color: string;
  vin: string;
  mileage: string;
  dailyRate: number;
  status: VehicleStatus;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  brand: "",
  model: "",
  year: String(new Date().getFullYear()),
  plateNumber: "",
  color: "",
  vin: "",
  mileage: "0",
  dailyRate: 0,
  status: "AVAILABLE",
  notes: "",
});

const fromVehicle = (v: Vehicle): FormState => ({
  name: v.name,
  brand: v.brand,
  model: v.model,
  year: String(v.year),
  plateNumber: v.plateNumber,
  color: v.color ?? "",
  vin: v.vin ?? "",
  mileage: String(v.mileage),
  dailyRate: v.dailyRate,
  status: v.status,
  notes: v.notes ?? "",
});

export function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset when the dialog opens or its target changes (state adjusted during render, not in an effect).
  const resetTarget = open ? (vehicle ?? "new") : null;
  const [resetFor, setResetFor] = useState<typeof resetTarget>(null);
  if (resetTarget !== resetFor) {
    setResetFor(resetTarget);
    if (open) {
      setForm(vehicle ? fromVehicle(vehicle) : emptyForm());
      setError(null);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseVehicleInput(form);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (vehicle) {
        await apiFetch(`/vehicles/${vehicle.id}`, { method: "PATCH", body: parsed.data });
        toast.success("Avtomobil yangilandi");
      } else {
        await apiFetch("/vehicles", { method: "POST", body: parsed.data });
        toast.success("Avtomobil qo‘shildi");
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
          <DialogTitle>{vehicle ? "Avtomobilni tahrirlash" : "Avtomobil qo‘shish"}</DialogTitle>
          <DialogDescription>Ijara parkidagi avtomobil ma’lumotlari.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="vehicle-name">Nomi</Label>
              <Input
                id="vehicle-name"
                placeholder="Masalan: Oq Cobalt"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-brand">Marka *</Label>
              <Input
                id="vehicle-brand"
                placeholder="Chevrolet"
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-model">Model *</Label>
              <Input
                id="vehicle-model"
                placeholder="Cobalt"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-year">Yili *</Label>
              <Input
                id="vehicle-year"
                type="number"
                inputMode="numeric"
                min={VEHICLE_MIN_YEAR}
                max={vehicleMaxYear()}
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-plate">Davlat raqami *</Label>
              <Input
                id="vehicle-plate"
                placeholder="01 A 123 BC"
                value={form.plateNumber}
                onChange={(e) => set("plateNumber", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-color">Rangi</Label>
              <Input
                id="vehicle-color"
                placeholder="Oq"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-vin">VIN</Label>
              <Input
                id="vehicle-vin"
                value={form.vin}
                onChange={(e) => set("vin", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-mileage">Probeg (km)</Label>
              <Input
                id="vehicle-mileage"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.mileage}
                onChange={(e) => set("mileage", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kunlik ijara narxi (so&apos;m)</Label>
              <MoneyInput value={form.dailyRate} onChange={(v) => set("dailyRate", v)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as VehicleStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status} disabled={status === "RENTED"}>
                      {VEHICLE_STATUS_LABELS[status]}
                      {status === "RENTED" ? " (ijaradan avtomatik)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="vehicle-notes">Izoh</Label>
              <Textarea
                id="vehicle-notes"
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
              {vehicle ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
