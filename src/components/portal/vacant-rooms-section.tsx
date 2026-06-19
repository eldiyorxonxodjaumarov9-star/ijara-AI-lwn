"use client";

import Image from "next/image";
import { Building2, MapPin, Maximize, Phone } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LANDLORD_CONTACT, PROPERTY_STATUS_MAP } from "@/lib/constants";
import { useLanguage } from "@/context/language-context";
import { formatCurrency } from "@/lib/utils";
import type { Property } from "@/types";

export function VacantRoomsSection({
  properties,
  loading,
}: {
  properties: Property[];
  loading?: boolean;
}) {
  const { t } = useLanguage();
  const vacantRooms = properties.filter((p) => p.status === "available");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          {t("portal.vacantRooms")}
        </CardTitle>
        <CardDescription>{t("portal.vacantRoomsDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : vacantRooms.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t("portal.noVacantRooms")}
            description={t("portal.noVacantRoomsDesc")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vacantRooms.map((property) => {
              const status = PROPERTY_STATUS_MAP[property.status];
              return (
                <div
                  key={property.id}
                  className="overflow-hidden rounded-xl border bg-card"
                >
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {property.images?.[0] ? (
                      <Image
                        src={property.images[0]}
                        alt={property.name}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 400px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Building2 className="size-10 text-muted-foreground/40" />
                      </div>
                    )}
                    <Badge
                      variant={status.variant}
                      className="absolute left-3 top-3 shadow-sm"
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="font-semibold">{property.name}</p>
                      <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        {property.address}, {property.district}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>{property.rooms} xona</span>
                      <span className="flex items-center gap-1">
                        <Maximize className="size-3.5" />
                        {property.area} m²
                      </span>
                    </div>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(property.price)}
                      {t("portal.perMonth")}
                    </p>
                    {property.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {property.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button asChild variant="outline" size="sm">
                        <a href={`tel:${LANDLORD_CONTACT.phone}`}>
                          <Phone className="mr-1.5 size-4" />
                          {t("portal.call")}
                        </a>
                      </Button>
                      <Button asChild size="sm">
                        <a
                          href={`https://t.me/${LANDLORD_CONTACT.telegram.replace("@", "")}?text=${encodeURIComponent(
                            `${property.name} — ${t("portal.vacantInquiry")}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("portal.vacantContact")}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
