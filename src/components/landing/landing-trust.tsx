import {
  Banknote,
  Bot,
  Building2,
  KeyRound,
  Send,
  Users,
} from "lucide-react";

import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { TRUST_CATEGORIES } from "@/lib/landing-content";

const ICONS = {
  finance: Banknote,
  tenants: Users,
  staff: Building2,
  ai: Bot,
  lock: KeyRound,
  telegram: Send,
} as const;

export function LandingTrust() {
  return (
    <LandingSection id="platforma" tone="light" className="py-10 sm:py-12 lg:py-14">
      <LandingContainer>
        <Reveal>
          <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
              Bitta platformada
            </p>
            <ul className="flex flex-wrap gap-2 sm:justify-end">
              {TRUST_CATEGORIES.map((item) => {
                const Icon = ICONS[item.id];
                return (
                  <li
                    key={item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                  >
                    <Icon className="size-3.5 text-blue-700" aria-hidden />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
        <Reveal delayMs={80}>
          <div className="mt-10 max-w-3xl">
            <LandingEyebrow>Platform overview</LandingEyebrow>
            <LandingTitle className="mt-3">
              Bu oddiy e’lon sayti emas. Bu ijara biznesining boshqaruv tizimi.
            </LandingTitle>
            <LandingLead>
              Arenda AI mulk, moliya, jamoa, Telegram va smart access jarayonlarini
              bitta operatsion markazga yig‘adi. Qidiruvdan emas — nazoratdan
              boshlanadi.
            </LandingLead>
          </div>
        </Reveal>
      </LandingContainer>
    </LandingSection>
  );
}
