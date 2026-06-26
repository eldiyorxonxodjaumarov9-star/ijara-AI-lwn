"use client";

import {
  Bell,
  Check,
  CheckCheck,
  Info,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { SendPaymentRemindersButton } from "@/components/shared/send-payment-reminders-button";
import type { AppNotification, NotificationType } from "@/types";

const ICON_MAP: Record<NotificationType, typeof Info> = {
  info: Info,
  warning: TriangleAlert,
  success: CheckCheck,
  telegram: Send,
};

const TONE_MAP: Record<NotificationType, string> = {
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  success: "bg-primary/10 text-primary",
  telegram: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

export default function NotificationsPage() {
  const { data, loading } = useCollection<AppNotification>("notifications");
  const { update, remove } = useCollectionActions<AppNotification>(
    "notifications"
  );

  const markAllRead = async () => {
    await Promise.all(
      data.filter((n) => !n.read).map((n) => update(n.id, { read: true }))
    );
    toast.success("Barchasi o'qilgan deb belgilandi");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xabarlar"
        description="Bildirishnomalar markazi."
        action={
          <div className="flex flex-wrap gap-2">
            <SendPaymentRemindersButton label="Qarzdorlarga eslatma yuborish" />
            <Button variant="outline" onClick={markAllRead}>
              <Check className="size-4" /> Hammasini o&apos;qish
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : data.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Xabarlar yo'q"
            description="Qarzdorlarga to'lov eslatmasi yuborish uchun pastdagi tugmani bosing."
            action={
              <SendPaymentRemindersButton label="Qarzdorlarga eslatma yuborish" />
            }
          />
        ) : (
          data.map((n) => {
            const Icon = ICON_MAP[n.type];
            return (
              <Card
                key={n.id}
                className={cn(!n.read && "border-primary/30 bg-primary/[0.03]")}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      TONE_MAP[n.type]
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{n.title}</p>
                      {!n.read && <Badge>Yangi</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {n.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!n.read && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => update(n.id, { read: true })}
                      >
                        <Check className="size-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(n.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
