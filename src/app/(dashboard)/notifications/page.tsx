"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
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
  const [token, setToken] = useState("");

  const markAllRead = async () => {
    await Promise.all(
      data.filter((n) => !n.read).map((n) => update(n.id, { read: true }))
    );
    toast.success("Barchasi o'qilgan deb belgilandi");
  };

  const connectTelegram = () => {
    if (!token.trim()) {
      toast.error("Bot tokenini kiriting");
      return;
    }
    toast.success("Telegram bot ulanishga tayyor (demo)");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xabarlar"
        description="Bildirishnomalar markazi va Telegram integratsiyasi."
        action={
          <Button variant="outline" onClick={markAllRead}>
            <Check className="size-4" /> Hammasini o&apos;qish
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : data.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Xabarlar yo'q"
              description="Yangi bildirishnomalar shu yerda paydo bo'ladi."
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

        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Send className="size-5" />
              </div>
              <div>
                <CardTitle>Telegram integratsiyasi</CardTitle>
                <CardDescription>Bot orqali avtomatik xabarlar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bot Token</Label>
              <Input
                placeholder="123456:ABC-DEF..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={connectTelegram}>
              <Send className="size-4" /> Ulash
            </Button>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Modul tayyor:</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                <li>To&apos;lov eslatmalari</li>
                <li>Shartnoma muddati ogohlantirishi</li>
                <li>Qarzdorlik bildirishnomalari</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
