"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { UzPhoneInput } from "@/components/shared/uz-phone-input";
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
  BLOCKING_BOOKING_STATUSES,
  bookingNights,
  bookingRangesOverlap,
  bookingTotal,
  tashkentToday,
  type Booking,
} from "@/lib/bookings";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import { parseHotelGuestInput, parseHotelGuestUpdate, type HotelGuestRow } from "@/lib/hotel-guests";
import { getPaymentSummary, PAYMENT_SUMMARY_LABELS, SOURCE_PAYMENT_METHODS, type SourcePaymentMethod } from "@/lib/source-payments";
import { UZ_PHONE_PATTERN } from "@/lib/uz-phone";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethod, Property } from "@/types";

type FormState = {
  fullName: string;
  phone: string;
  propertyId: string;
  guestCount: string;
  checkInDate: string;
  checkOutDate: string;
  nightlyRate: number;
  paymentAmount: number;
  paymentMethod: SourcePaymentMethod;
  notes: string;
};

const emptyForm = (): FormState => {
  const today = tashkentToday();
  return {
    fullName: "",
    phone: "",
    propertyId: "",
    guestCount: "1",
    checkInDate: today,
    checkOutDate: addDays(today, 1),
    nightlyRate: 0,
    paymentAmount: 0,
    paymentMethod: "CASH",
    notes: "",
  };
};

const fromRow = (row: HotelGuestRow): FormState => ({
  fullName: row.fullName,
  phone: row.phone,
  propertyId: row.propertyId,
  guestCount: String(row.guestCount),
  checkInDate: row.checkInDate,
  checkOutDate: row.checkOutDate,
  nightlyRate: row.nightlyRate,
  paymentAmount: 0,
  paymentMethod: "CASH",
  notes: row.notes ?? "",
});

