"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, AlertTriangle, CheckCircle2 } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { isApiConfigured } from "@/lib/api/client";
import {
  fetchTenantNotifications,
  readTenantLocalNotifications,
} from "@/lib/payment-reminders";
import { formatDate } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICON: Record<NotificationType, typeof Bell> = {
  info: Bell,
  warning: AlertTriangle,
  success: CheckCircle2,
  telegram: Bell,
};

export function TenantNotificationsSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    try {
      if (isApiConfigured) {
        const remote = await fetchTenantNotifications(user.tenantId);
        setItems(remote);
      } else {
        setItems(readTenantLocalNotifications(user.tenantId));
      }
    } catch {
      setItems(readTenantLocalNotifications(user.tenantId));
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

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
        {items.map((n) => {
          const Icon = ICON[n.type] ?? Bell;
          return (
            <div
              key={n.id}
              className="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm"
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  n.type === "success"
                    ? "text-primary"
                    : n.type === "warning"
                      ? "text-destructive"
                      : "text-muted-foreground"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 text-muted-foreground">{n.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(n.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
