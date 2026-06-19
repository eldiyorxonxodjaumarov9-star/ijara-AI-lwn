"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { TenantRoomFields } from "@/components/tenants/tenant-room-fields";
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
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { filterLwnRooms } from "@/lib/lwn-rooms";
import { upsertLocalClientFromTenant } from "@/lib/tenant-client-sync";
import {
  generateTenantPassword,
  suggestTenantLogin,
} from "@/lib/tenant-credentials";
import {
  assignTenantToRoom,
  getTenantContract,
  type TenantPaymentStatus,
} from "@/lib/tenant-room-assign";
import { tenantSchema, type TenantInput } from "@/lib/validations";
import { zResolver } from "@/lib/form";
import type { Contract, PaymentMethod, Property, Tenant } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);

const defaults = (): TenantInput => ({
  fullName: "",
  phone: "",
  login: "",
  password: "",
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
    login: values.login,
    password: values.password?.trim() ? values.password : undefined,
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
  const { data: properties } = useCollection<Property>("properties");
  const { data: contracts } = useCollection<Contract>("contracts");
  const { create, update } = useCollectionActions<Tenant>("tenants");

  const [roomId, setRoomId] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<TenantPaymentStatus>("debt");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(today());

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

  const existingContract = useMemo(
    () => (tenant ? getTenantContract(tenant.id, contracts) : undefined),
    [tenant, contracts]
  );

  const lwnRooms = useMemo(() => filterLwnRooms(properties), [properties]);

  const selectableRooms = useMemo(() => {
    const currentId = existingContract?.propertyId;
    return lwnRooms.filter(
      (r) => r.status === "available" || r.id === currentId
    );
  }, [lwnRooms, existingContract?.propertyId]);

  const selectedRoom = lwnRooms.find((r) => r.id === roomId);
  const rentAmount = watch("rentAmount") ?? 0;
  const phone = watch("phone") ?? "";

  useEffect(() => {
    if (!open) return;
    if (tenant) {
      reset({
        fullName: tenant.fullName,
        phone: tenant.phone,
        login: tenant.login ?? "",
        password: "",
        rentAmount: tenant.rentAmount ?? 0,
        entryDate: toDateInput(tenant.entryDate),
        paymentDueDate: toDateInput(tenant.paymentDueDate),
        contractDuration: tenant.contractDuration ?? 12,
      });
      setRoomId(existingContract?.propertyId ?? "");
    } else {
      const password = generateTenantPassword();
      reset({
        ...defaults(),
        password,
      });
      setRoomId(selectableRooms[0]?.id ?? "");
    }
    setPaymentStatus("debt");
    setPaymentMethod("cash");
    setPaymentDate(today());
  }, [open, tenant, reset, existingContract?.propertyId, selectableRooms]);

  useEffect(() => {
    if (tenant || !open) return;
    const suggested = suggestTenantLogin(phone);
    if (suggested) {
      setValue("login", suggested, { shouldValidate: true });
    }
  }, [phone, tenant, open, setValue]);

  useEffect(() => {
    if (!selectedRoom || selectedRoom.price <= 0) return;
    setValue("rentAmount", selectedRoom.price, { shouldValidate: true });
  }, [selectedRoom, setValue]);

  const onSubmit = async (values: TenantInput) => {
    if (!tenant && !roomId) {
      toast.error("LWN xonani tanlang");
      return;
    }
    if (!tenant && (!values.password || values.password.length < 6)) {
      toast.error("Parol kamida 6 ta belgi bo'lishi kerak");
      return;
    }

    try {
      const payload = buildTenantPayload(values, tenant);
      let savedId = tenant?.id;
      if (tenant) {
        await update(tenant.id, payload);
        savedId = tenant.id;
      } else {
        savedId = await create(payload);
      }

      const savedTenant: Tenant = {
        id: savedId!,
        fullName: values.fullName,
        phone: values.phone,
        login: values.login,
        passport: payload.passport,
        rentAmount: values.rentAmount ?? 0,
        entryDate: payload.entryDate,
        paymentDueDate: payload.paymentDueDate,
        contractDuration: payload.contractDuration,
        createdAt: tenant?.createdAt ?? new Date().toISOString(),
      };

      if (roomId) {
        const room = lwnRooms.find((r) => r.id === roomId);
        if (!room) {
          toast.error("Xona topilmadi");
          return;
        }
        await assignTenantToRoom({
          tenant: savedTenant,
          room,
          paymentStatus,
          paymentMethod: paymentStatus === "paid" ? paymentMethod : undefined,
          paymentAmount: paymentStatus === "paid" ? paymentAmount : undefined,
          paymentDate: paymentStatus === "paid" ? paymentDate : undefined,
        });
      }

      if (!isApiConfigured) {
        await upsertLocalClientFromTenant(savedTenant);
      }

      if (!tenant) {
        toast.success(
          `Arendator qo'shildi. Login: ${values.login}, Parol: ${values.password}`
        );
      } else {
        toast.success("Arendator yangilandi");
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
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tenant ? "Arendatorni tahrirlash" : "Yangi arendator"}
          </DialogTitle>
          <DialogDescription>
            Arendator ma&apos;lumotlari, login/parol va LWN xonasini kiriting.
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
                value={rentAmount}
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
              <Label>Login</Label>
              <Input placeholder="user901234567" {...register("login")} />
              {errors.login && (
                <p className="text-xs text-destructive">{errors.login.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{tenant ? "Yangi parol (ixtiyoriy)" : "Parol"}</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="••••••"
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Yangi parol"
                  onClick={() =>
                    setValue("password", generateTenantPassword(), {
                      shouldValidate: true,
                    })
                  }
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              {!tenant && errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
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

          <TenantRoomFields
            roomId={roomId}
            onRoomIdChange={setRoomId}
            selectableRooms={selectableRooms}
            selectedRoom={selectedRoom}
            paymentStatus={paymentStatus}
            onPaymentStatusChange={setPaymentStatus}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            paymentAmount={paymentAmount}
            onPaymentAmountChange={setPaymentAmount}
            paymentDate={paymentDate}
            onPaymentDateChange={setPaymentDate}
            rentFallback={rentAmount}
            required={!tenant}
          />

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
