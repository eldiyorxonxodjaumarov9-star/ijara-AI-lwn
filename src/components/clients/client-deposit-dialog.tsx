"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyClientDeposit } from "@/lib/deposit-sync-client";
import { formatCurrency } from "@/lib/utils";
import { refreshCollection } from "@/lib/data/store";
import type { Client } from "@/types";

export function ClientDepositDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}) {
  const [depositPaid, setDepositPaid] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !client) return;
    setDepositPaid(client.depositPaid ?? false);
    setDepositAmount(client.depositAmount ?? 0);
  }, [open, client]);

  const onSave = async () => {
    if (!client) return;
    if (depositPaid && depositAmount <= 0) {
      toast.error("Depozit summasini kiriting");
      return;
    }
    setSaving(true);
    try {
      await applyClientDeposit(client, depositPaid, depositAmount);
      await Promise.all([
        refreshCollection("clients"),
        refreshCollection("tenants"),
        refreshCollection("contracts"),
      ]);
      toast.success("Depozit saqlandi");
      onOpenChange(false);
    } catch {
      toast.error("Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Depozit — {client.fullName}</DialogTitle>
          <DialogDescription>
            Klient depozit holati va summasi. O&apos;zgarish arendator va
            shartnomaga ham yoziladi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Hozirgi holat</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={client.depositPaid ? "default" : "secondary"}>
                {client.depositPaid ? "Depozit berilgan" : "Depozit berilmagan"}
              </Badge>
              {client.depositPaid && (client.depositAmount ?? 0) > 0 && (
                <span className="font-medium">
                  {formatCurrency(client.depositAmount ?? 0)}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={depositPaid ? "default" : "outline"}
              className="flex-1"
              onClick={() => setDepositPaid(true)}
            >
              Berilgan
            </Button>
            <Button
              type="button"
              variant={!depositPaid ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setDepositPaid(false);
                setDepositAmount(0);
              }}
            >
              Berilmagan
            </Button>
          </div>

          {depositPaid && (
            <div className="space-y-1.5">
              <Label>Depozit summasi (so&apos;m)</Label>
              <MoneyInput
                value={depositAmount}
                onChange={setDepositAmount}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