export function HotelGuestDialog({
  open,
  onOpenChange,
  row,
  properties,
  bookings,
  canPay,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = place a new guest. */
  row: HotelGuestRow | null;
  properties: Property[];
  /** Availability hint and last nightly rate per room; the server re-checks overlap. */
  bookings: Booking[];
  canPay: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetTarget = open ? (row?.bookingId ?? "new") : null;
  const [resetFor, setResetFor] = useState<string | null>(null);
  if (resetTarget !== resetFor) {
    setResetFor(resetTarget);
    if (open) {
      setError(null);
      setForm(row ? fromRow(row) : emptyForm());
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectRoom = (propertyId: string) => {
    const last = bookings.find((b) => b.propertyId === propertyId);
    const room = properties.find((p) => p.id === propertyId);
    setForm((prev) => ({
      ...prev,
      propertyId,
      nightlyRate: prev.nightlyRate > 0 ? prev.nightlyRate : (last?.nightlyRate ?? room?.price ?? 0),
    }));
  };

  const busyRoomIds = useMemo(() => {
    if (!bookingNights(form.checkInDate, form.checkOutDate)) return new Set<string>();
    const range = { checkInDate: form.checkInDate, checkOutDate: form.checkOutDate };
    return new Set(
      bookings
        .filter(
          (b) =>
            b.id !== row?.bookingId &&
            BLOCKING_BOOKING_STATUSES.includes(b.status) &&
            bookingRangesOverlap(b, range)
        )
        .map((b) => b.propertyId)
    );
  }, [bookings, form.checkInDate, form.checkOutDate, row?.bookingId]);

  const nights = bookingNights(form.checkInDate, form.checkOutDate);
  const total = nights && form.nightlyRate > 0 ? bookingTotal(nights, form.nightlyRate) : 0;
  const preview = getPaymentSummary(total, form.paymentAmount);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const phoneChanged = !row || form.phone !== row.phone;
    if (phoneChanged && !UZ_PHONE_PATTERN.test(form.phone)) {
      setError("Telefon raqamini to‘liq kiriting");
      return;
    }
    if (busyRoomIds.has(form.propertyId)) {
      setError("Bu sanalarda xona band. Boshqa sana yoki boshqa xona tanlang.");
      return;
    }
    const body = {
      fullName: form.fullName,
      phone: form.phone,
      propertyId: form.propertyId,
      guestCount: form.guestCount,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      nightlyRate: form.nightlyRate,
      notes: form.notes,
      ...(row ? {} : { paymentAmount: canPay ? form.paymentAmount : 0, paymentMethod: form.paymentMethod }),
    };
    const parsed = row ? parseHotelGuestUpdate(body) : parseHotelGuestInput(body);
    if (parsed.error !== undefined) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (row) {
        await apiFetch(`/hotel-guests/${row.bookingId}`, { method: "PATCH", body: parsed.data });
        toast.success("Mehmon ma’lumotlari yangilandi");
      } else {
        await apiFetch("/hotel-guests", { method: "POST", body: parsed.data });
        toast.success("Mehmon joylashtirildi");
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
          <DialogTitle>{row ? "Mehmonni tahrirlash" : "Yangi mehmon"}</DialogTitle>
          <DialogDescription>Mehmon ma’lumotlari va joylashuvini kiriting.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="guest-name">F.I.O *</Label>
              <Input
                id="guest-name"
                placeholder="To‘liq ism"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-phone">Telefon *</Label>
              <UzPhoneInput id="guest-phone" value={form.phone} onChange={(v) => set("phone", v)} />
            </div>

            <div className="space-y-1.5">
              <Label>Xona / Domik *</Label>
              <Select value={form.propertyId} onValueChange={selectRoom}>
                <SelectTrigger aria-label="Xona / Domik">
                  <SelectValue placeholder="Xona yoki domikni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => {
                    const maintenance = p.status === "maintenance" && p.id !== row?.propertyId;
                    const busy = busyRoomIds.has(p.id);
                    return (
                      <SelectItem key={p.id} value={p.id} disabled={maintenance || busy}>
                        {p.name}
                        {maintenance ? " (ta’mirda)" : busy ? " (band)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {properties.length === 0 && (
                <p className="text-xs text-muted-foreground">Avval Xonalar bo‘limida xona qo‘shing.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-count">Odam soni *</Label>
              <Input
                id="guest-count"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.guestCount}
                onChange={(e) => set("guestCount", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="guest-check-in">Kelish sanasi *</Label>
              <Input
                id="guest-check-in"
                type="date"
                max={row ? undefined : tashkentToday()}
                value={form.checkInDate}
                onChange={(e) => set("checkInDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-check-out">Ketish sanasi *</Label>
              <Input
                id="guest-check-out"
                type="date"
                min={nextDay(form.checkInDate)}
                value={form.checkOutDate}
                onChange={(e) => set("checkOutDate", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tunlik narx (so‘m) *</Label>
              <MoneyInput value={form.nightlyRate} onChange={(v) => set("nightlyRate", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jami summa</Label>
              <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-semibold">
                {formatCurrency(total)}
              </div>
              <p className="text-xs text-muted-foreground">
                {nights ? `${nights} tun × ${formatCurrency(form.nightlyRate)}` : "Ketish sanasi kelishdan keyin bo‘lsin"}
              </p>
            </div>

            {!row && canPay && (
              <>
                <div className="space-y-1.5">
                  <Label>To‘lov summasi</Label>
                  <MoneyInput value={form.paymentAmount} onChange={(v) => set("paymentAmount", v)} />
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_SUMMARY_LABELS[preview.status]}
                    {preview.status === "PARTIAL" ? ` · qolgan ${formatCurrency(preview.remaining)}` : ""}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>To‘lov turi</Label>
                  <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v as SourcePaymentMethod)}>
                    <SelectTrigger aria-label="To‘lov turi">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_MAP[m.toLowerCase() as PaymentMethod]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="guest-notes">Izoh</Label>
              <Textarea
                id="guest-notes"
                rows={3}
                placeholder="Mehmon yoki xona haqida qo‘shimcha ma’lumot"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          {row && (
            <p className="text-xs text-muted-foreground">To‘lovlar «To‘lov qo‘shish» orqali kiritiladi.</p>
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
              {row ? "Saqlash" : "Mehmonni joylashtirish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function nextDay(date: string) {
  try {
    return addDays(date, 1);
  } catch {
    return undefined;
  }
}
