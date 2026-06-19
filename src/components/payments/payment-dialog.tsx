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
import { isApiConfigured } from "@/lib/api/client";
import { notifyTenantPaymentLocal } from "@/lib/payment-reminders";
import { zResolver } from "@/lib/form";
import { paymentSchema, type PaymentInput } from "@/lib/validations";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import type { Contract, Payment, PaymentMethod } from "@/types";

const today = new Date().toISOString().slice(0, 10);

const defaults: PaymentInput = {
  contractId: "",
  amount: 0,
  date: today,
  method: "cash",
  note: "",
};

export function PaymentDialog({
  open,
  onOpenChange,
  payment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: Payment | null;
}) {
  const { data: contracts } = useCollection<Contract>("contracts");
  const { create, update } = useCollectionActions<Payment>("payments");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zResolver<PaymentInput>(paymentSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open)
      reset(
        payment
          ? {
              contractId: payment.contractId ?? "",
              amount: payment.amount,
              date: payment.date.slice(0, 10),
              method: payment.method,
              note: payment.note ?? "",
            }
          : defaults
      );
  }, [open, payment, reset]);

  const onContractChange = (contractId: string) => {
    setValue("contractId", contractId);
    const contract = contracts.find((c) => c.id === contractId);
    if (contract && !payment) {
      setValue("amount", contract.monthlyPayment);
    }
  };

  const onSubmit = async (values: PaymentInput) => {
    const contract = contracts.find((c) => c.id === values.contractId);
    const payload = {
      ...values,
      tenantId: contract?.tenantId,
      tenantName: contract?.tenantName,
      propertyName: contract?.propertyName,
    };
    try {
      if (payment) {
        await update(payment.id, payload);
        toast.success("To'lov yangilandi");
      } else {
        await create(payload);
        if (!isApiConfigured && contract?.tenantId) {
          notifyTenantPaymentLocal(
            contract.tenantId,
            contract.tenantName ?? "Arendator",
            contract.propertyName ?? "—",
            values.amount
          );
        }
        toast.success("To'lov qo'shildi");
      }
      onOpenChange(false);
    } catch {
      toast.error("Xatolik yuz berdi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{payment ? "To'lovni tahrirlash" : "Yangi to'lov"}</DialogTitle>
          <DialogDescription>To&apos;lov ma&apos;lumotlari.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Shartnoma</Label>
            <Select value={watch("contractId")} onValueChange={onContractChange}>
              <SelectTrigger>
                <SelectValue placeholder="Shartnomani tanlang" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.propertyName} — {c.tenantName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>To&apos;langan summa</Label>
              <MoneyInput
                value={watch("amount") ?? 0}
                onChange={(v) => setValue("amount", v, { shouldValidate: true })}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Sana</Label>
              <Input type="date" {...register("date")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>To&apos;lov usuli</Label>
            <Select
              value={watch("method")}
              onValueChange={(v) => setValue("method", v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_MAP).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Izoh</Label>
            <Textarea placeholder="Masalan: Iyun oyi uchun" {...register("note")} />
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
              {payment ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
