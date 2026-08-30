"use client";

import { useEffect, useMemo } from "react";
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
import { calcDailySalary } from "@/lib/employee-salary";
import {
  EMPLOYEE_POSITIONS,
  EMPLOYEE_UNIT,
  isLwnCompanyName,
  isSunnurCompanyName,
} from "@/lib/employee-units";
import { zResolver } from "@/lib/form";
import { employeeSchema, type EmployeeInput } from "@/lib/validations";
import { formatCurrency } from "@/lib/utils";
import type { Company, Employee } from "@/types";

const today = new Date().toISOString().slice(0, 10);

const defaults: EmployeeInput = {
  fullName: "",
  phone: "",
  position: "",
  monthlySalary: 0,
  salaryPayDay: undefined,
  active: true,
  notes: "",
  companyId: "",
  startedAt: today,
};

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  unitCompanies,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  unitCompanies: Company[];
  defaultCompanyId?: string;
}) {
  const { create, update } = useCollectionActions<Employee>("employees");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeInput>({
    resolver: zResolver<EmployeeInput>(employeeSchema),
    defaultValues: defaults,
  });

  const monthly = watch("monthlySalary") ?? 0;
  const daily = calcDailySalary(monthly);

  const companies = useMemo(() => {
    const units = unitCompanies.filter(
      (c) => c.active && (isSunnurCompanyName(c.name) || isLwnCompanyName(c.name))
    );
    return units;
  }, [unitCompanies]);

  useEffect(() => {
    if (!open) return;
    reset(
      employee
        ? {
            fullName: employee.fullName,
            phone: employee.phone ?? "",
            position: employee.position ?? "",
            monthlySalary: employee.monthlySalary ?? 0,
            salaryPayDay: employee.salaryPayDay ?? undefined,
            active: employee.active,
            notes: employee.notes ?? "",
            companyId: employee.companyId ?? defaultCompanyId ?? "",
            startedAt: employee.startedAt
              ? employee.startedAt.slice(0, 10)
              : employee.createdAt.slice(0, 10),
          }
        : {
            ...defaults,
            companyId: defaultCompanyId ?? companies[0]?.id ?? "",
          }
    );
  }, [open, employee, reset, defaultCompanyId, companies]);

  const onSubmit = async (values: EmployeeInput) => {
    const payload = {
      ...values,
      monthlySalary: values.monthlySalary ?? 0,
      salaryPayDay:
        values.monthlySalary && values.monthlySalary > 0
          ? values.salaryPayDay ?? undefined
          : null,
      companyId: values.companyId,
      startedAt: values.startedAt || undefined,
    };
    try {
      if (employee) {
        await update(employee.id, payload);
        toast.success("Xodim yangilandi");
      } else {
        await create(payload);
        toast.success("Xodim qo‘shildi");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {employee ? "Xodimni tahrirlash" : "Yangi xodim"}
          </DialogTitle>
          <DialogDescription>
            Sunnur yoki LWN xodimini qo‘shing. Oylik maosh va lavozim majburiy.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kompaniya</Label>
            <Select
              value={watch("companyId") || undefined}
              onValueChange={(v) =>
                setValue("companyId", v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sunnur yoki LWN" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {isSunnurCompanyName(c.name)
                      ? EMPLOYEE_UNIT.SUNNUR
                      : EMPLOYEE_UNIT.LWN}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.companyId && (
              <p className="text-xs text-destructive">
                {errors.companyId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>F.I.O</Label>
            <Input placeholder="Ism familiya" {...register("fullName")} />
            {errors.fullName && (
              <p className="text-xs text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input placeholder="+998..." {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Lavozim</Label>
              <Select
                value={watch("position") || undefined}
                onValueChange={(v) =>
                  setValue("position", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.position && (
                <p className="text-xs text-destructive">
                  {errors.position.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ish boshlagan sana</Label>
              <Input type="date" {...register("startedAt")} />
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
                  <SelectItem value="inactive">Ishdan bo‘shatilgan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Oylik maosh (so‘m)</Label>
              <MoneyInput
                value={monthly}
                onChange={(v) =>
                  setValue("monthlySalary", v, { shouldValidate: true })
                }
              />
              {monthly > 0 && (
                <p className="text-xs text-muted-foreground">
                  Kunlik ≈ {formatCurrency(daily)}
                </p>
              )}
              {errors.monthlySalary && (
                <p className="text-xs text-destructive">
                  {errors.monthlySalary.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Oylik beriladigan kun</Label>
              <Select
                value={
                  watch("salaryPayDay") != null
                    ? String(watch("salaryPayDay"))
                    : undefined
                }
                onValueChange={(v) =>
                  setValue("salaryPayDay", Number(v), {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kun (ixtiyoriy)" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Har oy {d}-kuni
                    </SelectItem>
                  ))}
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
              {employee ? "Saqlash" : "Qo‘shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
