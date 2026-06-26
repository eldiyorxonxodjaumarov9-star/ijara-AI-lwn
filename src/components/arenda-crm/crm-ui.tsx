"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function CrmStatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  subtitle,
  index = 0,
  accent = "blue",
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  index?: number;
  accent?: "blue" | "cyan" | "green" | "amber" | "violet";
}) {
  const accentMap = {
    blue: "from-[#2563EB]/20 to-[#2563EB]/5 text-[#2563EB] ring-[#2563EB]/20",
    cyan: "from-[#38BDF8]/20 to-[#38BDF8]/5 text-[#38BDF8] ring-[#38BDF8]/20",
    green: "from-[#22C55E]/20 to-[#22C55E]/5 text-[#22C55E] ring-[#22C55E]/20",
    amber: "from-[#F59E0B]/20 to-[#F59E0B]/5 text-[#F59E0B] ring-[#F59E0B]/20",
    violet: "from-violet-500/20 to-violet-500/5 text-violet-500 ring-violet-500/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/60 p-5 shadow-lg shadow-black/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-[#0F172A]/80 dark:shadow-black/20"
    >
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br from-[#2563EB]/10 to-[#38BDF8]/5 blur-2xl transition group-hover:scale-110" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1",
            accentMap[accent]
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      {typeof trend === "number" && (
        <div className="relative mt-3 flex items-center gap-1 text-xs">
          <span
            className={cn(
              "flex items-center gap-0.5 font-semibold",
              trend >= 0 ? "text-[#22C55E]" : "text-red-500"
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="text-slate-500">{trendLabel}</span>}
        </div>
      )}
    </motion.div>
  );
}

export function CrmGlassCard({
  children,
  className,
  title,
  description,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/60 p-5 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-[#0F172A]/70 dark:shadow-black/20 sm:p-6",
        className
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-[#0F172A] dark:text-white">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
