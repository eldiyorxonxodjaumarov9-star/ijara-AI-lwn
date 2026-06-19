"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ImageUpload } from "@/components/shared/image-upload";
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
import { PROPERTY_STATUS_MAP } from "@/lib/constants";
import { zResolver } from "@/lib/form";
import { lwnRoomToProperty, propertyToLwnForm } from "@/lib/lwn-rooms";
import { lwnRoomSchema, type LwnRoomInput } from "@/lib/validations";
import type { Property, PropertyStatus } from "@/types";

const defaults: LwnRoomInput = {
  name: "",
  price: 0,
  area: 0,
  status: "available",
  images: [],
  description: "",
};

export function LwnRoomDialog({
  open,
  onOpenChange,
  room,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: Property | null;
}) {
  const { create, update } = useCollectionActions<Property>("properties");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LwnRoomInput>({
    resolver: zResolver<LwnRoomInput>(lwnRoomSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!open) return;
    reset(room ? propertyToLwnForm(room) : defaults);
  }, [open, room, reset]);

  const onSubmit = async (values: LwnRoomInput) => {
    try {
      const payload = lwnRoomToProperty(values);
      if (room) {
        await update(room.id, { ...payload, updatedAt: new Date().toISOString() });
        toast.success("Xona yangilandi");
      } else {
        await create(payload);
        toast.success("Xona qo'shildi");
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
          <DialogTitle>{room ? "Xonani tahrirlash" : "Yangi xona"}</DialogTitle>
          <DialogDescription>
            LWN xona ma&apos;lumotlari: raqam, narx, kv va holat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Xona raqami / nomi</Label>
              <Input placeholder="Masalan: 201, G1, G4 Logistics" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Ijara narxi (so&apos;m)</Label>
              <MoneyInput
                value={watch("price") ?? 0}
                onChange={(v) => setValue("price", v, { shouldValidate: true })}
              />
              {errors.price && (
                <p className="text-xs text-destructive">{errors.price.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Maydoni (m²)</Label>
              <Input
                type="number"
                min={1}
                step="0.1"
                placeholder="Kv metr"
                {...register("area")}
              />
              {errors.area && (
                <p className="text-xs text-destructive">{errors.area.message}</p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Holati</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as PropertyStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bo'sh yoki band" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROPERTY_STATUS_MAP).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Izoh (ixtiyoriy)</Label>
              <Textarea
                placeholder="Qo'shimcha ma'lumot..."
                rows={2}
                {...register("description")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Xona rasmi</Label>
              <ImageUpload
                folder="lwn-rooms"
                value={watch("images") ?? []}
                onChange={(urls) => setValue("images", urls, { shouldValidate: true })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {room ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
