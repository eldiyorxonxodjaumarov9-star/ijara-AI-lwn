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
import { OS_MODULES } from "@/lib/landing-content";

const PREVIEWS = {
  property: PropertyPreview,
  finance: FinancePreview,
  team: TeamPreview,
  access: AccessPreview,
} as const;

export function LandingOs() {
  return (
    <LandingSection id="imkoniyatlar" tone="light">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>Ijara AI OS</LandingEyebrow>
            <LandingTitle className="mt-3">
              Barcha jarayonlar — bitta boshqaruv markazida
            </LandingTitle>
            <LandingLead>
              Har modul alohida dastur emas. Mulk, moliya, jamoa va kirish nazorati
              bir xil operatsion til bilan ishlaydi.
            </LandingLead>
          </div>
        </Reveal>

        <div className="mt-12 space-y-8 lg:space-y-10">
          {OS_MODULES.map((module, index) => {
            const Preview = PREVIEWS[module.id as keyof typeof PREVIEWS];
            const reverse = index % 2 === 1;
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
                        Modul {module.kicker}
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                        {module.title}
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-slate-600">
                        {module.lead}
                      </p>
                      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                        {module.points.map((point) => (
                          <li
                            key={point}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            {point}
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
