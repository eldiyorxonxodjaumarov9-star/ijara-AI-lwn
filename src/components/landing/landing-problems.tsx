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

const SECONDARY_KEYS = [
  {
    titleKey: "problems.secondary.1.title",
    textKey: "problems.secondary.1.text",
  },
  {
    titleKey: "problems.secondary.2.title",
    textKey: "problems.secondary.2.text",
  },
] as const satisfies ReadonlyArray<{
  titleKey: LandingMessageKey;
  textKey: LandingMessageKey;
}>;

const REST_KEYS = [
  { titleKey: "problems.rest.1.title", textKey: "problems.rest.1.text" },
  { titleKey: "problems.rest.2.title", textKey: "problems.rest.2.text" },
  { titleKey: "problems.rest.3.title", textKey: "problems.rest.3.text" },
  { titleKey: "problems.rest.4.title", textKey: "problems.rest.4.text" },
  { titleKey: "problems.rest.5.title", textKey: "problems.rest.5.text" },
] as const satisfies ReadonlyArray<{
  titleKey: LandingMessageKey;
  textKey: LandingMessageKey;
}>;

export function LandingProblems() {
  const t = useLandingT();

  return (
    <LandingSection tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>{t("problems.eyebrow")}</LandingEyebrow>
            <LandingTitle className="mt-3">{t("problems.title")}</LandingTitle>
            <LandingLead>{t("problems.lead")}</LandingLead>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <article className="h-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
              <p className="text-xs font-semibold tracking-[0.16em] text-blue-700 uppercase">
                {t("problems.featured.kicker")}
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {t("problems.featured.title")}
              </h3>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                {t("problems.featured.text")}
              </p>
            </article>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            {SECONDARY_KEYS.map((item, index) => (
              <Reveal key={item.titleKey} delayMs={index * 70}>
                <article className="h-full rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {t(item.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t(item.textKey)}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {REST_KEYS.map((item, index) => (
            <Reveal key={item.titleKey} delayMs={index * 40}>
              <article className="h-full rounded-2xl border border-slate-200/80 bg-white/80 p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t(item.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(item.textKey)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
