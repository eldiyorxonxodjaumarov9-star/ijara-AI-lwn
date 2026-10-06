"use client";

import { useEffect, useState } from "react";
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
import { useCollection } from "@/hooks/use-collection";
import { OCCUPATION_SUGGESTIONS, type ManualDebtView } from "@/lib/manual-debts";
import {
  createManualDebtApi,
  updateManualDebtApi,
  type ManualDebtFormValues,
} from "@/lib/manual-debts-client";
import { tashkentToday } from "@/lib/vehicle-rentals";
import type { Property } from "@/types";

const NO_ROOM = "__none__";

function emptyForm(): ManualDebtFormValues {
  return {
    propertyId: null,
    debtorName: "",
    debtorPhone: null,
    debtorOccupation: null,
    description: null,
    originalAmount: 0,
    debtDate: tashkentToday(),
  };
}

export function ManualDebtDialog({
  open,
  onOpenChange,
  debt,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Berilsa — tahrirlash rejimi. */
  debt?: ManualDebtView | null;
  onSaved: (debt: ManualDebtView) => void;
}) {
  const { data: properties } = useCollection<Property>("properties");
  const [form, setForm] = useState<ManualDebtFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setForm(
      debt
        ? {
            propertyId: debt.propertyId,
            debtorName: debt.debtorName,
            debtorPhone: debt.debtorPhone,
            debtorOccupation: debt.debtorOccupation,
            description: debt.description,
            originalAmount: debt.originalAmount,
            debtDate: debt.debtDate,
          }
        : emptyForm()
    );
  }, [open, debt]);

  const set = <K extends keyof ManualDebtFormValues>(key: K, value: ManualDebtFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.debtorName.trim()) return setError("Qarzdor nomi kiritilishi shart");
    if (!(form.originalAmount > 0)) return setError("Qarzdorlik summasi 0 dan katta bo‘lishi kerak");
    if (!form.debtDate) return setError("Qarzdorlik sanasi kiritilishi shart");
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        debtorPhone: form.debtorPhone || null,
        debtorOccupation: form.debtorOccupation?.trim() || null,
        description: form.description?.trim() || null,
      };
      const saved = debt
        ? await updateManualDebtApi(debt.id, payload)
        : await createManualDebtApi(payload);
      toast.success(debt ? "Qarz yangilandi" : "Qarzdor qo‘shildi");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{debt ? "Qarzni tahrirlash" : "Qarzdor qo‘shish"}</DialogTitle>
          <DialogDescription>
            Shartnomaga kiritilmagan yoki oldindan qolib ketgan qarz. To‘lovlar alohida hisobda yuritiladi.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label>Xona / obyekt</Label>
            <Select
              value={form.propertyId ?? NO_ROOM}
              onValueChange={(v) => set("propertyId", v === NO_ROOM ? null : v)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Xonani tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROOM}>Biriktirilmagan</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="md-name">Qarzdor nomi *</Label>
            <Input
              id="md-name"
              value={form.debtorName}
              onChange={(e) => set("debtorName", e.target.value)}
              placeholder="ABC Logistics"
              disabled={saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="md-phone">Telefon</Label>
              <UzPhoneInput
                id="md-phone"
                value={form.debtorPhone ?? ""}
                onChange={(v) => set("debtorPhone", v || null)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md-occupation">Faoliyat / Nima ish qiladi</Label>
              <Input
                id="md-occupation"
                list="md-occupation-options"
                value={form.debtorOccupation ?? ""}
                onChange={(e) => set("debtorOccupation", e.target.value)}
                placeholder="Logistika"
                disabled={saving}
              />
              <datalist id="md-occupation-options">
                {OCCUPATION_SUGGESTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="md-amount">Qarzdorlik summasi *</Label>
              <MoneyInput
                id="md-amount"
                value={form.originalAmount}
                onChange={(v) => set("originalAmount", v)}
              />
              {debt && debt.paidAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  To‘langan: {debt.paidAmount.toLocaleString("ru-RU")} UZS — summa bundan kam bo‘lmasin.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md-date">Qarzdorlik sanasi *</Label>
              <Input
                id="md-date"
                type="date"
                value={form.debtDate}
                onChange={(e) => set("debtDate", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="md-description">Izoh</Label>
            <Textarea
              id="md-description"
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
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
              {debt ? "Saqlash" : "Qarzdorni qo‘shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
