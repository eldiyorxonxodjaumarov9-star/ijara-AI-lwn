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
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { zResolver } from "@/lib/form";
import { contractSchema, type ContractInput } from "@/lib/validations";
import { CONTRACT_STATUS_MAP } from "@/lib/constants";
import type { Contract, ContractStatus, Property, Tenant } from "@/types";

const today = new Date().toISOString().slice(0, 10);

const defaults: ContractInput = {
  propertyId: "",
  tenantId: "",
  startDate: today,
  endDate: today,
  monthlyPayment: 0,
  deposit: 0,
  depositPaid: false,
  status: "active",
  notes: "",
};

export function ContractDialog({
  open,
  onOpenChange,
  contract,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: Contract | null;
}) {
  const { data: properties } = useCollection<Property>("properties");
  const { data: tenants } = useCollection<Tenant>("tenants");
  const { create, update } = useCollectionActions<Contract>("contracts");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContractInput>({
    resolver: zResolver<ContractInput>(contractSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open)
      reset(
        contract
          ? {
              propertyId: contract.propertyId,
              tenantId: contract.tenantId,
              startDate: contract.startDate.slice(0, 10),
              endDate: contract.endDate.slice(0, 10),
              monthlyPayment: contract.monthlyPayment,
              deposit: contract.deposit ?? 0,
              depositPaid: contract.depositPaid ?? false,
              status: contract.status,
              notes: contract.notes ?? "",
            }
          : defaults
      );
  }, [open, contract, reset]);

  const onSubmit = async (values: ContractInput) => {
    const property = properties.find((p) => p.id === values.propertyId);
    const tenant = tenants.find((t) => t.id === values.tenantId);
    const payload = {
      ...values,
      propertyName: property?.name,
      tenantName: tenant?.fullName,
      signaturePlaceholder: true,
    };
    try {
      if (contract) {
        await update(contract.id, payload);
        toast.success("Shartnoma yangilandi");
      } else {
        await create(payload);
        toast.success("Shartnoma yaratildi");
      }
      onOpenChange(false);
    } catch {
      toast.error("Xatolik yuz berdi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {contract ? "Shartnomani tahrirlash" : "Yangi shartnoma"}
          </DialogTitle>
          <DialogDescription>
            Mulk va arendatorni tanlab shartnoma tuzing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mulk</Label>
              <Select
                value={watch("propertyId")}
                onValueChange={(v) => setValue("propertyId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mulkni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.propertyId && (
                <p className="text-xs text-destructive">
                  {errors.propertyId.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Arendator</Label>
              <Select
                value={watch("tenantId")}
                onValueChange={(v) => setValue("tenantId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Arendatorni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tenantId && (
                <p className="text-xs text-destructive">
                  {errors.tenantId.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Boshlanish sanasi</Label>
              <Input type="date" {...register("startDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Tugash sanasi</Label>
              <Input type="date" {...register("endDate")} />
            </div>

            <div className="space-y-1.5">
              <Label>Oylik to&apos;lov (so&apos;m)</Label>
              <MoneyInput
                value={watch("monthlyPayment") ?? 0}
                onChange={(v) =>
                  setValue("monthlyPayment", v, { shouldValidate: true })
                }
              />
              {errors.monthlyPayment && (
                <p className="text-xs text-destructive">
                  {errors.monthlyPayment.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Garov / depozit (so&apos;m)</Label>
              <MoneyInput
                value={watch("deposit") ?? 0}
                onChange={(v) => setValue("deposit", v)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Depozit holati</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={watch("depositPaid") ? "default" : "outline"}
                  onClick={() => setValue("depositPaid", true)}
                >
                  Berilgan
                </Button>
                <Button
                  type="button"
                  variant={!watch("depositPaid") ? "default" : "outline"}
                  onClick={() => {
                    setValue("depositPaid", false);
                    setValue("deposit", 0);
                  }}
                >
                  Berilmagan
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Holati</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as ContractStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_STATUS_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Izoh</Label>
              <Textarea placeholder="Qo'shimcha shartlar..." {...register("notes")} />
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            ✍️ Elektron imzo uchun joy (PDF da imzo maydonlari avtomatik
            qo&apos;shiladi)
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
              {contract ? "Saqlash" : "Yaratish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
