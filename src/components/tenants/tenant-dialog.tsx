"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { tenantSchema, type TenantInput } from "@/lib/validations";
import { zResolver } from "@/lib/form";
import type { Tenant } from "@/types";

const defaults: TenantInput = {
  fullName: "",
  phone: "",
  passport: "",
  telegram: "",
  email: "",
  contractDuration: 12,
  rentAmount: 0,
};

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
    formState: { errors, isSubmitting },
  } = useForm<TenantInput>({
    resolver: zResolver<TenantInput>(tenantSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(tenant ? { ...defaults, ...tenant } : defaults);
  }, [open, tenant, reset]);

  const onSubmit = async (values: TenantInput) => {
    try {
      if (tenant) {
        await update(tenant.id, values);
        toast.success("Arendator yangilandi");
      } else {
        await create(values);
        toast.success("Arendator qo'shildi");
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
            {tenant ? "Arendatorni tahrirlash" : "Yangi arendator"}
          </DialogTitle>
          <DialogDescription>Arendator ma&apos;lumotlari.</DialogDescription>
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
              <Label>Passport</Label>
              <Input placeholder="AA1234567" {...register("passport")} />
              {errors.passport && (
                <p className="text-xs text-destructive">
                  {errors.passport.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Telegram</Label>
              <Input placeholder="@username" {...register("telegram")} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Shartnoma muddati (oy)</Label>
              <Input type="number" {...register("contractDuration")} />
            </div>
            <div className="space-y-1.5">
              <Label>Ijara summasi (so&apos;m)</Label>
              <Input type="number" {...register("rentAmount")} />
              {errors.rentAmount && (
                <p className="text-xs text-destructive">
                  {errors.rentAmount.message}
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
