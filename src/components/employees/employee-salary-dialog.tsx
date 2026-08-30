"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCollectionActions } from "@/hooks/use-collection";
import { getTashkentDateParts, formatTashkentDate } from "@/lib/payment-due-schedule";
import { formatCurrency } from "@/lib/utils";
import type { Employee, Expense } from "@/types";

export function EmployeeSalaryDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}) {
  const { create } = useCollectionActions<Expense>("expenses");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(formatTashkentDate(getTashkentDateParts()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setAmount(employee.monthlySalary > 0 ? employee.monthlySalary : 0);
    setDate(formatTashkentDate(getTashkentDateParts()));
  }, [open, employee]);

  const handleSave = async () => {
    if (!employee) return;
    if (amount <= 0) {
      toast.error("Summani kiriting");
      return;
    }
    setSaving(true);
    try {
      await create({
        category: "salary",
        amount,
        date,
        note: employee.fullName,
        employeeId: employee.id,
      });
      toast.success("Oylik xarajat sifatida qo'shildi");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            Oylik berish
          </DialogTitle>
          <DialogDescription>
            {employee.fullName} — to&apos;lov Xarajatlar (Maosh) ga yoziladi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{employee.fullName}</p>
            {employee.position && (
              <p className="text-muted-foreground">{employee.position}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Belgilangan oylik: {formatCurrency(employee.monthlySalary)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Summa (so&apos;m)</Label>
            <MoneyInput value={amount} onChange={setAmount} />
          </div>

          <div className="space-y-1.5">
            <Label>Sana</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
