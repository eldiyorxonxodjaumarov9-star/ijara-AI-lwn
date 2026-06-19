"use client";

import { useEffect } from "react";
import { Wallet } from "lucide-react";

import { MoneyInput } from "@/components/shared/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHOD_MAP, PROPERTY_STATUS_MAP } from "@/lib/constants";
import type { TenantPaymentStatus } from "@/lib/tenant-room-assign";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethod, Property } from "@/types";

export function TenantRoomFields({
  roomId,
  onRoomIdChange,
  selectableRooms,
  selectedRoom,
  paymentStatus,
  onPaymentStatusChange,
  paymentMethod,
  onPaymentMethodChange,
  paymentAmount,
  onPaymentAmountChange,
  paymentDate,
  onPaymentDateChange,
  rentFallback = 0,
  required = false,
}: {
  roomId: string;
  onRoomIdChange: (id: string) => void;
  selectableRooms: Property[];
  selectedRoom?: Property;
  paymentStatus: TenantPaymentStatus;
  onPaymentStatusChange: (status: TenantPaymentStatus) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  paymentAmount: number;
  onPaymentAmountChange: (amount: number) => void;
  paymentDate: string;
  onPaymentDateChange: (date: string) => void;
  rentFallback?: number;
  required?: boolean;
}) {
  useEffect(() => {
    if (!selectedRoom) return;
    onPaymentAmountChange(
      selectedRoom.price > 0 ? selectedRoom.price : rentFallback
    );
  }, [selectedRoom, rentFallback, onPaymentAmountChange]);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label>
          LWN xonasi {required && <span className="text-destructive">*</span>}
        </Label>
        <Select value={roomId} onValueChange={onRoomIdChange}>
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
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Xona narxi</p>
            <p className="font-semibold">{formatCurrency(selectedRoom.price)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Maydon</p>
            <p className="font-semibold">{selectedRoom.area || "—"} m²</p>
          </div>
        </div>
      )}

      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="size-4 text-primary" />
          To&apos;lov holati
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={paymentStatus === "paid" ? "default" : "outline"}
            onClick={() => onPaymentStatusChange("paid")}
          >
            To&apos;lov qilindi
          </Button>
          <Button
            type="button"
            size="sm"
            variant={paymentStatus === "debt" ? "default" : "outline"}
            onClick={() => onPaymentStatusChange("debt")}
          >
            Qarzga
          </Button>
        </div>

        {paymentStatus === "paid" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>To&apos;lov usuli</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => onPaymentMethodChange(v as PaymentMethod)}
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
                <MoneyInput value={paymentAmount} onChange={onPaymentAmountChange} />
              </div>
              <div className="space-y-1.5">
                <Label>Sana</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => onPaymentDateChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : (
          <Badge variant="destructive">Qarzga — to&apos;lov keyinroq kiritiladi</Badge>
        )}
      </div>
    </div>
  );
}
