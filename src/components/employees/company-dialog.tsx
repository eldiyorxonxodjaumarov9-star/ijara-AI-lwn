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
import { useCollectionActions } from "@/hooks/use-collection";
import { zResolver } from "@/lib/form";
import { companySchema, type CompanyInput } from "@/lib/validations";
import type { Company } from "@/types";

const defaults: CompanyInput = {
  name: "",
  phone: "",
  notes: "",
  active: true,
};

export function CompanyDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
}) {
  const { create, update } = useCollectionActions<Company>("companies");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyInput>({
    resolver: zResolver<CompanyInput>(companySchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      company
        ? {
            name: company.name,
            phone: company.phone ?? "",
            notes: company.notes ?? "",
            active: company.active,
          }
        : defaults
    );
  }, [open, company, reset]);

  const onSubmit = async (values: CompanyInput) => {
    try {
      if (company) {
        await update(company.id, values);
        toast.success("Kompaniya yangilandi");
      } else {
        await create(values);
        toast.success("Kompaniya qo'shildi");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {company ? "Kompaniyani tahrirlash" : "Hamkor kompaniya"}
          </DialogTitle>
          <DialogDescription>
            Hamkor kompaniya nomini kiriting — keyin uning ishchilarini
            qo&apos;shasiz.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kompaniya nomi</Label>
            <Input placeholder="Masalan, ABC Servis" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Telefon (ixtiyoriy)</Label>
            <Input placeholder="+998..." {...register("phone")} />
          </div>

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
              {company ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
