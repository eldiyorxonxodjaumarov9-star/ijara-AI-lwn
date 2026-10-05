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
import {
  addDays,
  bookingNights,
  bookingTotal,
  parseBookingInput,
  parseBookingUpdate,
  tashkentToday,
  type Booking,
  type BookingInput,
} from "@/lib/bookings";
import { formatCurrency } from "@/lib/utils";
import type { Property, Tenant } from "@/types";

type FormState = {
  propertyId: string;
  tenantId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  nightlyRate: number;
  status: BookingInput["status"];
  notes: string;
};

const emptyForm = (): FormState => {
  const today = tashkentToday();
  return {
    propertyId: "",
    tenantId: "",
    checkInDate: today,
    checkOutDate: addDays(today, 1),
    guestCount: 1,
    nightlyRate: 0,
    status: "CONFIRMED",
    notes: "",
  };
};

export function BookingDialog({
  open,
  onOpenChange,
  booking,
  bookings,
  properties,
  guests,
  terms,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  /** Used only to suggest the last nightly rate of the chosen unit. */
  bookings: Booking[];
  properties: Property[];
  guests: Tenant[];
  terms: { unit: string; guest: string };
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset when the dialog opens or its target changes (state adjusted during render, not in an effect).
  const resetTarget = open ? (booking ?? "new") : null;
  const [resetFor, setResetFor] = useState<typeof resetTarget>(null);
  if (resetTarget !== resetFor) {
    setResetFor(resetTarget);
    if (open) {
      setError(null);
      setForm(
        booking
          ? {
              propertyId: booking.propertyId,
              tenantId: booking.tenantId,
              checkInDate: booking.checkInDate,
              checkOutDate: booking.checkOutDate,
              guestCount: booking.guestCount,
              nightlyRate: booking.nightlyRate,
              status: "CONFIRMED",
              notes: booking.notes ?? "",
            }
          : emptyForm()
      );
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Property.rentPrice is a monthly lease price, so it is never used as a nightly default.
  const selectProperty = (propertyId: string) => {
    const last = bookings.find((b) => b.propertyId === propertyId);
    setForm((prev) => ({
      ...prev,
      propertyId,
      nightlyRate: prev.nightlyRate > 0 ? prev.nightlyRate : (last?.nightlyRate ?? 0),
    }));
  };

  const nights = bookingNights(form.checkInDate, form.checkOutDate);
  const total = nights && form.nightlyRate > 0 ? bookingTotal(nights, form.nightlyRate) : 0;
  const activeGuests = useMemo(
    () => guests.filter((g) => !g.leftAt || g.id === booking?.tenantId),
    [guests, booking]
  );
  const unitLower = terms.unit.toLowerCase();
  const guestLower = terms.guest.toLowerCase();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = booking
      ? parseBookingUpdate({
          tenantId: form.tenantId,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          guestCount: form.guestCount,
          nightlyRate: form.nightlyRate,
          notes: form.notes,
        })
      : parseBookingInput(form);
    if (parsed.error !== undefined) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (booking) {
        await apiFetch(`/bookings/${booking.id}`, { method: "PATCH", body: parsed.data });
        toast.success("Bron yangilandi");
      } else {
        await apiFetch("/bookings", { method: "POST", body: parsed.data });
        toast.success("Bron yaratildi");
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
          <DialogTitle>{booking ? "Bronni tahrirlash" : "Bron yaratish"}</DialogTitle>
          <DialogDescription>
            Narx: tunlar soni × tunlik narx. Chiqish kuni hisoblanmaydi (10 → 11 = 1 tun).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{terms.unit} *</Label>
              <Select value={form.propertyId} onValueChange={selectProperty} disabled={!!booking}>
                <SelectTrigger aria-label={terms.unit}>
                  <SelectValue placeholder={`${terms.unit}ni tanlang`} />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      disabled={p.status === "maintenance" && p.id !== booking?.propertyId}
                    >
                      {p.name}
                      {p.status === "maintenance" ? " (ta’mirda)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{terms.guest} *</Label>
              <Select value={form.tenantId} onValueChange={(v) => set("tenantId", v)}>
                <SelectTrigger aria-label={terms.guest}>
                  <SelectValue placeholder={`${terms.guest}ni tanlang`} />
                </SelectTrigger>
                <SelectContent>
                  {activeGuests.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-check-in">Kirish sanasi *</Label>
              <Input
                id="booking-check-in"
                type="date"
                value={form.checkInDate}
                onChange={(e) => set("checkInDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-check-out">Chiqish sanasi *</Label>
              <Input
                id="booking-check-out"
                type="date"
                min={form.checkInDate ? addDaysSafe(form.checkInDate) : undefined}
                value={form.checkOutDate}
                onChange={(e) => set("checkOutDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-guests">Mehmonlar soni *</Label>
              <Input
                id="booking-guests"
                type="number"
                min={1}
                value={form.guestCount}
                onChange={(e) => set("guestCount", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tunlik narx (so&apos;m) *</Label>
              <MoneyInput value={form.nightlyRate} onChange={(v) => set("nightlyRate", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jami</Label>
              <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-semibold">
                {formatCurrency(total)}
              </div>
              <p className="text-xs text-muted-foreground">
                {nights
                  ? `${nights} tun × ${formatCurrency(form.nightlyRate)}`
                  : "Chiqish sanasi kirishdan keyin bo‘lsin"}
              </p>
            </div>
            {!booking && (
              <div className="space-y-1.5">
                <Label>Holat</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as FormState["status"])}>
                  <SelectTrigger aria-label="Holat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONFIRMED">Tasdiqlangan</SelectItem>
                    <SelectItem value="PENDING">Kutilmoqda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="booking-notes">Izoh</Label>
              <Textarea
                id="booking-notes"
                rows={3}
                placeholder={`${terms.guest} yoki ${unitLower} haqida qo‘shimcha ma’lumot`}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          {activeGuests.length === 0 && (
            <p className="text-xs text-muted-foreground">Avval {guestLower} qo‘shing.</p>
          )}
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
              {booking ? "Saqlash" : "Bron yaratish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function addDaysSafe(date: string) {
  try {
    return addDays(date, 1);
  } catch {
    return undefined;
  }
}
