"use client";

import { Reveal } from "@/components/landing/landing-reveal";
import { AccessPreview } from "@/components/landing/landing-mockups";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { useLandingT } from "@/hooks/use-landing-t";
import type { LandingMessageKey } from "@/lib/i18n/landing";

const LOCK_STEP_KEYS = [
  { titleKey: "smartLock.step.1.title", textKey: "smartLock.step.1.text" },
  { titleKey: "smartLock.step.2.title", textKey: "smartLock.step.2.text" },
  { titleKey: "smartLock.step.3.title", textKey: "smartLock.step.3.text" },
  { titleKey: "smartLock.step.4.title", textKey: "smartLock.step.4.text" },
  { titleKey: "smartLock.step.5.title", textKey: "smartLock.step.5.text" },
] as const satisfies ReadonlyArray<{
  titleKey: LandingMessageKey;
  textKey: LandingMessageKey;
}>;

const CHIP_KEYS = [
  "smartLock.chip.1",
  "smartLock.chip.2",
  "smartLock.chip.3",
  "smartLock.chip.4",
  "smartLock.chip.5",
  "smartLock.chip.6",
] as const satisfies ReadonlyArray<LandingMessageKey>;

export function LandingSmartLock() {
  const t = useLandingT();

  return (
    <LandingSection id="smart-access" tone="light">
      <LandingContainer>
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <Reveal>
            <div>
              <LandingEyebrow>{t("smartLock.eyebrow")}</LandingEyebrow>
              <LandingTitle className="mt-3">{t("smartLock.title")}</LandingTitle>
              <LandingLead>{t("smartLock.lead")}</LandingLead>

              <ol className="mt-8 space-y-3">
                {LOCK_STEP_KEYS.map((step, index) => (
                  <li
                    key={step.titleKey}
                    className="flex gap-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0b1f3b] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{t(step.titleKey)}</p>
                      <p className="mt-1 text-sm text-slate-600">{t(step.textKey)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="mt-6 text-sm leading-relaxed text-slate-500">
                {t("smartLock.disclaimer")}
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="lg:sticky lg:top-28">
              <AccessPreview />
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {CHIP_KEYS.map((key) => (
                  <li
                    key={key}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
