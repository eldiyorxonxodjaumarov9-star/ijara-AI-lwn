"use client";

import { Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { RoomAccessGrantRecord } from "@/types/smart-lock";

function isRevocableGrant(g: RoomAccessGrantRecord): boolean {
  if (g.status === "cancelled") return false;
  const sync = g.delivery?.syncStatus;
  if (!g.delivery?.hasCredential) return true;
  if (sync === "REVOKED") return false;
  return true;
}

export function LwnRoomRevokeAccessDialog({
  open,
  onOpenChange,
  grants,
  saving,
  onRevoke,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grants: RoomAccessGrantRecord[];
  saving: boolean;
  onRevoke: (grantId: string) => Promise<void>;
}) {
  const revocable = grants.filter(isRevocableGrant);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kirishni bekor qilish</DialogTitle>
          <DialogDescription>
            Faol yoki yuborilgan kirish huquqlarini bekor qiling.
          </DialogDescription>
        </DialogHeader>
        {revocable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bekor qilish uchun faol kirish huquqi topilmadi.
          </p>
        ) : (
          <ul className="space-y-3">
            {revocable.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium truncate">{g.tenantName || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.permissionType.toUpperCase()} ·{" "}
                    {formatDate(g.validFrom)} — {formatDate(g.validTo)}
                  </p>
                  <Badge variant="outline" className="font-normal">
                    {g.effectiveLabel ?? g.status}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    void onRevoke(g.id).then(() => {
                      toast.success("Kirish huquqi bekor qilindi.");
                    })
                  }
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldOff className="size-4" />
                  )}
                  Bekor qilish
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
