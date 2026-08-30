"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { refreshCollection } from "@/lib/data/store";
import type { RecurringOccurrence } from "@/types";

export function RecurringPayDialog({
  open,
  onOpenChange,
  occurrence,
  onPaid,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: RecurringOccurrence | null;
  onPaid?: () => void;
  /** Berilsa API o‘rniga shu callback ishlatiladi (demo/local) */
  onSubmit?: (payload: {
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !occurrence) return;
    setAmount(occurrence.amount);
    setDate(occurrence.dueDate.slice(0, 10));
    setNotes(occurrence.notes ?? "");
  }, [open, occurrence]);

  const handlePay = async () => {
    if (!occurrence) return;
    if (amount <= 0) {
      toast.error("Summani kiriting");
      return;
    }
    setSaving(true);
    try {
      if (onSubmit) {
        await onSubmit({
          amount,
          date,
          notes: notes || undefined,
        });
        toast.success("To'lov xarajat sifatida yozildi");
      } else {
        const res = await apiFetch<{
          alreadyPaid?: boolean;
          expense?: { id: string };
        }>("/recurring-expenses/pay", {
          method: "POST",
          body: {
            recurringExpenseId: occurrence.recurringExpenseId,
            paymentPeriodKey: occurrence.paymentPeriodKey,
            amount,
            date,
            notes: notes || undefined,
          },
        });
        await refreshCollection("expenses");
        toast.success(
          res.alreadyPaid
            ? "Bu oy allaqachon to'langan"
            : "To'lov xarajat sifatida yozildi"
        );
      }
      onPaid?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "To'lash xatosi");
    } finally {
      setSaving(false);
    }
  };

  if (!occurrence) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Occurrence to&apos;lash</DialogTitle>
          <DialogDescription>
            {occurrence.name} — {formatDate(occurrence.dueDate)} (
            {occurrence.paymentPeriodKey})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{occurrence.name}</p>
            {occurrence.monthlyExpenseLabel && (
              <p className="text-muted-foreground">
                {occurrence.monthlyExpenseLabel}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Reja: {formatCurrency(occurrence.amount)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Haqiqiy summa (so&apos;m)</Label>
            <MoneyInput value={amount} onChange={setAmount} />
          </div>

          <div className="space-y-1.5">
            <Label>To&apos;lov sanasi</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Izoh</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ixtiyoriy"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Bekor qilish
          </Button>
          <Button onClick={handlePay} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Tasdiqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
