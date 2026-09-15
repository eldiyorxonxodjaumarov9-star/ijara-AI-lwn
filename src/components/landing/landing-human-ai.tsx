import { Bot, UserRound } from "lucide-react";

import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { HUMAN_AI } from "@/lib/landing-content";

export function LandingHumanAi() {
  return (
    <LandingSection tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>Human + AI</LandingEyebrow>
            <LandingTitle className="mt-3">
              AI nimani bajaradi, odam nimani boshqaradi?
            </LandingTitle>
            <LandingLead>
              Platforma qaror bermaydi — qaror uchun asos tayyorlaydi. Yakuniy
              qaror va javobgarlik odamda qoladi.
            </LandingLead>
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
                  <h3 className="text-xl font-semibold text-slate-900">AI</h3>
                  <p className="text-sm text-slate-500">Tahlil, solishtirish, signal</p>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {HUMAN_AI.ai.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 text-sm text-slate-700"
                  >
                    {item}
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
                  <h3 className="text-xl font-semibold">Odam</h3>
                  <p className="text-sm text-slate-300">Yakuniy qaror va javobgarlik</p>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {HUMAN_AI.human.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                  >
                    {item}
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
