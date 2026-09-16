import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { HOW_STEPS } from "@/lib/landing-content";

export function LandingHow() {
  return (
    <LandingSection tone="navy" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 landing-navy-grid opacity-40" />
      <LandingContainer className="relative">
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow tone="navy">How it works</LandingEyebrow>
            <LandingTitle className="mt-3 text-white">
              Ijara AI qanday ishlaydi?
            </LandingTitle>
            <LandingLead className="text-slate-300">
              Bosqichma-bosqich: mulkdan moliyaga, jamoadan AI hisobotgacha.
            </LandingLead>
          </div>
        </Reveal>

        <div className="relative mt-12">
          <div className="pointer-events-none absolute top-6 right-8 left-8 hidden h-px bg-gradient-to-r from-blue-400/0 via-blue-300/40 to-blue-400/0 lg:block" />
          <div className="grid gap-4 lg:grid-cols-5">
            {HOW_STEPS.map((step, index) => (
              <Reveal key={step.n} delayMs={index * 60}>
                <article className="relative h-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold tracking-[0.18em] text-blue-300">
                    {step.n}
                  </p>
                  <h3 className="mt-3 text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
