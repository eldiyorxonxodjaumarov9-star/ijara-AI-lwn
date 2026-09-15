import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/landing/landing-reveal";
import { LandingContainer, LandingSection } from "@/components/landing/landing-shell";

export function LandingCta() {
  return (
    <LandingSection tone="light" className="pb-16 sm:pb-20">
      <LandingContainer>
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-[#071429] px-6 py-12 text-white sm:px-10 sm:py-16 lg:px-16">
            <div className="pointer-events-none absolute inset-0 landing-navy-grid opacity-40" />
            <div className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]">
                Ijara boshqaruvini keyingi bosqichga olib chiqing.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                To‘lovlar, mulklar, xodimlar, kirish nazorati va AI tahlil — bitta
                platformada.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex h-12 min-w-[11.5rem] items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#071429] transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  Platformani ochish
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 min-w-[11.5rem] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  Kirish
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </LandingContainer>
    </LandingSection>
  );
}
