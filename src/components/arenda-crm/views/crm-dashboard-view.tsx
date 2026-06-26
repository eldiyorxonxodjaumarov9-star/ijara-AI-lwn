"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  Megaphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CrmGlassCard, CrmStatCard } from "@/components/arenda-crm/crm-ui";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { Badge } from "@/components/ui/badge";
import { getArendaCrmDashboardStats } from "@/lib/arenda-crm/dashboard-stats";
import type { LandlordProfile } from "@/lib/landlord-profile";

const PIE_COLORS = ["#2563EB", "#38BDF8", "#22C55E", "#F59E0B", "#8B5CF6"];

export function CrmDashboardView({ profile }: { profile: LandlordProfile }) {
  const stats = useMemo(
    () => getArendaCrmDashboardStats(profile.email),
    [profile.email]
  );

  const statusPie = [
    { name: "Faol", value: stats.activeProperties },
    { name: "Ijarada", value: stats.bookedProperties },
    { name: "Ta'mir", value: stats.maintenanceProperties },
    { name: "Arxiv", value: stats.archivedProperties },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-[#2563EB]/20 bg-gradient-to-br from-[#2563EB] via-[#1d4ed8] to-[#0F172A] p-6 text-white shadow-2xl shadow-[#2563EB]/20 sm:p-8"
      >
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-[#38BDF8]/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge className="mb-3 border-0 bg-white/15 text-white hover:bg-white/20">
              <Sparkles className="mr-1 size-3" />
              AI-powered CRM
            </Badge>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Xush kelibsiz, {profile.fullName.split(" ")[0]}!
            </h2>
            <p className="mt-2 max-w-xl text-sm text-blue-100">
              Bugun {stats.newLeads} ta yangi lid, {stats.activeProperties} ta faol mulk va{" "}
              {stats.aiRecommendations} ta AI tavsiya mavjud.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
            <p className="text-xs text-blue-100">Oylik daromad</p>
            <p className="text-2xl font-bold">{stats.formatted.monthlyRevenue}</p>
            <p className="mt-1 text-xs text-[#38BDF8]">
              Kunlik: {stats.formatted.dailyRevenue}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CrmStatCard title="Jami mulklar" value={String(stats.totalProperties)} icon={Building2} trend={12} trendLabel="oy" index={0} />
        <CrmStatCard title="Faol ijara" value={String(stats.activeRentals)} icon={TrendingUp} accent="green" trend={8} trendLabel="oy" index={1} />
        <CrmStatCard title="Mijozlar" value={String(stats.totalClients)} icon={Users} accent="cyan" trend={15} trendLabel="oy" index={2} />
        <CrmStatCard title="Yangi lidlar" value={String(stats.newLeads)} icon={Megaphone} accent="amber" index={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CrmStatCard title="Faol mulklar" value={String(stats.activeProperties)} icon={Building2} accent="blue" index={4} />
        <CrmStatCard title="Band mulklar" value={String(stats.bookedProperties)} icon={Building2} accent="violet" index={5} />
        <CrmStatCard title="Reklama ko'rinishlari" value={stats.adImpressions.toLocaleString("uz-UZ")} icon={BarChart3} accent="cyan" index={6} />
        <CrmStatCard title="AI tavsiyalar" value={String(stats.aiRecommendations)} icon={Sparkles} accent="green" subtitle="Bugungi" index={7} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <CrmGlassCard title="Daromad dinamikasi" description="Oylik daromad va xarajatlar" className="lg:col-span-2">
          <RevenueChart data={stats.revenueChart} />
        </CrmGlassCard>

        <CrmGlassCard title="Mulk holati" description="Portfel taqsimoti">
          {statusPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Hali mulk yo&apos;q</p>
          )}
        </CrmGlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CrmGlassCard title="Lid voronkasi" description="Mijozlar bosqichlari">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.leadFunnel}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="stage" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CrmGlassCard>

        <CrmGlassCard title="Hudud bo'yicha" description="Mulklar taqsimoti">
          {stats.regionChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.regionChart} layout="vertical">
                <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#38BDF8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Hudud ma&apos;lumotlari yo&apos;q</p>
          )}
        </CrmGlassCard>
      </div>

      <CrmGlassCard title="Eng yaxshi mulklar" description="Ko'rish va lidlar bo'yicha">
        {stats.propertyPerformance.length > 0 ? (
          <div className="space-y-3">
            {stats.propertyPerformance.map((p, i) => (
              <div
                key={p.name}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/40 px-4 py-3 dark:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[#2563EB]/10 text-sm font-bold text-[#2563EB]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.views} ko&apos;rish · {p.leads} lid</p>
                  </div>
                </div>
                <Wallet className="size-4 text-[#38BDF8]" />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            E&apos;lon qo&apos;shing — statistika shu yerda ko&apos;rinadi
          </p>
        )}
      </CrmGlassCard>
    </div>
  );
}
