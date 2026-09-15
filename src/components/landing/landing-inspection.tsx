import { InspectionPreview } from "@/components/landing/landing-mockups";
import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";

const FLOW = [
  {
    title: "Kirishda",
    text: "Xona rasmlari olinadi va boshlang‘ich holat sifatida saqlanadi.",
  },
  {
    title: "Chiqishda",
    text: "Ijarachi foydalanganidan keyin yangi rasmlar olinadi.",
  },
  {
    title: "AI solishtiradi",
    text: "Oldingi va keyingi kadrlarni tahlil qilib, o‘zgarishlarni belgilaydi.",
  },
  {
    title: "Hisobot",
    text: "Normal, tekshirish kerak yoki zarar belgisi — natija ko‘rsatiladi.",
  },
] as const;

export function LandingInspection() {
  return (
    <LandingSection tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <LandingEyebrow>AI Room Inspection</LandingEyebrow>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                Yo‘lda / yangi imkoniyat
              </span>
            </div>
            <LandingTitle className="mt-3">Xona holatini AI tekshiradi.</LandingTitle>
            <LandingLead>
              Kirish va chiqishdagi rasmlarni solishtirib, o‘zgarish yoki shikast
              belgisini aniqlashga yordam beradi. Bu kelayotgan AI imkoniyat —
              to‘liq production tayyorligi sifatida emas.
            </LandingLead>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((step, index) => (
            <Reveal key={step.title} delayMs={index * 60}>
              <article className="h-full rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold tracking-[0.16em] text-blue-700 uppercase">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
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
