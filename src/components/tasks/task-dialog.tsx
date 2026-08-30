"use client";

import { useEffect, useMemo, useState } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import {
  EMPLOYEE_UNIT,
  isLwnCompanyName,
  isSunnurCompanyName,
  matchEmployeeUnit,
} from "@/lib/employee-units";
import type { Employee, WorkTaskPriority, WorkTaskUnit } from "@/types";

type FormValues = {
  unit: WorkTaskUnit;
  assignedEmployeeId: string;
  title: string;
  description: string;
  priority: WorkTaskPriority;
  dueAt: string;
  notifyTelegram: boolean;
};

export function TaskDialog({
  open,
  onOpenChange,
  employees,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employees: Employee[];
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, watch, setValue, reset } = useForm<FormValues>({
    defaultValues: {
      unit: "SUNNUR",
      assignedEmployeeId: "",
      title: "",
      description: "",
      priority: "NORMAL",
      dueAt: "",
      notifyTelegram: true,
    },
  });

  const unit = watch("unit");

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (!e.active) return false;
      const u = matchEmployeeUnit(e.companyName);
      if (unit === "SUNNUR") {
        return (
          u === EMPLOYEE_UNIT.SUNNUR || isSunnurCompanyName(e.companyName)
        );
      }
      return u === EMPLOYEE_UNIT.LWN || isLwnCompanyName(e.companyName);
    });
  }, [employees, unit]);

  useEffect(() => {
    if (!open) return;
    reset({
      unit: "SUNNUR",
      assignedEmployeeId: "",
      title: "",
      description: "",
      priority: "NORMAL",
      dueAt: "",
      notifyTelegram: true,
    });
  }, [open, reset]);

  useEffect(() => {
    setValue("assignedEmployeeId", "");
  }, [unit, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    if (!values.assignedEmployeeId) {
      toast.error("Xodimni tanlang");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{
        telegramDelivery?: string;
        telegramError?: string | null;
      }>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          description: values.description || null,
          unit: values.unit,
          assignedEmployeeId: values.assignedEmployeeId,
          priority: values.priority,
          dueAt: values.dueAt || null,
          notifyTelegram: values.notifyTelegram,
        }),
      });
      if (res.telegramDelivery === "FAILED") {
        toast.warning(
          res.telegramError
            ? `Vazifa saqlandi, Telegram: ${res.telegramError}`
            : "Vazifa saqlandi, Telegramga yuborilmadi"
        );
      } else {
        toast.success("Vazifa yaratildi");
      }
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yangi vazifa</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Kompaniya</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("unit")}
            >
              <option value="SUNNUR">Sunnur</option>
              <option value="LWN">LWN</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Xodim</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("assignedEmployeeId")}
            >
              <option value="">Tanlang</option>
              {filteredEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                  {e.position ? ` — ${e.position}` : ""}
                  {e.telegramChatId ? "" : " (Telegram yo‘q)"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Sarlavha</Label>
            <Input {...register("title", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label>Tavsif</Label>
            <Textarea rows={3} {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ustuvorlik</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("priority")}
              >
                <option value="LOW">Past</option>
                <option value="NORMAL">Oddiy</option>
                <option value="HIGH">Yuqori</option>
                <option value="URGENT">Shoshilinch</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Muddat</Label>
              <Input type="datetime-local" {...register("dueAt")} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("notifyTelegram")} />
            Xodimga Telegram orqali yuborish
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Bekor
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yaratish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
