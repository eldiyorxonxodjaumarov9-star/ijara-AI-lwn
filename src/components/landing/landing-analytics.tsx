import { AnalyticsPreview } from "@/components/landing/landing-mockups";
import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { ANALYTICS_INSIGHTS } from "@/lib/landing-content";

export function LandingAnalytics() {
  return (
    <LandingSection id="ai" tone="navy" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 landing-navy-grid opacity-50" />
      <LandingContainer className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <div>
              <LandingEyebrow tone="navy">AI Analytics</LandingEyebrow>
              <LandingTitle className="mt-3 text-white">
                Hisobotni ko‘rish emas — nima bo‘layotganini tushunish.
              </LandingTitle>
              <LandingLead className="text-slate-300">
                Platforma oylararo farqni, xarajat o‘sishini, qarzdorlikni va
                obyekt samaradorligini bitta tahlil oqimida yig‘adi. Raqam yonida
                sabab va tavsiya turadi.
              </LandingLead>
              <ul className="mt-7 grid gap-3 sm:grid-cols-3">
                {ANALYTICS_INSIGHTS.map((item) => (
                  <li
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-[11px] tracking-wide text-slate-400 uppercase">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-slate-400">{item.hint}</p>
                  </li>
                ))}
              </ul>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                <li>• Qaysi oy xarajat oshdi va oldingi oyda qancha edi</li>
                <li>• Farq summa va foizda, kategoriya bo‘yicha</li>
                <li>• Qarzdorlar, daromad dinamikasi, obyekt samaradorligi</li>
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
