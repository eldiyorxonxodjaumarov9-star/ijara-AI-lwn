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
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { calcDailySalary } from "@/lib/employee-salary";
import { zResolver } from "@/lib/form";
import { employeeSchema, type EmployeeInput } from "@/lib/validations";
import { formatCurrency } from "@/lib/utils";
import type { Company, Employee } from "@/types";

const OWN_COMPANY = "__own__";

const defaults: EmployeeInput = {
  fullName: "",
  phone: "",
  position: "",
  monthlySalary: 0,
  salaryPayDay: undefined,
  active: true,
  notes: "",
  companyId: null,
};

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
}) {
  const { data: companies } = useCollection<Company>("companies");
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
  const companyId = watch("companyId");
  const isPartner = Boolean(companyId);

  const activeCompanies = useMemo(
    () => companies.filter((c) => c.active),
    [companies]
  );

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
            companyId: employee.companyId ?? null,
          }
        : defaults
    );
  }, [open, employee, reset]);

  const onSubmit = async (values: EmployeeInput) => {
    const payload = {
      ...values,
      monthlySalary: values.monthlySalary ?? 0,
      salaryPayDay:
        values.monthlySalary && values.monthlySalary > 0
          ? values.salaryPayDay ?? undefined
          : null,
      companyId: values.companyId || null,
    };
    try {
      if (employee) {
        await update(employee.id, payload);
        toast.success("Ishchi yangilandi");
      } else {
        await create(payload);
        toast.success("Ishchi qo'shildi");
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
            {employee ? "Ishchini tahrirlash" : "Yangi ishchi"}
          </DialogTitle>
          <DialogDescription>
            O&apos;z ishchingiz yoki hamkor kompaniya ishchisi. Hamkor uchun
            faqat ism va telefon kifoya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kompaniya</Label>
            <Select
              value={companyId || OWN_COMPANY}
              onValueChange={(v) =>
                setValue("companyId", v === OWN_COMPANY ? null : v, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Kompaniyani tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OWN_COMPANY}>O&apos;z kompaniyamiz</SelectItem>
                {activeCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeCompanies.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Avval &quot;Kompaniya qo&apos;shish&quot; orqali hamkor
                kompaniyani kiriting.
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
              <Label>Lavozim {isPartner ? "(ixtiyoriy)" : ""}</Label>
              <Input placeholder="Masalan, farrosh" {...register("position")} />
            </div>
          </div>

          {!isPartner && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Oylik (so&apos;m)</Label>
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
          )}

          {isPartner && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Hamkor ishchi — oylik majburiy emas. Xarajatlar bo&apos;limida
              kompaniya nomi bilan ko&apos;rinadi.
            </p>
          )}

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
              {employee ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
