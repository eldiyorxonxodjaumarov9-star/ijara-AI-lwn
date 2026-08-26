"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ImageUpload } from "@/components/shared/image-upload";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { zResolver } from "@/lib/form";
import { expenseSchema, type ExpenseInput } from "@/lib/validations";
import {
  EXPENSE_CATEGORY_MAP,
  MONTHLY_EXPENSE_TYPE_CATEGORY,
  MONTHLY_EXPENSE_TYPE_MAP,
} from "@/lib/constants";
import type {
  Employee,
  Expense,
  ExpenseCategory,
  MonthlyExpenseType,
} from "@/types";

const today = new Date().toISOString().slice(0, 10);

type WorkerPayType = "salary" | "advance" | "expense";

const defaults: ExpenseInput = {
  category: "utilities",
  amount: 0,
  date: today,
  receiptUrl: "",
  note: "",
  employeeId: "",
  monthlyExpenseType: undefined,
  monthlyExpenseCustomName: "",
};

function payTypeFromExpense(expense?: Expense | null): WorkerPayType {
  if (expense?.category === "salary") return "salary";
  if (expense?.category === "advance") return "advance";
  return "expense";
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
}) {
  const { data: employees } = useCollection<Employee>("employees");
  const { create, update } = useCollectionActions<Expense>("expenses");
  const [workerPayType, setWorkerPayType] = useState<WorkerPayType>("expense");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseInput>({
    resolver: zResolver<ExpenseInput>(expenseSchema),
    defaultValues: defaults,
  });

  const category = watch("category");
  const employeeId = watch("employeeId");
  const monthlyExpenseType = watch("monthlyExpenseType");
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active),
    [employees]
  );
  const showWorkerFields =
    category === "salary" || category === "other" || category === "advance";
  const isWorkerPayCategory =
    category === "salary" ||
    category === "advance" ||
    (category === "other" &&
      (workerPayType === "salary" || workerPayType === "advance"));
  const showMonthlyType = !isWorkerPayCategory;

  useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            category: expense.category,
            amount: expense.amount,
            date: expense.date.slice(0, 10),
            receiptUrl: expense.receiptUrl ?? "",
            note: expense.note ?? "",
            employeeId: expense.employeeId ?? "",
            monthlyExpenseType: expense.monthlyExpenseType ?? undefined,
            monthlyExpenseCustomName: expense.monthlyExpenseCustomName ?? "",
          }
        : defaults
    );
    setWorkerPayType(payTypeFromExpense(expense));
  }, [open, expense, reset]);

  const clearMonthlyType = () => {
    setValue("monthlyExpenseType", null, { shouldValidate: true });
    setValue("monthlyExpenseCustomName", "", { shouldValidate: true });
  };

  const onCategoryChange = (v: ExpenseCategory) => {
    setValue("category", v);
    if (v !== "salary" && v !== "other" && v !== "advance") {
      setValue("employeeId", "");
    }
    if (v === "salary") {
      setWorkerPayType("salary");
      clearMonthlyType();
    } else if (v === "advance") {
      setWorkerPayType("advance");
      clearMonthlyType();
    } else if (v === "other") {
      setWorkerPayType("expense");
    }
  };

  const onMonthlyTypeChange = (v: MonthlyExpenseType) => {
    setValue("monthlyExpenseType", v, { shouldValidate: true });
    if (v !== "custom") {
      setValue("monthlyExpenseCustomName", "", { shouldValidate: true });
    }
    const mapped = MONTHLY_EXPENSE_TYPE_CATEGORY[v];
    setValue("category", mapped, { shouldValidate: true });
    if (mapped !== "other") {
      setValue("employeeId", "");
      setWorkerPayType("expense");
    }
  };

  const applyEmployeeDefaults = (
    id: string,
    payType: WorkerPayType = workerPayType
  ) => {
    setValue("employeeId", id);
    const emp = activeEmployees.find((e) => e.id === id);
    if (!emp) return;
    const label = emp.companyName
      ? `${emp.fullName} (${emp.companyName})`
      : emp.fullName;
    const note = payType === "advance" ? `Avans — ${label}` : label;
    setValue("note", note, { shouldValidate: true });
    if (payType === "salary" && emp.monthlySalary > 0) {
      setValue("amount", emp.monthlySalary, { shouldValidate: true });
    }
  };

  const onEmployeeChange = (id: string) => {
    applyEmployeeDefaults(id);
  };

  const onWorkerPayTypeChange = (v: WorkerPayType) => {
    setWorkerPayType(v);
    if (v === "salary" || v === "advance") {
      clearMonthlyType();
    }
    if (employeeId) {
      applyEmployeeDefaults(employeeId, v);
    }
  };

  const onSubmit = async (values: ExpenseInput) => {
    const fromOtherWorkerFlow = values.category === "other";

    if (
      fromOtherWorkerFlow &&
      (workerPayType === "salary" || workerPayType === "advance") &&
      !values.employeeId
    ) {
      toast.error(
        workerPayType === "advance"
          ? "Avans uchun ishchini tanlang"
          : "Oylik uchun ishchini tanlang"
      );
      return;
    }

    if (
      (values.category === "salary" || values.category === "advance") &&
      !values.employeeId
    ) {
      toast.error("Ishchini tanlang");
      return;
    }

    let resolvedCategory: ExpenseCategory = values.category;
    if (fromOtherWorkerFlow) {
      if (workerPayType === "salary") resolvedCategory = "salary";
      else if (workerPayType === "advance") resolvedCategory = "advance";
      else resolvedCategory = "other";
    }

    const isWorkerPay =
      resolvedCategory === "salary" || resolvedCategory === "advance";

    // Yangi xarajat: Maosh/Avansdan tashqari oylik tur majburiy
    // Edit: eski yozuvlarda tur bo'lmasa majburiy emas
    if (!expense && !isWorkerPay && !values.monthlyExpenseType) {
      setError("monthlyExpenseType", {
        message: "Oylik xarajat turini tanlang",
      });
      toast.error("Oylik xarajat turini tanlang");
      return;
    }

    if (
      values.monthlyExpenseType === "custom" &&
      !values.monthlyExpenseCustomName?.trim()
    ) {
      toast.error("Xarajat nomini kiriting");
      return;
    }

    if (
      !isWorkerPay &&
      values.monthlyExpenseType &&
      MONTHLY_EXPENSE_TYPE_CATEGORY[values.monthlyExpenseType]
    ) {
      resolvedCategory =
        MONTHLY_EXPENSE_TYPE_CATEGORY[values.monthlyExpenseType];
    }

    const needsEmployee =
      resolvedCategory === "salary" ||
      resolvedCategory === "advance" ||
      (resolvedCategory === "other" && Boolean(values.employeeId));

    const emp = values.employeeId
      ? activeEmployees.find((e) => e.id === values.employeeId)
      : undefined;
    const empLabel = emp
      ? emp.companyName
        ? `${emp.fullName} (${emp.companyName})`
        : emp.fullName
      : undefined;

    const monthlyExpenseType = isWorkerPay
      ? null
      : values.monthlyExpenseType || null;
    const monthlyExpenseCustomName =
      monthlyExpenseType === "custom"
        ? values.monthlyExpenseCustomName?.trim() || null
        : null;

    const payload = {
      ...values,
      category: resolvedCategory,
      employeeId: needsEmployee ? values.employeeId || undefined : undefined,
      monthlyExpenseType,
      monthlyExpenseCustomName,
      note:
        resolvedCategory === "advance"
          ? values.note || (empLabel ? `Avans — ${empLabel}` : values.note)
          : resolvedCategory === "salary"
            ? values.note || empLabel || values.note
            : values.note,
    };

    const successLabel =
      resolvedCategory === "salary"
        ? "Oylik Maosh sifatida qo'shildi"
        : resolvedCategory === "advance"
          ? "Avans qo'shildi"
          : "Xarajat qo'shildi";
    const updateLabel =
      resolvedCategory === "salary"
        ? "Oylik (Maosh) yangilandi"
        : resolvedCategory === "advance"
          ? "Avans yangilandi"
          : "Xarajat yangilandi";

    try {
      if (expense) {
        await update(expense.id, payload);
        toast.success(updateLabel);
      } else {
        await create(payload);
        toast.success(successLabel);
      }
      onOpenChange(false);
    } catch {
      toast.error("Xatolik yuz berdi");
    }
  };

  const receipt = watch("receiptUrl");
  const payHint =
    workerPayType === "salary"
      ? "Tanlangan summa Maosh kategoriyasiga yoziladi."
      : workerPayType === "advance"
        ? "Tanlangan summa Avans kategoriyasiga yoziladi."
        : "Ishchiga berilgan boshqa xarajat sifatida saqlanadi.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {expense ? "Xarajatni tahrirlash" : "Yangi xarajat"}
          </DialogTitle>
          <DialogDescription>Xarajat ma&apos;lumotlari.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kategoriya</Label>
              <Select value={category} onValueChange={onCategoryChange}>
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
          </div>

          {showMonthlyType && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label>Oylik xarajat turi</Label>
                <Select
                  value={monthlyExpenseType || undefined}
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

              {monthlyExpenseType === "custom" && (
                <div className="space-y-1.5">
                  <Label>Xarajat nomini kiriting</Label>
                  <Input
                    placeholder="Masalan: internet, tozalash vositalari"
                    {...register("monthlyExpenseCustomName")}
                  />
                  {errors.monthlyExpenseCustomName && (
                    <p className="text-xs text-destructive">
                      {errors.monthlyExpenseCustomName.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {showWorkerFields && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
              {category === "other" && (
                <div className="space-y-1.5">
                  <Label>Ishchiga berilishi</Label>
                  <Select
                    value={workerPayType}
                    onValueChange={(v) =>
                      onWorkerPayTypeChange(v as WorkerPayType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary">Oylik (Maosh)</SelectItem>
                      <SelectItem value="advance">Avans</SelectItem>
                      <SelectItem value="expense">Xarajat (Boshqa)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{payHint}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>
                  Ishchi
                  {category === "other" && workerPayType === "expense"
                    ? " (ixtiyoriy)"
                    : ""}
                </Label>
                <Select
                  value={employeeId || undefined}
                  onValueChange={onEmployeeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ishchini tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        Avval Ishchilar bo&apos;limidan qo&apos;shing
                      </SelectItem>
                    ) : (
                      activeEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.fullName}
                          {e.companyName
                            ? ` — ${e.companyName}`
                            : e.position
                              ? ` — ${e.position}`
                              : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Sana</Label>
            <Input type="date" {...register("date")} />
          </div>

          <div className="space-y-1.5">
            <Label>Izoh</Label>
            <Textarea
              placeholder="Xarajat tafsiloti..."
              {...register("note")}
            />
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
