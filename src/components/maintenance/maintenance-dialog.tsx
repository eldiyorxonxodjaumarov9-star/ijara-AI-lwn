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
import { ImageUpload } from "@/components/shared/image-upload";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { zResolver } from "@/lib/form";
import { maintenanceSchema, type MaintenanceInput } from "@/lib/validations";
import { MAINTENANCE_STATUS_MAP } from "@/lib/constants";
import type { Maintenance, MaintenanceStatus, Property } from "@/types";

const defaults: MaintenanceInput = {
  propertyId: "",
  issue: "",
  status: "pending",
  cost: 0,
  images: [],
};

export function MaintenanceDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Maintenance | null;
}) {
  const { data: properties } = useCollection<Property>("properties");
  const { create, update } = useCollectionActions<Maintenance>("maintenance");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceInput>({
    resolver: zResolver<MaintenanceInput>(maintenanceSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open)
      reset(
        record
          ? {
              propertyId: record.propertyId,
              issue: record.issue,
              status: record.status,
              cost: record.cost,
              images: record.images ?? [],
            }
          : defaults
      );
  }, [open, record, reset]);

  const onSubmit = async (values: MaintenanceInput) => {
    const property = properties.find((p) => p.id === values.propertyId);
    const payload = { ...values, propertyName: property?.name };
    try {
      if (record) {
        await update(record.id, payload);
        toast.success("Ta'mirlash yangilandi");
      } else {
        await create(payload);
        toast.success("Ta'mirlash qo'shildi");
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
          <DialogTitle>
            {record ? "Ta'mirlashni tahrirlash" : "Yangi ta'mirlash"}
          </DialogTitle>
          <DialogDescription>Ta&apos;mirlash ishi ma&apos;lumotlari.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Label>Muammo</Label>
            <Textarea placeholder="Muammoni batafsil yozing..." {...register("issue")} />
            {errors.issue && (
              <p className="text-xs text-destructive">{errors.issue.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Holati</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) =>
                  setValue("status", v as MaintenanceStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MAINTENANCE_STATUS_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Xarajat (so&apos;m)</Label>
              <MoneyInput
                value={watch("cost") ?? 0}
                onChange={(v) => setValue("cost", v)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rasmlar</Label>
            <ImageUpload
              folder="maintenance"
              value={watch("images") ?? []}
              onChange={(urls) => setValue("images", urls)}
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
              {record ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
