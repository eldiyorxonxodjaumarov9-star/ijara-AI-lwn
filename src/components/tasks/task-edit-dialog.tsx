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
import type { Employee, WorkTask, WorkTaskPriority } from "@/types";

type FormValues = {
  assignedEmployeeId: string;
  title: string;
  description: string;
  priority: WorkTaskPriority;
  dueAt: string;
  notifyTelegram: boolean;
};

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  employees,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: WorkTask | null;
  employees: Employee[];
  mode: "edit" | "reassign";
  onSaved: (task: WorkTask) => void;
}) {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: {
      assignedEmployeeId: "",
      title: "",
      description: "",
      priority: "NORMAL",
      dueAt: "",
      notifyTelegram: true,
    },
  });

  const unit = task?.unit ?? "SUNNUR";

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (!e.active) return false;
      const u = matchEmployeeUnit(e.companyName);
      if (unit === "SUNNUR") {
        return u === EMPLOYEE_UNIT.SUNNUR || isSunnurCompanyName(e.companyName);
      }
      return u === EMPLOYEE_UNIT.LWN || isLwnCompanyName(e.companyName);
    });
  }, [employees, unit]);

  useEffect(() => {
    if (!open || !task) return;
    reset({
      assignedEmployeeId: task.assignedEmployeeId,
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      dueAt: toLocalInput(task.dueAt),
      notifyTelegram: true,
    });
  }, [open, task, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!task) return;
    if (!values.assignedEmployeeId) {
      toast.error("Xodimni tanlang");
      return;
    }
    setSaving(true);
    try {
      const body =
        mode === "reassign"
          ? {
              assignedEmployeeId: values.assignedEmployeeId,
              notifyTelegram: values.notifyTelegram,
            }
          : {
              title: values.title,
              description: values.description || null,
              priority: values.priority,
              dueAt: values.dueAt || null,
              assignedEmployeeId: values.assignedEmployeeId,
              notifyTelegram: values.notifyTelegram,
            };
      const res = await apiFetch<{
        task: WorkTask;
        telegramDelivery?: string | null;
        telegramError?: string | null;
      }>(`/tasks/${task.id}`, { method: "PATCH", body });
      if (res.telegramDelivery === "FAILED") {
        toast.warning(
          res.telegramError
            ? `Saqlandi, Telegram: ${res.telegramError}`
            : "Saqlandi, Telegramga yuborilmadi"
        );
      } else {
        toast.success(mode === "reassign" ? "Xodim almashtirildi" : "Vazifa yangilandi");
      }
      if (res.task) onSaved(res.task);
      onOpenChange(false);
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
          <DialogTitle>
            {mode === "reassign" ? "Boshqa xodimga berish" : "Vazifani tahrirlash"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "edit" ? (
            <>
              <div className="space-y-2">
                <Label>Sarlavha</Label>
                <Input {...register("title", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Tavsif</Label>
                <Textarea rows={3} {...register("description")} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </>
          ) : null}
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
          {(mode === "reassign" ||
            watch("assignedEmployeeId") !== task?.assignedEmployeeId) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("notifyTelegram")} />
              Telegram orqali xabar yuborish
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
