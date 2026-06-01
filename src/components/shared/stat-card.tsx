"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "primary" | "blue" | "amber" | "rose" | "violet";

const toneMap: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  tone = "primary",
  trend,
  trendLabel,
  loading,
  index = 0,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: number;
  trendLabel?: string;
  loading?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-muted-foreground">
                {title}
              </p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-28" />
              ) : (
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  {value}
                </p>
              )}
            </div>
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                toneMap[tone]
              )}
            >
              <Icon className="size-5" />
            </div>
          </div>
          {typeof trend === "number" && !loading && (
            <div className="mt-3 flex items-center gap-1 text-xs">
              <span
                className={cn(
                  "flex items-center gap-0.5 font-semibold",
                  trend >= 0 ? "text-primary" : "text-destructive"
                )}
              >
                {trend >= 0 ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {Math.abs(trend)}%
              </span>
              {trendLabel && (
                <span className="text-muted-foreground">{trendLabel}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
