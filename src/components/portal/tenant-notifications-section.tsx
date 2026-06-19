"use client";

import { useEffect, useState } from "react";
import { Bell, AlertTriangle } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { isApiConfigured } from "@/lib/api/client";
import {
  fetchTenantNotifications,
  readTenantLocalNotifications,
} from "@/lib/payment-reminders";
import { formatDate } from "@/lib/utils";
import type { AppNotification } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function TenantNotificationsSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.tenantId) {
        setLoading(false);
        return;
      }

      try {
        if (isApiConfigured && user.displayName && user.phone) {
          const remote = await fetchTenantNotifications(
            user.displayName,
            user.phone
          );
          if (!cancelled) setItems(remote);
        } else {
          const local = readTenantLocalNotifications(user.tenantId);
          if (!cancelled) setItems(local);
        }
      } catch {
        const local = readTenantLocalNotifications(user.tenantId);
        if (!cancelled) setItems(local);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.tenantId, user?.displayName, user?.phone]);

  if (loading || items.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-amber-600" />
          Xabarlar
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((n) => (
          <div
            key={n.id}
            className="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{n.title}</p>
              <p className="mt-1 text-muted-foreground">{n.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDate(n.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
