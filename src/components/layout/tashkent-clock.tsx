"use client";

import { Clock } from "lucide-react";

import { useTashkentNow } from "@/context/tashkent-time-context";
import { formatTashkentClock } from "@/lib/payment-due-schedule";

export function TashkentClock() {
  const now = useTashkentNow();

  return (
    <div
      className="hidden items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:flex"
      title="Toshkent vaqti — to'lov muddatlari shu bo'yicha yangilanadi"
    >
      <Clock className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap tabular-nums">{formatTashkentClock(now)}</span>
    </div>
  );
}
