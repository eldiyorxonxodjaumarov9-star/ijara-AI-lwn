"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
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
import { ApiError, isApiConfigured } from "@/lib/api/client";
import { useCollectionActions } from "@/hooks/use-collection";
import { syncContractFromTenant } from "@/lib/contract-sync";
import { tenantSchema, type TenantInput } from "@/lib/validations";
import { zResolver } from "@/lib/form";
import type { Tenant } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);

const defaults = (): TenantInput => ({
  fullName: "",
  phone: "",
  rentAmount: 0,
  entryDate: today(),
  paymentDueDate: today(),
  contractDuration: 12,
});

function toDateInput(value?: string) {
  if (!value) return today();
  return value.slice(0, 10);
}

function buildTenantPayload(values: TenantInput, existing?: Tenant | null) {
  return {
    fullName: values.fullName,
    phone: values.phone,
    rentAmount: values.rentAmount ?? 0,
    passport: existing?.passport ?? "",
    telegram: existing?.telegram,
    email: existing?.email,
    entryDate: values.entryDate,
    paymentDueDate: values.paymentDueDate,
    contractDuration: values.contractDuration,
  };
}

export function TenantDialog({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant | null;
}) {
  const { create, update } = useCollectionActions<Tenant>("tenants");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenantInput>({
    resolver: zResolver<TenantInput>(tenantSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (!open) return;
    if (tenant) {
      reset({
        fullName: tenant.fullName,
        phone: tenant.phone,
        rentAmount: tenant.rentAmount ?? 0,
        entryDate: toDateInput(tenant.entryDate),
        paymentDueDate: toDateInput(tenant.paymentDueDate),
        contractDuration: tenant.contractDuration ?? 12,
      });
    } else {
      reset(defaults());
    }
  }, [open, tenant, reset]);

  const onSubmit = async (values: TenantInput) => {
    try {
      const payload = buildTenantPayload(values, tenant);
      let savedId = tenant?.id;
      if (tenant) {
        await update(tenant.id, payload);
        savedId = tenant.id;
        toast.success("Arendator yangilandi");
      } else {
        savedId = await create(payload);
        toast.success("Arendator qo'shildi");
      }

      if (!isApiConfigured && savedId) {
        await syncContractFromTenant({
          id: savedId,
          fullName: values.fullName,
          phone: values.phone,
          passport: payload.passport,
          rentAmount: values.rentAmount ?? 0,
          contractDuration: payload.contractDuration,
          entryDate: payload.entryDate,
          paymentDueDate: payload.paymentDueDate,
          createdAt: tenant?.createdAt ?? new Date().toISOString(),
        });
      }

      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Xatolik yuz berdi";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {tenant ? "Arendatorni tahrirlash" : "Yangi arendator"}
          </DialogTitle>
          <DialogDescription>
            Arendator va shartnoma ma&apos;lumotlarini kiriting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>F.I.O</Label>
              <Input placeholder="To'liq ism" {...register("fullName")} />
              {errors.fullName && (
                <p className="text-xs text-destructive">
                  {errors.fullName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input placeholder="+998..." {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Ijara summasi (so&apos;m)</Label>
              <MoneyInput
                value={watch("rentAmount") ?? 0}
                onChange={(v) =>
                  setValue("rentAmount", v, { shouldValidate: true })
                }
              />
              {errors.rentAmount && (
                <p className="text-xs text-destructive">
                  {errors.rentAmount.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Arenda kirish</Label>
              <Input type="date" {...register("entryDate")} />
              {errors.entryDate && (
                <p className="text-xs text-destructive">
                  {errors.entryDate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Arenda to&apos;lov qilish muddati</Label>
              <Input type="date" {...register("paymentDueDate")} />
              {errors.paymentDueDate && (
                <p className="text-xs text-destructive">
                  {errors.paymentDueDate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Shartnoma muddati (oy)</Label>
              <Input type="number" min={1} {...register("contractDuration")} />
              {errors.contractDuration && (
                <p className="text-xs text-destructive">
                  {errors.contractDuration.message}
                </p>
              )}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {tenant ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
