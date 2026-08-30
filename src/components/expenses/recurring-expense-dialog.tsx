"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollectionActions } from "@/hooks/use-collection";
import { zResolver } from "@/lib/form";
import {
  MONTHLY_EXPENSE_TYPE_CATEGORY,
  MONTHLY_EXPENSE_TYPE_MAP,
  RECURRENCE_INTERVAL_MAP,
} from "@/lib/constants";
import {
  recurringExpenseSchema,
  type RecurringExpenseInput,
} from "@/lib/validations";
import type { MonthlyExpenseType, RecurrenceInterval, RecurringExpense } from "@/types";

const today = new Date().toISOString().slice(0, 10);

const defaults: RecurringExpenseInput = {
  name: "",
  amount: 0,
  monthlyExpenseType: undefined,
  monthlyExpenseCustomName: "",
  notes: "",
  firstPaymentDate: today,
  interval: "monthly",
  active: true,
  companyId: null,
};

export function RecurringExpenseDialog({
  open,
  onOpenChange,
  item,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: RecurringExpense | null;
  onSaved?: () => void;
}) {
  const { create, update } = useCollectionActions<RecurringExpense>(
    "recurring-expenses"
  );
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecurringExpenseInput>({
    resolver: zResolver<RecurringExpenseInput>(recurringExpenseSchema),
    defaultValues: defaults,
  });

  const monthlyType = watch("monthlyExpenseType");

  useEffect(() => {
    if (!open) return;
    reset(
      item
        ? {
            name: item.name,
            amount: item.amount,
            category: item.category,
            monthlyExpenseType: item.monthlyExpenseType ?? undefined,
            monthlyExpenseCustomName: item.monthlyExpenseCustomName ?? "",
            notes: item.notes ?? "",
            firstPaymentDate: item.firstPaymentDate.slice(0, 10),
            interval: item.interval,
            active: item.active,
            companyId: item.companyId ?? null,
          }
        : defaults
    );
  }, [open, item, reset]);

  const onMonthlyTypeChange = (v: MonthlyExpenseType) => {
    setValue("monthlyExpenseType", v, { shouldValidate: true });
    if (v !== "custom") {
      setValue("monthlyExpenseCustomName", "", { shouldValidate: true });
    }
    setValue("category", MONTHLY_EXPENSE_TYPE_CATEGORY[v], {
      shouldValidate: true,
    });
  };

  const onSubmit = async (values: RecurringExpenseInput) => {
    const payload = {
      ...values,
      category:
        values.monthlyExpenseType
          ? MONTHLY_EXPENSE_TYPE_CATEGORY[values.monthlyExpenseType]
          : values.category ?? "other",
      monthlyExpenseCustomName:
        values.monthlyExpenseType === "custom"
          ? values.monthlyExpenseCustomName?.trim() || null
          : null,
    };
    try {
      if (item) {
        await update(item.id, payload);
        toast.success("Doimiy xarajat yangilandi");
      } else {
        await create(payload);
        toast.success("Doimiy xarajat qo'shildi");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? "Doimiy xarajatni tahrirlash" : "Doimiy xarajat qo'shish"}
          </DialogTitle>
          <DialogDescription>
            Har oy / chorak / yarim yil / yil bo&apos;yicha takrorlanadigan
            xarajat jadvali.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Xarajat nomi</Label>
            <Input placeholder="Masalan: Internet" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Summa (so&apos;m)</Label>
              <MoneyInput
                value={watch("amount") ?? 0}
                onChange={(v) =>
                  setValue("amount", v, { shouldValidate: true })
                }
              />
              {errors.amount && (
                <p className="text-xs text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Birinchi to&apos;lov sanasi</Label>
              <Input type="date" {...register("firstPaymentDate")} />
              {errors.firstPaymentDate && (
                <p className="text-xs text-destructive">
                  {errors.firstPaymentDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Oylik xarajat turi</Label>
            <Select
              value={monthlyType || undefined}
              onValueChange={(v) =>
                onMonthlyTypeChange(v as MonthlyExpenseType)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Turini tanlang" />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(MONTHLY_EXPENSE_TYPE_MAP) as MonthlyExpenseType[]
                ).map((key) => (
                  <SelectItem key={key} value={key}>
                    {MONTHLY_EXPENSE_TYPE_MAP[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.monthlyExpenseType && (
              <p className="text-xs text-destructive">
                {errors.monthlyExpenseType.message}
              </p>
            )}
          </div>

          {monthlyType === "custom" && (
            <div className="space-y-1.5">
              <Label>Xarajat nomini kiriting</Label>
              <Input
                placeholder="Masalan: internet, ijara"
                {...register("monthlyExpenseCustomName")}
              />
              {errors.monthlyExpenseCustomName && (
                <p className="text-xs text-destructive">
                  {errors.monthlyExpenseCustomName.message}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Takrorlanish turi</Label>
              <Select
                value={watch("interval")}
                onValueChange={(v) =>
                  setValue("interval", v as RecurrenceInterval, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(
                      RECURRENCE_INTERVAL_MAP
                    ) as RecurrenceInterval[]
                  ).map((key) => (
                    <SelectItem key={key} value={key}>
                      {RECURRENCE_INTERVAL_MAP[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Holat</Label>
              <Select
                value={watch("active") ? "active" : "inactive"}
                onValueChange={(v) => setValue("active", v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Faol</SelectItem>
                  <SelectItem value="inactive">Nofaol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Izoh</Label>
            <Textarea placeholder="Ixtiyoriy" {...register("notes")} />
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
              {item ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
