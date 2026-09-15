import { TelegramPreview } from "@/components/landing/landing-mockups";
import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";

export function LandingTelegram() {
  return (
    <LandingSection id="vazifalar" tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>Telegram + Tasks</LandingEyebrow>
            <LandingTitle className="mt-3">
              Jamoani sayt va Telegram’dan boshqaring.
            </LandingTitle>
            <LandingLead>
              Menejer vazifa beradi, xodim Telegramda qabul qiladi, hisobot esa
              platformaga qaytadi. Status, izoh, rasm va vaqt — bitta ish jarayoni.
            </LandingLead>
          </div>
        </Reveal>

        <Reveal delayMs={70}>
          <div className="mt-10">
            <TelegramPreview />
          </div>
        </Reveal>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
          ["Topshiriq", "305-xonani tekshiring"],
          ["Javob", "Bajarildi"],
          ["Hisobot", "Rasm · izoh · vaqt"],
          ["Status", "Sayt va Telegramda bir xil"],
        ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {label}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
