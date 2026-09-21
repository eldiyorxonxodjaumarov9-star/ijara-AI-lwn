"use client";

import { TelegramPreview } from "@/components/landing/landing-mockups";
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

const CARD_KEYS = [
  { labelKey: "telegram.card.1.label", valueKey: "telegram.card.1.value" },
  { labelKey: "telegram.card.2.label", valueKey: "telegram.card.2.value" },
  { labelKey: "telegram.card.3.label", valueKey: "telegram.card.3.value" },
  { labelKey: "telegram.card.4.label", valueKey: "telegram.card.4.value" },
] as const satisfies ReadonlyArray<{
  labelKey: LandingMessageKey;
  valueKey: LandingMessageKey;
}>;

export function LandingTelegram() {
  const t = useLandingT();

  return (
    <LandingSection id="vazifalar" tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>{t("telegram.eyebrow")}</LandingEyebrow>
            <LandingTitle className="mt-3">{t("telegram.title")}</LandingTitle>
            <LandingLead>{t("telegram.lead")}</LandingLead>
          </div>
        </Reveal>

        <Reveal delayMs={70}>
          <div className="mt-10">
            <TelegramPreview />
          </div>
        </Reveal>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {CARD_KEYS.map((card) => (
            <div
              key={card.labelKey}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {t(card.labelKey)}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {t(card.valueKey)}
              </p>
            </div>
          ))}
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
