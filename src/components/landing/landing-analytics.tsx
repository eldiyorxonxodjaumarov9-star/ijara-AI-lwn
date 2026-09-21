"use client";

import { AnalyticsPreview } from "@/components/landing/landing-mockups";
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

const ANALYTICS_INSIGHTS = [
  {
    labelKey: "analytics.insight.1.label",
    valueKey: "analytics.insight.1.value",
    hintKey: "analytics.insight.1.hint",
  },
  {
    labelKey: "analytics.insight.2.label",
    valueKey: "analytics.insight.2.value",
    hintKey: "analytics.insight.2.hint",
  },
  {
    labelKey: "analytics.insight.3.label",
    valueKey: "analytics.insight.3.value",
    hintKey: "analytics.insight.3.hint",
  },
] as const satisfies ReadonlyArray<{
  labelKey: LandingMessageKey;
  valueKey: LandingMessageKey;
  hintKey: LandingMessageKey;
}>;

const BULLET_KEYS = [
  "analytics.bullet.1",
  "analytics.bullet.2",
  "analytics.bullet.3",
] as const satisfies ReadonlyArray<LandingMessageKey>;

export function LandingAnalytics() {
  const t = useLandingT();

  return (
    <LandingSection id="ai" tone="navy" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 landing-navy-grid opacity-50" />
      <LandingContainer className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <div>
              <LandingEyebrow tone="navy">{t("analytics.eyebrow")}</LandingEyebrow>
              <LandingTitle className="mt-3 text-white">
                {t("analytics.title")}
              </LandingTitle>
              <LandingLead className="text-slate-300">
                {t("analytics.lead")}
              </LandingLead>
              <ul className="mt-7 grid gap-3 sm:grid-cols-3">
                {ANALYTICS_INSIGHTS.map((item) => (
                  <li
                    key={item.labelKey}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-[11px] tracking-wide text-slate-400 uppercase">
                      {t(item.labelKey)}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                      {t(item.valueKey)}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-slate-400">
                      {t(item.hintKey)}
                    </p>
                  </li>
                ))}
              </ul>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                {BULLET_KEYS.map((key) => (
                  <li key={key}>• {t(key)}</li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delayMs={90}>
            <AnalyticsPreview />
          </Reveal>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
