import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getCurrentPlatformAdmin } from "@/lib/api-server/platform-admin/server-session";

import { PlatformAdminLogoutButton } from "./logout-button";
import { PlatformDashboard } from "./platform-dashboard";

export default async function PlatformAdminHomePage() {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) redirect("/super-admin/login");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{admin.name}</p>
            <p className="truncate text-xs text-slate-400">{admin.email}</p>
          </div>
        </div>
        <PlatformAdminLogoutButton />
      </header>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Platform boshqaruvi</h1>
      <p className="mt-1 text-sm text-slate-400">
        Faqat o‘qish uchun analitika. Ichki (platforma) hisoblar hisobga olinmaydi.
      </p>

      <PlatformDashboard />
    </div>
  );
}
