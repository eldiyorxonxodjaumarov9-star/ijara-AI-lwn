"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ManualDebtView } from "@/lib/manual-debts";
import { addManualDebtPaymentApi } from "@/lib/manual-debts-client";
import { formatCurrency } from "@/lib/utils";
import { tashkentToday } from "@/lib/vehicle-rentals";

export function ManualDebtPaymentDialog({
  debt,
  onOpenChange,
  onSaved,
}: {
  debt: ManualDebtView | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (debt: ManualDebtView) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(tashkentToday());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debt) return;
    setAmount(debt.remainingAmount);
    setPaymentDate(tashkentToday());
    setNotes("");
    setError(null);
    setSaving(false);
  }, [debt]);

  const submit = async () => {
    if (!debt) return;
    if (!(amount > 0)) return setError("To‘lov summasi 0 dan katta bo‘lishi kerak");
    if (amount > debt.remainingAmount) return setError("To‘lov summasi qolgan qarzdan oshmasligi kerak");
    setSaving(true);
    setError(null);
    try {
      const saved = await addManualDebtPaymentApi(debt.id, {
        amount,
        paymentDate,
        notes: notes.trim() || null,
      });
      toast.success(
        saved.status === "PAID"
          ? "To‘lov qabul qilindi. Qarz to‘liq yopildi."
          : `To‘lov qabul qilindi. Qolgan qarz: ${formatCurrency(saved.remainingAmount)}`
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "To‘lovni saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!debt} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>To‘lov qo‘shish</DialogTitle>
        </DialogHeader>
        {debt && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Qarzdor</dt>
              <dd className="font-medium">{debt.debtorName}</dd>
              <dt className="text-muted-foreground">Xona</dt>
              <dd className="font-medium">{debt.propertyName ?? "Biriktirilmagan"}</dd>
              <dt className="text-muted-foreground">Jami qarz</dt>
              <dd className="font-medium">{formatCurrency(debt.originalAmount)}</dd>
              <dt className="text-muted-foreground">To‘langan</dt>
              <dd className="font-medium">{formatCurrency(debt.paidAmount)}</dd>
              <dt className="text-muted-foreground">Qolgan</dt>
              <dd className="font-semibold text-destructive">{formatCurrency(debt.remainingAmount)}</dd>
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mdp-amount">To‘lov summasi</Label>
                <MoneyInput id="mdp-amount" value={amount} onChange={setAmount} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mdp-date">Sana</Label>
                <Input
                  id="mdp-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mdp-notes">Izoh</Label>
              <Textarea
                id="mdp-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                To‘lovni saqlash
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
