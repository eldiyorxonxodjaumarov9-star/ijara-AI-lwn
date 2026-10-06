"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  Crown,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDateKeyShort,
  formatTashkentDateTime,
  RECENT_REGISTRATION_COLUMNS,
  SUPER_ADMIN_INDUSTRY_LABELS,
  SUPER_ADMIN_PLAN_LABELS,
  type PlatformDashboardData,
} from "@/lib/super-admin-dashboard";

const RegistrationTrendChart = dynamic(
  () => import("./registration-trend-chart").then((m) => m.RegistrationTrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full bg-white/10" /> }
);

type Recent = PlatformDashboardData["recentRegistrations"][number];
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: PlatformDashboardData };

const panel = "rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5";
const nf = new Intl.NumberFormat("ru-RU");

export function PlatformDashboard() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const apply = useCallback(
    (result: LoadState | "unauthorized") => {
      if (result === "unauthorized") router.replace("/super-admin/login");
      else setState(result);
    },
    [router]
  );

  const load = useCallback(() => {
    setState({ kind: "loading" });
    void fetchDashboard().then(apply);
  }, [apply]);

  useEffect(() => {
    let active = true;
    void fetchDashboard().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  if (state.kind === "loading") return <DashboardSkeleton />;
  if (state.kind === "error") {
    return (
      <div role="alert" className={`${panel} mt-6 flex flex-col items-start gap-3`}>
        <p className="text-sm text-rose-300">{state.message}</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10"
        >
          <RefreshCw className="size-4" /> Qayta urinish
        </button>
      </div>
    );
  }

  const { kpis, industryBreakdown, registrationTrend, recentRegistrations, workspaceActivity } = state.data;
  const industryMax = Math.max(1, ...industryBreakdown.map((i) => i.count));
  const kpiCards: { label: string; value: number; icon: ReactNode }[] = [
    { label: "Jami foydalanuvchilar", value: kpis.totalUsers, icon: <Users className="size-4" /> },
    { label: "Jami workspace", value: kpis.totalWorkspaces, icon: <Building2 className="size-4" /> },
    { label: "Bugungi registratsiyalar", value: kpis.todayRegistrations, icon: <UserPlus className="size-4" /> },
    { label: "Oxirgi 7 kun registratsiyalari", value: kpis.last7DaysRegistrations, icon: <CalendarDays className="size-4" /> },
    { label: "DEMO / FREE workspace’lar", value: kpis.demoWorkspaces, icon: <Sparkles className="size-4" /> },
    { label: "PRO workspace’lar", value: kpis.proWorkspaces, icon: <BadgeCheck className="size-4" /> },
    { label: "PREMIUM workspace’lar", value: kpis.premiumWorkspaces, icon: <Crown className="size-4" /> },
    { label: "Faol workspace’lar", value: kpis.activeWorkspaces, icon: <Activity className="size-4" /> },
  ];

  return (
    <div className="mt-6 space-y-6">
      <section aria-label="Asosiy ko‘rsatkichlar" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.label} className={`${panel} min-w-0`}>
            <div className="flex items-center gap-2 text-sky-300">{card.icon}</div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{nf.format(card.value)}</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-400">{card.label}</p>
          </div>
        ))}
      </section>

      <section aria-label="Workspace faolligi" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Bugun yaratilgan workspace", value: workspaceActivity.workspacesCreatedToday },
          { label: "Oxirgi 7 kunda yaratilgan workspace", value: workspaceActivity.workspacesCreatedLast7Days },
          { label: "Faol obunalar (ACTIVE)", value: workspaceActivity.activeSubscriptions },
        ].map((item) => (
          <div key={item.label} className={`${panel} flex items-center justify-between gap-3`}>
            <p className="text-sm text-slate-300">{item.label}</p>
            <p className="text-lg font-semibold tabular-nums text-white">{nf.format(item.value)}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="industry-title" className={panel}>
          <h2 id="industry-title" className="text-base font-semibold text-white">Industry bo‘yicha taqsimot</h2>
          <ul className="mt-4 space-y-3">
            {industryBreakdown.map((row) => (
              <li key={row.industry}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-200">{SUPER_ADMIN_INDUSTRY_LABELS[row.industry]}</span>
                  <span className="tabular-nums text-slate-400">{nf.format(row.count)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-sky-400"
                    style={{ width: `${(row.count / industryMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="trend-title" className={`${panel} min-w-0`}>
          <h2 id="trend-title" className="text-base font-semibold text-white">Registratsiyalar — oxirgi 7 kun</h2>
          <p className="mt-0.5 text-xs text-slate-500">Asia/Tashkent vaqti bo‘yicha</p>
          <div className="mt-4">
            <RegistrationTrendChart data={registrationTrend} />
          </div>
          <ul className="mt-3 grid grid-cols-7 gap-1 text-center" aria-label="Kunlik registratsiyalar">
            {registrationTrend.map((p) => (
              <li key={p.date} className="min-w-0">
                <p className="text-[10px] text-slate-500">{formatDateKeyShort(p.date)}</p>
                <p className="text-sm font-medium tabular-nums text-slate-200">{p.count}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="recent-title" className={panel}>
        <h2 id="recent-title" className="text-base font-semibold text-white">Oxirgi ro‘yxatdan o‘tganlar</h2>
        {recentRegistrations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Hozircha registratsiyalar yo‘q.</p>
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                    {RECENT_REGISTRATION_COLUMNS.map((c) => (
                      <th key={c.key} scope="col" className="px-2 py-2 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRegistrations.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 last:border-0">
                      {RECENT_REGISTRATION_COLUMNS.map((c) => (
                        <td key={c.key} className="max-w-[200px] truncate px-2 py-2.5 text-slate-200">
                          {cellValue(r, c.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 space-y-3 md:hidden" aria-label="Oxirgi ro‘yxatdan o‘tganlar (mobil)">
              {recentRegistrations.map((r) => (
                <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                    {RECENT_REGISTRATION_COLUMNS.map((c) => (
                      <div key={c.key} className="contents">
                        <dt className="text-xs text-slate-500">{c.label}</dt>
                        <dd className="min-w-0 break-words text-slate-200">{cellValue(r, c.key)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

async function fetchDashboard(): Promise<LoadState | "unauthorized"> {
  try {
    const res = await fetch("/api/super-admin/dashboard", { credentials: "same-origin", cache: "no-store" });
    if (res.status === 401) return "unauthorized";
    const body = (await res.json().catch(() => null)) as { data?: PlatformDashboardData; message?: string } | null;
    if (!res.ok || !body?.data) {
      return { kind: "error", message: body?.message ?? "Dashboard ma’lumotlarini yuklab bo‘lmadi" };
    }
    return { kind: "ready", data: body.data };
  } catch {
    return { kind: "error", message: "Tarmoq xatosi. Internet aloqasini tekshirib, qayta urinib ko‘ring." };
  }
}

function cellValue(r: Recent, key: (typeof RECENT_REGISTRATION_COLUMNS)[number]["key"]): string {
  switch (key) {
    case "name":
      return r.name || "—";
    case "email":
      return r.email;
    case "phone":
      return r.phone || "—";
    case "business":
      return r.business || "—";
    case "industry":
      return r.industry ? SUPER_ADMIN_INDUSTRY_LABELS[r.industry] : "—";
    case "plan":
      return r.plan ? SUPER_ADMIN_PLAN_LABELS[r.plan] : "—";
    case "registeredAt":
      return formatTashkentDateTime(r.registeredAt);
  }
}

function DashboardSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-2xl bg-white/[0.06]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl bg-white/[0.06]" />
        <Skeleton className="h-72 rounded-2xl bg-white/[0.06]" />
      </div>
      <Skeleton className="h-64 rounded-2xl bg-white/[0.06]" />
    </div>
  );
}
