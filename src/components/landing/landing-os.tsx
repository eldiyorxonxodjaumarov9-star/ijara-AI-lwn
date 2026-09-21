"use client";

import {
  AccessPreview,
  FinancePreview,
  PropertyPreview,
  TeamPreview,
} from "@/components/landing/landing-mockups";
import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { useLandingT } from "@/hooks/use-landing-t";
import {
  formatLandingMessage,
  type LandingMessageKey,
} from "@/lib/i18n/landing";

const PREVIEWS = {
  property: PropertyPreview,
  finance: FinancePreview,
  team: TeamPreview,
  access: AccessPreview,
} as const;

const OS_MODULES = [
  {
    id: "property",
    kickerKey: "os.property.kicker",
    titleKey: "os.property.title",
    leadKey: "os.property.lead",
    pointKeys: [
      "os.property.point.1",
      "os.property.point.2",
      "os.property.point.3",
      "os.property.point.4",
    ],
  },
  {
    id: "finance",
    kickerKey: "os.finance.kicker",
    titleKey: "os.finance.title",
    leadKey: "os.finance.lead",
    pointKeys: [
      "os.finance.point.1",
      "os.finance.point.2",
      "os.finance.point.3",
      "os.finance.point.4",
      "os.finance.point.5",
      "os.finance.point.6",
    ],
  },
  {
    id: "team",
    kickerKey: "os.team.kicker",
    titleKey: "os.team.title",
    leadKey: "os.team.lead",
    pointKeys: [
      "os.team.point.1",
      "os.team.point.2",
      "os.team.point.3",
      "os.team.point.4",
      "os.team.point.5",
    ],
  },
  {
    id: "access",
    kickerKey: "os.access.kicker",
    titleKey: "os.access.title",
    leadKey: "os.access.lead",
    pointKeys: [
      "os.access.point.1",
      "os.access.point.2",
      "os.access.point.3",
      "os.access.point.4",
    ],
  },
] as const satisfies ReadonlyArray<{
  id: keyof typeof PREVIEWS;
  kickerKey: LandingMessageKey;
  titleKey: LandingMessageKey;
  leadKey: LandingMessageKey;
  pointKeys: readonly LandingMessageKey[];
}>;

export function LandingOs() {
  const t = useLandingT();

  return (
    <LandingSection id="imkoniyatlar" tone="light">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>{t("os.eyebrow")}</LandingEyebrow>
            <LandingTitle className="mt-3">{t("os.title")}</LandingTitle>
            <LandingLead>{t("os.lead")}</LandingLead>
          </div>
        </Reveal>

        <div className="mt-12 space-y-8 lg:space-y-10">
          {OS_MODULES.map((module, index) => {
            const Preview = PREVIEWS[module.id];
            const reverse = index % 2 === 1;
            const kicker = t(module.kickerKey);
            return (
              <Reveal key={module.id} delayMs={index * 40}>
                <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[#F8FAFC]">
                  <div
                    className={`grid items-center gap-6 p-5 sm:p-7 lg:grid-cols-2 lg:gap-10 lg:p-9 ${
                      reverse ? "lg:[&>*:first-child]:order-2" : ""
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-blue-700 uppercase">
                        {formatLandingMessage(t("os.moduleLabel"), { kicker })}
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                        {t(module.titleKey)}
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-slate-600">
                        {t(module.leadKey)}
                      </p>
                      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                        {module.pointKeys.map((pointKey) => (
                          <li
                            key={pointKey}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            {t(pointKey)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Preview />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
