"use client";

import { useEffect, useRef, useState } from "react";
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
import { MONTHS_UZ_FULL } from "@/lib/analytics";
import { notifyTenantPaymentLocal } from "@/lib/payment-reminders";
import { getTashkentDateParts, formatTashkentDate } from "@/lib/payment-due-schedule";
import { zResolver } from "@/lib/form";
import { paymentSchema, type PaymentInput } from "@/lib/validations";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import type { Contract, Payment, PaymentMethod } from "@/types";

function paymentFingerprint(values: {
  contractId: string;
  amount: number;
  periodYear: number;
  periodMonth: number;
  method: string;
}) {
  return [
    values.contractId,
    values.amount,
    values.periodYear,
    values.periodMonth,
    values.method,
  ].join("|");
}

const CLIENT_DEDUPE_MS = 10 * 60_000;

function wasRecentlySubmitted(fingerprint: string) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(`pay:${fingerprint}`);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < CLIENT_DEDUPE_MS;
  } catch {
    return false;
  }
}

function markSubmitted(fingerprint: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`pay:${fingerprint}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

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
  const submittingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const nowParts = getTashkentDateParts();

  const defaults: PaymentInput = {
    contractId: "",
    amount: 0,
    date: formatTashkentDate(nowParts),
    periodYear: nowParts.year,
    periodMonth: nowParts.month,
    method: "cash",
    note: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PaymentInput>({
    resolver: zResolver<PaymentInput>(paymentSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      submittingRef.current = false;
      setSaving(false);
      const dateParts = payment
        ? getTashkentDateParts(payment.date)
        : getTashkentDateParts();
      reset(
        payment
          ? {
              contractId: payment.contractId ?? "",
              amount: payment.amount,
              date: payment.date.slice(0, 10),
              periodYear: payment.periodYear ?? dateParts.year,
              periodMonth: payment.periodMonth ?? dateParts.month,
              method: payment.method,
              note: payment.note ?? "",
            }
          : {
              ...defaults,
              date: formatTashkentDate(dateParts),
              periodYear: dateParts.year,
              periodMonth: dateParts.month,
            }
      );
    }
    // defaults o'qiladi ochilganda — reset uchun yetarli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment, reset]);

  const onContractChange = (contractId: string) => {
    setValue("contractId", contractId, { shouldValidate: true });
    const contract = contracts.find((c) => c.id === contractId);
    if (contract && !payment) {
      setValue("amount", contract.monthlyPayment, { shouldValidate: true });
    }
  };

  const onSubmit = async (values: PaymentInput) => {
    if (submittingRef.current || saving) return;
    submittingRef.current = true;
    setSaving(true);

    const contract = contracts.find((c) => c.id === values.contractId);
    const periodYear = values.periodYear ?? getTashkentDateParts(values.date).year;
    const periodMonth =
      values.periodMonth ?? getTashkentDateParts(values.date).month;
    const fingerprint = paymentFingerprint({
      contractId: values.contractId,
      amount: values.amount,
      periodYear,
      periodMonth,
      method: values.method,
    });

    if (!payment && wasRecentlySubmitted(fingerprint)) {
      toast.success("To'lov allaqachon qo'shilgan");
      submittingRef.current = false;
      setSaving(false);
      onOpenChange(false);
      return;
    }

    const payload = {
      ...values,
      periodYear,
      periodMonth,
      tenantId: contract?.tenantId,
      tenantName: contract?.tenantName,
      propertyName: contract?.propertyName,
      note:
        values.note?.trim() ||
        `${MONTHS_UZ_FULL[periodMonth - 1]} ${periodYear} oyi uchun`,
    };

    try {
      if (payment) {
        await update(payment.id, payload);
        toast.success("To'lov yangilandi");
      } else {
        await create(payload);
        markSubmitted(fingerprint);
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
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Xatolik yuz berdi"
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => nowParts.year - 2 + i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{payment ? "To'lovni tahrirlash" : "Yangi to'lov"}</DialogTitle>
          <DialogDescription>
            To&apos;lov qaysi oy uchun ekanini belgilang — shu oy uchun summa
            doim saqlanib qoladi. Bir marta «Qo&apos;shish» bosing.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (submittingRef.current || saving) return;
            void handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Shartnoma</Label>
            <Select
              value={watch("contractId")}
              onValueChange={onContractChange}
              disabled={saving}
            >
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
            {errors.contractId && (
              <p className="text-xs text-destructive">
                {errors.contractId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Qaysi oy uchun</Label>
              <Select
                value={String(watch("periodMonth") ?? nowParts.month)}
                onValueChange={(v) =>
                  setValue("periodMonth", Number(v), { shouldValidate: true })
                }
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_UZ_FULL.map((label, i) => (
                    <SelectItem key={label} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Yil</Label>
              <Select
                value={String(watch("periodYear") ?? nowParts.year)}
                onValueChange={(v) =>
                  setValue("periodYear", Number(v), { shouldValidate: true })
                }
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label>Qabul qilingan sana</Label>
              <Input type="date" disabled={saving} {...register("date")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>To&apos;lov usuli</Label>
            <Select
              value={watch("method")}
              onValueChange={(v) => setValue("method", v as PaymentMethod)}
              disabled={saving}
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
            <Textarea
              placeholder="Ixtiyoriy"
              disabled={saving}
              {...register("note")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {payment ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
