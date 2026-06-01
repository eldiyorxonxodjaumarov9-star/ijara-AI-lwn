"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/shared/image-upload";
import { useCollectionActions } from "@/hooks/use-collection";
import { zResolver } from "@/lib/form";
import { expenseSchema, type ExpenseInput } from "@/lib/validations";
import { EXPENSE_CATEGORY_MAP } from "@/lib/constants";
import type { Expense, ExpenseCategory } from "@/types";

const today = new Date().toISOString().slice(0, 10);

const defaults: ExpenseInput = {
  category: "utilities",
  amount: 0,
  date: today,
  receiptUrl: "",
  note: "",
};

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
}) {
  const { create, update } = useCollectionActions<Expense>("expenses");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseInput>({
    resolver: zResolver<ExpenseInput>(expenseSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open)
      reset(
        expense
          ? {
              category: expense.category,
              amount: expense.amount,
              date: expense.date.slice(0, 10),
              receiptUrl: expense.receiptUrl ?? "",
              note: expense.note ?? "",
            }
          : defaults
      );
  }, [open, expense, reset]);

  const onSubmit = async (values: ExpenseInput) => {
    try {
      if (expense) {
        await update(expense.id, values);
        toast.success("Xarajat yangilandi");
      } else {
        await create(values);
        toast.success("Xarajat qo'shildi");
      }
      onOpenChange(false);
    } catch {
      toast.error("Xatolik yuz berdi");
    }
  };

  const receipt = watch("receiptUrl");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {expense ? "Xarajatni tahrirlash" : "Yangi xarajat"}
          </DialogTitle>
          <DialogDescription>Xarajat ma&apos;lumotlari.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Kategoriya</Label>
              <Select
                value={watch("category")}
                onValueChange={(v) => setValue("category", v as ExpenseCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_MAP).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Summa (so&apos;m)</Label>
              <Input type="number" {...register("amount")} />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Sana</Label>
            <Input type="date" {...register("date")} />
          </div>

          <div className="space-y-1.5">
            <Label>Izoh</Label>
            <Textarea placeholder="Xarajat tafsiloti..." {...register("note")} />
          </div>

          <div className="space-y-1.5">
            <Label>Chek rasmi</Label>
            <ImageUpload
              folder="receipts"
              multiple={false}
              value={receipt ? [receipt] : []}
              onChange={(urls) => setValue("receiptUrl", urls[0] ?? "")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {expense ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
