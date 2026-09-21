"use client";

import { Bot, UserRound } from "lucide-react";

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

const AI_ITEM_KEYS = [
  "humanAi.ai.1",
  "humanAi.ai.2",
  "humanAi.ai.3",
  "humanAi.ai.4",
  "humanAi.ai.5",
  "humanAi.ai.6",
] as const satisfies ReadonlyArray<LandingMessageKey>;

const HUMAN_ITEM_KEYS = [
  "humanAi.human.1",
  "humanAi.human.2",
  "humanAi.human.3",
  "humanAi.human.4",
  "humanAi.human.5",
  "humanAi.human.6",
] as const satisfies ReadonlyArray<LandingMessageKey>;

export function LandingHumanAi() {
  const t = useLandingT();

  return (
    <LandingSection tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>{t("humanAi.eyebrow")}</LandingEyebrow>
            <LandingTitle className="mt-3">{t("humanAi.title")}</LandingTitle>
            <LandingLead>{t("humanAi.lead")}</LandingLead>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Bot className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {t("humanAi.ai.title")}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {t("humanAi.ai.subtitle")}
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {AI_ITEM_KEYS.map((key) => (
                  <li
                    key={key}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 text-sm text-slate-700"
                  >
                    {t(key)}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal delayMs={80}>
            <article className="h-full rounded-[1.75rem] border border-slate-200 bg-[#0b1f3b] p-6 text-white sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                  <UserRound className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{t("humanAi.human.title")}</h3>
                  <p className="text-sm text-slate-300">
                    {t("humanAi.human.subtitle")}
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {HUMAN_ITEM_KEYS.map((key) => (
                  <li
                    key={key}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                  >
                    {t(key)}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
