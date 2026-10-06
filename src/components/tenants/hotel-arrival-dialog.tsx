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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api/client";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import { parseArrivalInput, type HotelGuestRow } from "@/lib/hotel-guests";
import { getPaymentSummary, PAYMENT_SUMMARY_LABELS, SOURCE_PAYMENT_METHODS, type SourcePaymentMethod } from "@/lib/source-payments";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

type PaymentChoice = "" | "PAID" | "UNPAID";

/** "Mehmon keldi": confirms arrival of an expected booking and records money taken at the desk. */
export function HotelArrivalDialog({
  row,
  canPay,
  onOpenChange,
  onSaved,
}: {
  row: HotelGuestRow | null;
  canPay: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const [choice, setChoice] = useState<PaymentChoice>("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<SourcePaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [resetFor, setResetFor] = useState<string | null>(null);
  const target = row?.bookingId ?? null;
  if (target !== resetFor) {
    setResetFor(target);
    setChoice(canPay && row && row.remaining > 0 ? "" : "UNPAID");
    setAmount(row?.remaining ?? 0);
    setMethod("CASH");
    setError(null);
  }

  const settled = !!row && row.remaining <= 0;
  const preview = row ? getPaymentSummary(row.totalAmount, row.paid + (choice === "PAID" ? amount : 0)) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!row) return;
    const parsed = parseArrivalInput({ paymentStatus: choice, paymentAmount: amount, paymentMethod: method });
    if (parsed.error !== undefined) {
      setError(parsed.error);
      return;
    }
    if (parsed.data.paymentAmount > row.remaining) {
      setError(`To‘lov summasi qolgan summadan (${formatCurrency(row.remaining)}) oshmasligi kerak`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/hotel-guests/${row.bookingId}/arrival`, {
        method: "POST",
        body: { paymentStatus: choice, paymentAmount: parsed.data.paymentAmount, paymentMethod: parsed.data.paymentMethod },
      });
      toast.success("Mehmon joylashtirildi");
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  const facts: [string, string][] = row
    ? [
        ["Mehmon", row.fullName],
        ["Xona", row.propertyName],
        ["Mehmonlar soni", `${row.guestCount} kishi`],
        ["Jami summa", formatCurrency(row.totalAmount)],
        ["Oldin to‘langan", formatCurrency(row.paid)],
        ["Qolgan", formatCurrency(row.remaining)],
      ]
    : [];

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mehmon keldi</DialogTitle>
          <DialogDescription>Mehmon xonaga joylashtiriladi va mehmonlar ro‘yxatiga qo‘shiladi.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-1.5">
            <Label>To‘lov holati *</Label>
            <Select value={choice} onValueChange={(v) => setChoice(v as PaymentChoice)}>
              <SelectTrigger aria-label="To‘lov holati">
                <SelectValue placeholder="Tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAID" disabled={!canPay || settled}>
                  To‘landi
                </SelectItem>
                <SelectItem value="UNPAID">To‘lanmadi</SelectItem>
              </SelectContent>
            </Select>
            {!canPay && <p className="text-xs text-muted-foreground">To‘lovni administrator kiritadi.</p>}
            {settled && <p className="text-xs text-muted-foreground">Bron oldindan to‘liq to‘langan.</p>}
          </div>

          {choice === "PAID" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>To‘lov summasi *</Label>
                <MoneyInput value={amount} onChange={setAmount} />
              </div>
              <div className="space-y-1.5">
                <Label>To‘lov turi</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as SourcePaymentMethod)}>
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
            </div>
          )}

          {preview && choice && (
            <p className="text-xs text-muted-foreground">
              {PAYMENT_SUMMARY_LABELS[preview.status]}
              {preview.remaining > 0 ? ` · qolgan ${formatCurrency(preview.remaining)}` : ""}
            </p>
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
              Joylashtirish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
