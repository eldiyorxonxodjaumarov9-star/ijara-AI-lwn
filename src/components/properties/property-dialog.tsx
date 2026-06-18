"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { MoneyInput } from "@/components/shared/money-input";
import { useCollectionActions } from "@/hooks/use-collection";
import { propertySchema, type PropertyInput } from "@/lib/validations";
import { zResolver } from "@/lib/form";
import { PROPERTY_STATUS_MAP, UZ_REGIONS } from "@/lib/constants";
import type { Property, PropertyStatus } from "@/types";

const defaults: PropertyInput = {
  name: "",
  address: "",
  region: "",
  district: "",
  price: 0,
  status: "available",
  rooms: 1,
  area: 0,
  description: "",
  images: [],
};

export function PropertyDialog({
  open,
  onOpenChange,
  property,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property | null;
}) {
  const { create, update } = useCollectionActions<Property>("properties");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PropertyInput>({
    resolver: zResolver<PropertyInput>(propertySchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(property ? { ...defaults, ...property } : defaults);
    }
  }, [open, property, reset]);

  const onSubmit = async (values: PropertyInput) => {
    try {
      if (property) {
        await update(property.id, { ...values, updatedAt: new Date().toISOString() });
        toast.success("Mulk yangilandi");
      } else {
        await create(values);
        toast.success("Mulk qo'shildi");
      }
      onOpenChange(false);
    } catch {
      toast.error("Xatolik yuz berdi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{property ? "Mulkni tahrirlash" : "Yangi mulk"}</DialogTitle>
          <DialogDescription>
            Mulk haqidagi ma&apos;lumotlarni to&apos;ldiring.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nomi</Label>
              <Input placeholder="Masalan: Yunusobod kvartira" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Viloyat</Label>
              <Select
                value={watch("region")}
                onValueChange={(v) => setValue("region", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {UZ_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.region && (
                <p className="text-xs text-destructive">{errors.region.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tuman</Label>
              <Input placeholder="Tuman" {...register("district")} />
              {errors.district && (
                <p className="text-xs text-destructive">
                  {errors.district.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Manzil</Label>
              <Input placeholder="Ko'cha, uy raqami" {...register("address")} />
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Narxi (so&apos;m / oy)</Label>
              <MoneyInput
                value={watch("price") ?? 0}
                onChange={(v) => setValue("price", v, { shouldValidate: true })}
              />
              {errors.price && (
                <p className="text-xs text-destructive">{errors.price.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Holati</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as PropertyStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROPERTY_STATUS_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Xonalar soni</Label>
              <Input type="number" {...register("rooms")} />
            </div>

            <div className="space-y-1.5">
              <Label>Kvadrat metr (m²)</Label>
              <Input type="number" {...register("area")} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tavsif</Label>
              <Textarea
                placeholder="Mulk haqida qisqacha..."
                {...register("description")}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Rasmlar</Label>
              <ImageUpload
                folder="properties"
                value={watch("images") ?? []}
                onChange={(urls) => setValue("images", urls)}
              />
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
              {property ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
