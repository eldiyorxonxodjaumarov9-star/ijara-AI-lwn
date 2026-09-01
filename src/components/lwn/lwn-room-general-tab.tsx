"use client";

import Image from "next/image";
import { DoorOpen, Maximize } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PROPERTY_STATUS_MAP, CONTRACT_STATUS_MAP } from "@/lib/constants";
import {
  getRoomAddressLabel,
  getRoomObjectLabel,
  type RoomTenantRow,
} from "@/lib/lwn-room-detail";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Property } from "@/types";

export function LwnRoomGeneralTab({
  room,
  tenants,
}: {
  room: Property;
  tenants: RoomTenantRow[];
}) {
  const status = PROPERTY_STATUS_MAP[room.status];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <h3 className="font-medium">Xona ma&apos;lumotlari</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Xona</dt>
                <dd className="font-medium text-right">{room.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Obyekt</dt>
                <dd className="text-right">{getRoomObjectLabel(room)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Manzil</dt>
                <dd className="text-right">{getRoomAddressLabel(room)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Ijara holati</dt>
                <dd>
                  <Badge variant={status?.variant}>{status?.label}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Narx</dt>
                <dd className="font-medium">{formatCurrency(room.price)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Maydon</dt>
                <dd className="inline-flex items-center gap-1">
                  <Maximize className="size-3.5 text-muted-foreground" />
                  {room.area} m²
                </dd>
              </div>
            </dl>
            {room.description?.trim() && (
              <p className="text-sm text-muted-foreground">{room.description}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 font-medium">Rasm</h3>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              {room.images[0] ? (
                <Image
                  src={room.images[0]}
                  alt={room.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <DoorOpen className="size-10 text-muted-foreground" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 font-medium">Shartnomadagi arendatorlar</h3>
          {tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ushbu xonaga faol shartnoma biriktirilmagan.
            </p>
          ) : (
            <ul className="space-y-3">
              {tenants.map((t) => {
                const cStatus = CONTRACT_STATUS_MAP[t.contractStatus];
                return (
                  <li
                    key={t.contractId}
                    className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{t.fullName}</p>
                      {t.phone?.trim() && (
                        <p className="text-sm text-muted-foreground">{t.phone}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={cStatus?.variant}>{cStatus?.label}</Badge>
                      <span className="text-muted-foreground">
                        {formatDate(t.startDate)} — {formatDate(t.endDate)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
