"use client";

import { useEffect, useState } from "react";
import { Activity, Bot, Cog, User } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import {
  DEFAULT_USAGE_PERIOD,
  USAGE_PERIODS,
  WORK_SHARE_LABELS,
  usageSubtitle,
  type UsageAnalytics,
  type UsagePeriod,
} from "@/lib/usage-analytics";
import { cn } from "@/lib/utils";

const COLLECTING = "Ma'lumot yig'ilmoqda";
const SHARE_COLORS = { human: "#60a5fa", ai: "#a78bfa", automation: "#34d399" } as const;
const SHARE_KEYS = ["human", "ai", "automation"] as const;

export function PlatformUsageSection() {
  const [period, setPeriod] = useState<UsagePeriod>(DEFAULT_USAGE_PERIOD);
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(isApiConfigured);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isApiConfigured) return;
    let cancelled = false;
    apiFetch<UsageAnalytics>(`/dashboard/usage-analytics?period=${period}`)
      .then((res) => {
        if (!cancelled) setData(res ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const selectPeriod = (next: UsagePeriod) => {
    if (next === period) return;
    setLoading(isApiConfigured);
    setFailed(false);
    setPeriod(next);
  };

  const share = data?.workShare;
  const hasWork = (share?.total ?? 0) > 0;

  return (
    <section className="space-y-3" aria-labelledby="platform-usage-title" data-testid="platform-usage">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="platform-usage-title" className="text-lg font-semibold tracking-tight text-foreground">
            Platformadan foydalanish
          </h2>
          <p className="text-xs text-slate-400">Statistika yangi faoliyatlardan boshlab yig&apos;iladi</p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Davr">
          {USAGE_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => selectPeriod(p)}
              aria-pressed={period === p}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                period === p ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-white/10"
              )}
            >
              {p.replace("d", " kun")}
            </button>
          ))}
        </div>
      </div>

      {failed && !data ? (
        <p className="app-panel p-4 text-sm text-slate-400">Statistikani yuklab bo&apos;lmadi</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardKpiCard
              index={0}
              title="Platformadan foydalanish"
              value={data ? `${data.platformUsage.percentage}%` : "0%"}
              icon={Activity}
              tone="cyan"
              loading={loading}
              subtitle={data ? (data.collecting ? COLLECTING : usageSubtitle(data)) : undefined}
            />
            <DashboardKpiCard
              index={1}
              title="Odam bajargan ishlar"
              value={String(share?.human.count ?? 0)}
              icon={User}
              tone="blue"
              loading={loading}
            />
            <DashboardKpiCard
              index={2}
              title="AI bajargan ishlar"
              value={String(share?.ai.count ?? 0)}
              icon={Bot}
              tone="violet"
              loading={loading}
            />
            <DashboardKpiCard
              index={3}
              title="Avtomatik bajarilgan"
              value={String(share?.automation.count ?? 0)}
              icon={Cog}
              tone="emerald"
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DashboardPanel title="Ishlarning bajarilish ulushi" delayMs={80}>
              {loading ? (
                <Skeleton className="h-[180px] w-full bg-white/10" />
              ) : !hasWork || !share ? (
                <p className="py-10 text-center text-sm text-slate-400">{COLLECTING}</p>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={SHARE_KEYS.map((key) => ({ key, name: WORK_SHARE_LABELS[key], value: share[key].count }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {SHARE_KEYS.map((key) => (
                            <Cell key={key} fill={SHARE_COLORS[key]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#0d1c34",
                            border: "1px solid rgb(148 163 184 / 0.2)",
                            borderRadius: 12,
                            color: "#e8eef8",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-full space-y-2">
                    {SHARE_KEYS.map((key) => (
                      <li key={key} className="app-row justify-between">
                        <span className="flex items-center gap-2 text-sm text-slate-200">
                          <span className="size-2.5 rounded-full" style={{ background: SHARE_COLORS[key] }} aria-hidden />
                          {WORK_SHARE_LABELS[key]}
                        </span>
                        <span className="text-sm font-semibold text-slate-50">
                          {share[key].percentage}%
                          <span className="ml-1.5 text-xs font-normal text-slate-400">({share[key].count})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </DashboardPanel>

            <DashboardPanel title="Qaysi funksiyalar ishlatilmoqda" delayMs={120}>
              {loading ? (
                <Skeleton className="h-[180px] w-full bg-white/10" />
              ) : (
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(data?.features ?? []).map((feature) => (
                    <li key={feature.key} className="app-row justify-between">
                      <span className="truncate text-sm text-slate-200">{feature.label}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          feature.used ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-400"
                        )}
                      >
                        {feature.used ? "Faol" : "Ishlatilmagan"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardPanel>
          </div>

          <DashboardPanel title="Funksiyalar bo'yicha taqsimot" delayMs={160}>
            {loading ? (
              <Skeleton className="h-24 w-full bg-white/10" />
            ) : !data || data.breakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{COLLECTING}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[300px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="py-2 pr-2 font-medium">Funksiya</th>
                      <th className="px-2 py-2 text-right font-medium">{WORK_SHARE_LABELS.human}</th>
                      <th className="px-2 py-2 text-right font-medium">{WORK_SHARE_LABELS.ai}</th>
                      <th className="py-2 pl-2 text-right font-medium">{WORK_SHARE_LABELS.automation}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.breakdown.map((row) => (
                      <tr key={row.featureKey} className="border-t border-white/5 text-slate-200">
                        <td className="py-2 pr-2">{row.label}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.human}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.ai}</td>
                        <td className="py-2 pl-2 text-right tabular-nums">{row.automation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardPanel>
        </>
      )}
    </section>
  );
}
