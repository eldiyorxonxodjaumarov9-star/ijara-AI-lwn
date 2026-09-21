"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HeroProductVisual } from "@/components/landing/landing-mockups";
import { LandingContainer } from "@/components/landing/landing-shell";
import { useLandingT } from "@/hooks/use-landing-t";

export function LandingHero() {
  const t = useLandingT();

  return (
    <section className="relative overflow-x-clip bg-[#071429] pt-24 pb-14 text-white sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20">
      <div className="pointer-events-none absolute inset-0 landing-navy-grid opacity-70" />
      <div className="pointer-events-none absolute -top-24 left-1/3 h-[380px] w-[380px] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-[240px] w-[240px] rounded-full bg-blue-400/10 blur-[90px]" />

      <LandingContainer className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8 xl:gap-14">
          <div className="max-w-xl">
            <p className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-blue-200">
              {t("hero.badge")}
            </p>
            <h1 className="mt-5 text-balance text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl sm:leading-[1.12] lg:text-[2.75rem] xl:text-[3.1rem] xl:leading-[1.08]">
              {t("hero.title")}
            </h1>
            <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-slate-300 sm:mt-5 sm:text-base">
              {t("hero.lead")}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-12 min-w-[11.5rem] items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#071429] transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                {t("hero.cta.primary")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="#imkoniyatlar"
                className="inline-flex h-12 min-w-[11.5rem] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                {t("hero.cta.secondary")}
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <HeroProductVisual />
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
