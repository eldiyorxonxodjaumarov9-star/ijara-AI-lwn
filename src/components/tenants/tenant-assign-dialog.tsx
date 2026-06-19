"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, DoorOpen, Wallet } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/shared/money-input";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollection } from "@/hooks/use-collection";
import { PAYMENT_METHOD_MAP, PROPERTY_STATUS_MAP } from "@/lib/constants";
import { filterLwnRooms } from "@/lib/lwn-rooms";
import {
  assignTenantToRoom,
  getTenantContract,
  type TenantPaymentStatus,
} from "@/lib/tenant-room-assign";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Contract, PaymentMethod, Property, Tenant } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);

export function TenantAssignDialog({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
}) {
  const { data: properties } = useCollection<Property>("properties");
  const { data: contracts } = useCollection<Contract>("contracts");

  const [roomId, setRoomId] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<TenantPaymentStatus>("debt");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(today());
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!open || !tenant) return;
    const initialRoom =
      existingContract?.propertyId ??
      selectableRooms[0]?.id ??
      "";
    setRoomId(initialRoom);
    setPaymentStatus("debt");
    setPaymentMethod("cash");
    setPaymentDate(today());
  }, [open, tenant, existingContract?.propertyId, selectableRooms]);

  useEffect(() => {
    if (!selectedRoom) return;
    setPaymentAmount(
      selectedRoom.price > 0 ? selectedRoom.price : tenant?.rentAmount ?? 0
    );
  }, [selectedRoom, tenant?.rentAmount]);

  async function handleSave() {
    if (!tenant || !roomId) {
      toast.error("Xonani tanlang");
      return;
    }
    const room = lwnRooms.find((r) => r.id === roomId);
    if (!room) {
      toast.error("Xona topilmadi");
      return;
    }

    setSaving(true);
    try {
      await assignTenantToRoom({
        tenant,
        room,
        paymentStatus,
        paymentMethod: paymentStatus === "paid" ? paymentMethod : undefined,
        paymentAmount: paymentStatus === "paid" ? paymentAmount : undefined,
        paymentDate: paymentStatus === "paid" ? paymentDate : undefined,
      });
      toast.success(
        paymentStatus === "paid"
          ? "Xona biriktirildi va to'lov qayd etildi"
          : "Xona biriktirildi (qarzga)"
      );
      onOpenChange(false);
    } catch {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="size-5 text-primary" />
            Xonaga biriktirish
          </DialogTitle>
          <DialogDescription>
            {tenant.fullName} — LWN xonasini tanlang va to&apos;lov holatini
            belgilang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{tenant.fullName}</p>
            <p className="text-muted-foreground">{tenant.phone}</p>
            {existingContract && (
              <p className="mt-2 text-xs text-muted-foreground">
                Joriy xona:{" "}
                <span className="font-medium text-foreground">
                  {existingContract.propertyName ?? "—"}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>LWN xonasi</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Xonani tanlang" />
              </SelectTrigger>
              <SelectContent>
                {selectableRooms.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    Bo&apos;sh xona yo&apos;q
                  </SelectItem>
                ) : (
                  selectableRooms.map((room) => {
                    const st = PROPERTY_STATUS_MAP[room.status];
                    return (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} — {formatCurrency(room.price)}
                        {room.area > 0 ? ` · ${room.area} m²` : ""}
                        {st ? ` (${st.label})` : ""}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedRoom && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Ijara narxi</p>
                <p className="font-semibold">{formatCurrency(selectedRoom.price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Maydon</p>
                <p className="font-semibold">{selectedRoom.area || "—"} m²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kirish</p>
                <p>{tenant.entryDate ? formatDate(tenant.entryDate) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shartnoma</p>
                <p>{tenant.contractDuration ?? 12} oy</p>
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2 font-medium">
              <Wallet className="size-4 text-primary" />
              To&apos;lov holati
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={paymentStatus === "paid" ? "default" : "outline"}
                onClick={() => setPaymentStatus("paid")}
              >
                To&apos;lov qilindi
              </Button>
              <Button
                type="button"
                size="sm"
                variant={paymentStatus === "debt" ? "default" : "outline"}
                onClick={() => setPaymentStatus("debt")}
              >
                Qarzga
              </Button>
            </div>

            {paymentStatus === "paid" ? (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label>To&apos;lov usuli</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{PAYMENT_METHOD_MAP.cash}</SelectItem>
                      <SelectItem value="card">{PAYMENT_METHOD_MAP.card}</SelectItem>
                      <SelectItem value="bank">{PAYMENT_METHOD_MAP.bank}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Summa</Label>
                    <MoneyInput
                      value={paymentAmount}
                      onChange={setPaymentAmount}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sana</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Badge variant="destructive" className="mt-1">
                Qarzga — to&apos;lov keyinroq kiritiladi
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={handleSave} disabled={saving || !roomId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
