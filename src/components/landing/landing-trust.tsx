"use client";

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
import { useLandingT } from "@/hooks/use-landing-t";
import type { LandingMessageKey } from "@/lib/i18n/landing";

const TRUST_CATEGORIES = [
  { id: "finance", labelKey: "trust.category.finance" as const, Icon: Banknote },
  { id: "tenants", labelKey: "trust.category.tenants" as const, Icon: Users },
  { id: "staff", labelKey: "trust.category.staff" as const, Icon: Building2 },
  { id: "ai", labelKey: "trust.category.ai" as const, Icon: Bot },
  { id: "lock", labelKey: "trust.category.lock" as const, Icon: KeyRound },
  { id: "telegram", labelKey: "trust.category.telegram" as const, Icon: Send },
] satisfies ReadonlyArray<{
  id: string;
  labelKey: LandingMessageKey;
  Icon: typeof Banknote;
}>;

export function LandingTrust() {
  const t = useLandingT();

  return (
    <LandingSection id="platforma" tone="light" className="py-10 sm:py-12 lg:py-14">
      <LandingContainer>
        <Reveal>
          <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
              {t("trust.stripTitle")}
            </p>
            <ul className="flex flex-wrap gap-2 sm:justify-end">
              {TRUST_CATEGORIES.map((item) => (
                <li
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                >
                  <item.Icon className="size-3.5 text-blue-700" aria-hidden />
                  {t(item.labelKey)}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delayMs={80}>
          <div className="mt-10 max-w-3xl">
            <LandingEyebrow>{t("trust.eyebrow")}</LandingEyebrow>
            <LandingTitle className="mt-3">{t("trust.title")}</LandingTitle>
            <LandingLead>{t("trust.lead")}</LandingLead>
          </div>
        </Reveal>
      </LandingContainer>
    </LandingSection>
  );
}
