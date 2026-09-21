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

const HOW_STEP_KEYS = [
  {
    nKey: "how.step.1.n",
    titleKey: "how.step.1.title",
    textKey: "how.step.1.text",
  },
  {
    nKey: "how.step.2.n",
    titleKey: "how.step.2.title",
    textKey: "how.step.2.text",
  },
  {
    nKey: "how.step.3.n",
    titleKey: "how.step.3.title",
    textKey: "how.step.3.text",
  },
  {
    nKey: "how.step.4.n",
    titleKey: "how.step.4.title",
    textKey: "how.step.4.text",
  },
  {
    nKey: "how.step.5.n",
    titleKey: "how.step.5.title",
    textKey: "how.step.5.text",
  },
] as const satisfies ReadonlyArray<{
  nKey: LandingMessageKey;
  titleKey: LandingMessageKey;
  textKey: LandingMessageKey;
}>;

export function LandingHow() {
  const t = useLandingT();

  return (
    <LandingSection tone="navy" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 landing-navy-grid opacity-40" />
      <LandingContainer className="relative">
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow tone="navy">{t("how.eyebrow")}</LandingEyebrow>
            <LandingTitle className="mt-3 text-white">{t("how.title")}</LandingTitle>
            <LandingLead className="text-slate-300">{t("how.lead")}</LandingLead>
          </div>
        </Reveal>

        <div className="relative mt-12">
          <div className="pointer-events-none absolute top-6 right-8 left-8 hidden h-px bg-gradient-to-r from-blue-400/0 via-blue-300/40 to-blue-400/0 lg:block" />
          <div className="grid gap-4 lg:grid-cols-5">
            {HOW_STEP_KEYS.map((step, index) => (
              <Reveal key={step.nKey} delayMs={index * 60}>
                <article className="relative h-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold tracking-[0.18em] text-blue-300">
                    {t(step.nKey)}
                  </p>
                  <h3 className="mt-3 text-base font-semibold text-white">
                    {t(step.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {t(step.textKey)}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
