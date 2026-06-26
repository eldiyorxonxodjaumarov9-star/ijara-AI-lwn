import Link from "next/link";
import { ArrowRight, CheckCircle2, LayoutDashboard } from "lucide-react";

import { DASHBOARD_CAPABILITIES } from "@/lib/landing-content";

export function LandingDashboardSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-950/80 via-[#0a1628] to-slate-900/80 p-8 sm:p-12 lg:p-16">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                <LayoutDashboard className="size-3.5" />
                Admin Dashboard
              </div>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Dashboard imkoniyatlari
              </h2>
              <p className="mt-4 text-slate-400">
                Mavjud boshqaruv paneli orqali mulklar, arendatorlar, to&apos;lovlar
                va Telegram integratsiyasini to&apos;liq nazorat qiling.
              </p>
              <ul className="mt-8 space-y-3">
                {DASHBOARD_CAPABILITIES.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="size-5 shrink-0 text-cyan-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-cyan-400"
              >
                Dashboardga o&apos;tish
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-white/10 bg-[#0d1f3c]/90 p-4 shadow-2xl shadow-blue-900/50 backdrop-blur-xl sm:p-6">
                <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
                  <div className="size-3 rounded-full bg-red-500/80" />
                  <div className="size-3 rounded-full bg-yellow-500/80" />
                  <div className="size-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-xs text-slate-500">Arenda AI Dashboard</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["Mulklar", "Arendatorlar", "To'lovlar", "Hisobotlar"].map(
                    (label) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/5 bg-white/5 p-4"
                      >
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {label === "Mulklar"
                            ? "24"
                            : label === "Arendatorlar"
                              ? "18"
                              : label === "To'lovlar"
                                ? "12.4M"
                                : "98%"}
                        </p>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-3 h-24 rounded-xl border border-white/5 bg-gradient-to-r from-blue-600/20 to-cyan-500/10" />
              </div>
              <div className="absolute -right-4 -bottom-4 -z-10 h-full w-full rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-500/10 blur-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
