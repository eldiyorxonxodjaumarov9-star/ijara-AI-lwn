"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONE_GLOW: Record<string, string> = {
  blue: "bg-sky-500",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
};

const TONE_ICON: Record<string, string> = {
  blue: "bg-sky-500/15 text-sky-300 ring-sky-400/20",
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-400/20",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-400/20",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-400/20",
  cyan: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/20",
};

export function DashboardKpiCard({
  title,
  value,
  icon: Icon,
  tone = "blue",
  trend,
  trendLabel,
  subtitle,
  spark,
  loading,
  index = 0,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_GLOW;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  spark?: number[];
  loading?: boolean;
  index?: number;
}) {
  const maxSpark = spark?.length ? Math.max(...spark, 1) : 1;

  return (
    <article
      className="app-kpi app-reveal p-4 sm:p-5"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className={cn("app-kpi-glow", TONE_GLOW[tone])} aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-28 bg-white/10" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.7rem]">
              {value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            TONE_ICON[tone]
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
      </div>

      {!loading && spark && spark.length > 1 && (
        <svg
          viewBox="0 0 80 24"
          className="mt-3 h-6 w-full text-sky-300/80"
          aria-hidden
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={spark
              .map((v, i) => {
                const x = (i / (spark.length - 1)) * 80;
                const y = 22 - (v / maxSpark) * 18;
                return `${x},${y}`;
              })
              .join(" ")}
          />
        </svg>
      )}

      {typeof trend === "number" && !loading && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              "app-chip",
              trend >= 0
                ? "border-emerald-400/25 text-emerald-300"
                : "border-rose-400/25 text-rose-300"
            )}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="size-3" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3" aria-hidden />
            )}
            {Math.abs(trend)}%
          </span>
          {trendLabel && (
            <span className="truncate text-xs text-slate-400">{trendLabel}</span>
          )}
        </div>
      )}

      {subtitle && !loading && (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{subtitle}</p>
      )}
    </article>
  );
}
