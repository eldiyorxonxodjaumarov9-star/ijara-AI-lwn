"use client";

import { useEffect, useState } from "react";
import { Eraser, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { apiFetch, isApiConfigured } from "@/lib/api/client";

type DemoStatus = { eligible: boolean; hasDemoData: boolean };

/** DEMO plan label stays as is; this only removes the sample records seeded at signup. */
export function ClearDemoDataBanner() {
  const { user } = useAuth();
  const { isDemo } = usePlanFeatures();
  const enabled = isApiConfigured && isDemo && user?.role === "admin";
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiFetch<DemoStatus>("/workspace/clear-demo-data")
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus(null));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !status?.eligible || !status.hasDemoData) return null;

  const clear = async () => {
    setClearing(true);
    try {
      await apiFetch("/workspace/clear-demo-data", { method: "POST", body: {} });
      toast.success("Demo ma’lumotlar tozalandi. Endi real ma’lumotlarni kiritishingiz mumkin.");
      setOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo ma’lumotlarni tozalashda xatolik");
      setClearing(false);
    }
  };

  return (
    <>
      <div className="app-panel flex flex-col gap-3 border border-amber-400/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Hozir namunaviy (demo) ma’lumotlar ko‘rsatilmoqda</p>
          <p className="text-sm text-muted-foreground">Platformani real ish uchun 0 dan boshlash</p>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0">
          <Eraser className="size-4" />
          Demo ma’lumotlarni tozalash
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !clearing && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demo ma’lumotlarni tozalaysizmi?</DialogTitle>
            <DialogDescription>
              Demo xonalar, mehmonlar, bronlar, ijaralar, to‘lovlar va boshqa namunaviy yozuvlar o‘chiriladi.
              Workspace va akkauntingiz saqlanadi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={clearing}>
              Bekor qilish
            </Button>
            <Button variant="destructive" onClick={() => void clear()} disabled={clearing}>
              {clearing && <Loader2 className="size-4 animate-spin" />}
              Demo ma’lumotlarni tozalash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
