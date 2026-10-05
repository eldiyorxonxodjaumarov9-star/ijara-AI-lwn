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
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import {
  isPayableSource,
  parseSourcePaymentInput,
  SOURCE_PAYMENT_METHODS,
  type SourceBalance,
  type SourcePaymentMethod,
  type SourcePaymentTerms,
} from "@/lib/source-payments";
import { tashkentToday } from "@/lib/vehicle-rentals";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

type FormState = {
  sourceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: SourcePaymentMethod;
  notes: string;
};

const methodLabel = (m: SourcePaymentMethod) => PAYMENT_METHOD_MAP[m.toLowerCase() as PaymentMethod];

export function SourcePaymentDialog({
  open,
  onOpenChange,
  balances,
  initialSourceId,
  terms,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balances: SourceBalance[];
  initialSourceId: string | null;
  terms: SourcePaymentTerms;
  onSaved: () => void | Promise<void>;
}) {
  const today = tashkentToday();
  const [form, setForm] = useState<FormState>({
    sourceId: "",
    amount: 0,
    paymentDate: today,
    paymentMethod: "CASH",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const payable = useMemo(
    () => balances.filter((b) => isPayableSource(b.sourceStatus, b.remaining)),
    [balances]
  );

  // Reset when the dialog opens or its target changes (state adjusted during render, not in an effect).
  const resetTarget = open ? (initialSourceId ?? "new") : null;
  const [resetFor, setResetFor] = useState<string | null>(null);
  if (resetTarget !== resetFor) {
    setResetFor(resetTarget);
    if (open) {
      setError(null);
      setForm({ sourceId: initialSourceId ?? "", amount: 0, paymentDate: today, paymentMethod: "CASH", notes: "" });
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selected = balances.find((b) => b.sourceId === form.sourceId) ?? null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError(`${terms.source}ni tanlang`);
      return;
    }
    if (form.amount > selected.remaining) {
      setError(`Summa qolgan qarzdan oshmasligi kerak (qolgan: ${formatCurrency(selected.remaining)})`);
      return;
    }
    const parsed = parseSourcePaymentInput(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/source-payments", { method: "POST", body: parsed.value });
      toast.success("To‘lov qo‘shildi");
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
          <DialogTitle>To‘lov qo‘shish</DialogTitle>
          <DialogDescription>Summa qolgan qarzdan oshmasligi kerak.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>{terms.source} *</Label>
            <Select value={form.sourceId} onValueChange={(v) => set("sourceId", v)}>
              <SelectTrigger aria-label={terms.source}>
                <SelectValue placeholder={`${terms.source}ni tanlang`} />
              </SelectTrigger>
              <SelectContent>
                {payable.map((b) => (
                  <SelectItem key={b.sourceId} value={b.sourceId}>
                    {b.customerName} — {b.unitName} ({formatDate(b.startDate)} – {formatDate(b.endDate)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {payable.length === 0 && (
              <p className="text-xs text-muted-foreground">To‘lov kutilayotgan {terms.source.toLowerCase()} yo‘q.</p>
            )}
          </div>

          {selected && (
            <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{terms.total}</p>
                <p className="font-medium">{formatCurrency(selected.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">To‘langan</p>
                <p className="font-medium">{formatCurrency(selected.paid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Qolgan</p>
                <p className="font-semibold">{formatCurrency(selected.remaining)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Summa (so&apos;m) *</Label>
              <MoneyInput value={form.amount} onChange={(v) => set("amount", v)} />
              {selected && selected.remaining > 0 && (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => set("amount", selected.remaining)}
                >
                  Qolganini to‘liq kiritish
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-payment-date">Sana *</Label>
              <Input
                id="source-payment-date"
                type="date"
                max={today}
                value={form.paymentDate}
                onChange={(e) => set("paymentDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>To‘lov usuli</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v as SourcePaymentMethod)}>
                <SelectTrigger aria-label="To‘lov usuli">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {methodLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="source-payment-notes">Izoh</Label>
              <Textarea
                id="source-payment-notes"
                rows={2}
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
            <Button type="submit" disabled={saving || payable.length === 0}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              To‘lov qo‘shish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
