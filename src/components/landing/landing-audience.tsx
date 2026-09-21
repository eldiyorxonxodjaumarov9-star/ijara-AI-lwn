"use client";

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

const AUDIENCE_KEYS = [
  { titleKey: "audience.1.title", useCaseKey: "audience.1.useCase" },
  { titleKey: "audience.2.title", useCaseKey: "audience.2.useCase" },
  { titleKey: "audience.3.title", useCaseKey: "audience.3.useCase" },
  { titleKey: "audience.4.title", useCaseKey: "audience.4.useCase" },
  { titleKey: "audience.5.title", useCaseKey: "audience.5.useCase" },
  { titleKey: "audience.6.title", useCaseKey: "audience.6.useCase" },
  { titleKey: "audience.7.title", useCaseKey: "audience.7.useCase" },
  { titleKey: "audience.8.title", useCaseKey: "audience.8.useCase" },
] as const satisfies ReadonlyArray<{
  titleKey: LandingMessageKey;
  useCaseKey: LandingMessageKey;
}>;

export function LandingAudience() {
  const t = useLandingT();

  return (
    <LandingSection id="kimlar-uchun" tone="light">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>{t("audience.eyebrow")}</LandingEyebrow>
            <LandingTitle className="mt-3">{t("audience.title")}</LandingTitle>
            <LandingLead>{t("audience.lead")}</LandingLead>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE_KEYS.map((item, index) => (
            <Reveal key={item.titleKey} delayMs={(index % 4) * 50}>
              <article className="h-full rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 transition-colors hover:border-blue-200 hover:bg-white">
                <h3 className="text-base font-semibold text-slate-900">
                  {t(item.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(item.useCaseKey)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
