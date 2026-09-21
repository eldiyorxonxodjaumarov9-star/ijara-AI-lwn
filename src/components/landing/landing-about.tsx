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

const ABOUT_POINT_KEYS = [
  { titleKey: "about.point.1.title", textKey: "about.point.1.text" },
  { titleKey: "about.point.2.title", textKey: "about.point.2.text" },
  { titleKey: "about.point.3.title", textKey: "about.point.3.text" },
  { titleKey: "about.point.4.title", textKey: "about.point.4.text" },
  { titleKey: "about.point.5.title", textKey: "about.point.5.text" },
  { titleKey: "about.point.6.title", textKey: "about.point.6.text" },
] as const satisfies ReadonlyArray<{
  titleKey: LandingMessageKey;
  textKey: LandingMessageKey;
}>;

export function LandingAbout() {
  const t = useLandingT();

  return (
    <LandingSection id="biz-haqimizda" tone="light">
      <LandingContainer>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <Reveal>
            <div>
              <LandingEyebrow>{t("about.eyebrow")}</LandingEyebrow>
              <LandingTitle className="mt-3">{t("about.title")}</LandingTitle>
              <LandingLead>{t("about.lead")}</LandingLead>
              <blockquote className="mt-8 border-l-2 border-blue-600 pl-5 text-base font-medium leading-relaxed tracking-tight text-slate-900 sm:text-lg">
                {t("about.quote")}
              </blockquote>
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="grid gap-3 sm:grid-cols-2">
              {ABOUT_POINT_KEYS.map((point) => (
                <article
                  key={point.titleKey}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t(point.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t(point.textKey)}
                  </p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
