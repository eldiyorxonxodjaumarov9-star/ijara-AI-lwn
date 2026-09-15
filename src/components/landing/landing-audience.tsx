import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { AUDIENCE } from "@/lib/landing-content";

export function LandingAudience() {
  return (
    <LandingSection id="kimlar-uchun" tone="light">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>Kimlar uchun</LandingEyebrow>
            <LandingTitle className="mt-3">
              Turli ijara modellari — bitta operatsion yadro
            </LandingTitle>
            <LandingLead>
              Segment farq qiladi, lekin boshqaruv ehtiyoji bir xil: bandlik, to‘lov,
              jamoa va kirish nazorati.
            </LandingLead>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((item, index) => (
            <Reveal key={item.title} delayMs={(index % 4) * 50}>
              <article className="h-full rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 transition-colors hover:border-blue-200 hover:bg-white">
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.useCase}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
