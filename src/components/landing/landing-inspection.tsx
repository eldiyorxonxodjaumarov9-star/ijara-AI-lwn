"use client";

import { InspectionPreview } from "@/components/landing/landing-mockups";
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

const FLOW_KEYS = [
  { titleKey: "inspection.flow.1.title", textKey: "inspection.flow.1.text" },
  { titleKey: "inspection.flow.2.title", textKey: "inspection.flow.2.text" },
  { titleKey: "inspection.flow.3.title", textKey: "inspection.flow.3.text" },
  { titleKey: "inspection.flow.4.title", textKey: "inspection.flow.4.text" },
] as const satisfies ReadonlyArray<{
  titleKey: LandingMessageKey;
  textKey: LandingMessageKey;
}>;

export function LandingInspection() {
  const t = useLandingT();

  return (
    <LandingSection tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <LandingEyebrow>{t("inspection.eyebrow")}</LandingEyebrow>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                {t("inspection.badge")}
              </span>
            </div>
            <LandingTitle className="mt-3">{t("inspection.title")}</LandingTitle>
            <LandingLead>{t("inspection.lead")}</LandingLead>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_KEYS.map((step, index) => (
            <Reveal key={step.titleKey} delayMs={index * 60}>
              <article className="h-full rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold tracking-[0.16em] text-blue-700 uppercase">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {t(step.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(step.textKey)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={100}>
          <div className="mt-10 rounded-[1.75rem] border border-slate-200 bg-white p-5 sm:p-7">
            <InspectionPreview />
          </div>
        </Reveal>
      </LandingContainer>
    </LandingSection>
  );
}
