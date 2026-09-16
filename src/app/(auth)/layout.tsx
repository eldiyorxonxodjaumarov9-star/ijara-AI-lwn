import type { ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Bot,
  KeyRound,
  ListTodo,
  Users,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";

const VALUE_ITEMS = [
  { icon: Banknote, label: "To‘lovlar" },
  { icon: Users, label: "Arendatorlar" },
  { icon: ListTodo, label: "Vazifalar" },
  { icon: KeyRound, label: "Smart Access" },
  { icon: Bot, label: "AI tahlil" },
] as const;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-auth-shell relative min-h-screen w-full overflow-x-hidden">
      <div className="app-auth-grid absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-blue-600/25 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 size-80 rounded-full bg-cyan-400/15 blur-[110px]"
        aria-hidden
      />

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-10">
        {/* LEFT — brand storytelling (desktop) */}
        <div className="hidden lg:block">
          <Link href="/" className="inline-flex">
            <BrandLogo className="[&_span]:text-white [&_.text-primary]:text-sky-300 [&_>div]:bg-sky-500 [&_>div]:text-white [&_>div]:shadow-none" />
          </Link>

          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-sky-200">
            AI Property Management
          </p>

          <h1 className="mt-5 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            Ijara boshqaruvini bitta aqlli platformada davom ettiring.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300 xl:text-[15px]">
            Landingdagi xuddi shu premium tajriba — endi login va boshqaruv
            panelida ham bir brend tili.
          </p>

          <ul className="mt-8 flex flex-wrap gap-2">
            {VALUE_ITEMS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"
              >
                <Icon className="size-3.5 text-sky-300" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <div className="app-auth-float mt-10 grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                Oylik kirim
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">
                42.5M
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                Qarzdorlik
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-300">3</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                Bandlik
              </p>
              <p className="mt-1 text-xl font-semibold text-sky-300">94%</p>
            </div>
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
              <p className="text-[11px] uppercase tracking-wider text-sky-300">
                AI insight
              </p>
              <p className="mt-1 text-sm leading-snug text-slate-200">
                Elektr xarajati +18% — tekshiruv tavsiya etiladi.
              </p>
            </div>
          </div>

          <p className="mt-10 text-xs text-slate-500">
            © {new Date().getFullYear()} {APP_NAME}. Barcha huquqlar himoyalangan.
          </p>
        </div>

        {/* RIGHT — form column */}
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
          <div className="mb-6 lg:hidden">
            <Link href="/" className="inline-flex">
              <BrandLogo className="[&_span]:text-white [&_.text-primary]:text-sky-300 [&_>div]:bg-sky-500 [&_>div]:text-white [&_>div]:shadow-none" />
            </Link>
            <p className="mt-4 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-sky-200">
              AI Property Management
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Ijara boshqaruvini bitta aqlli platformada davom ettiring.
            </h1>
          </div>

          <div className="app-auth-card p-5 sm:p-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
