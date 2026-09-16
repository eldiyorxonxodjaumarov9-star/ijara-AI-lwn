import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { ABOUT_POINTS } from "@/lib/landing-content";

export function LandingAbout() {
  return (
    <LandingSection id="biz-haqimizda" tone="light">
      <LandingContainer>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <Reveal>
            <div>
              <LandingEyebrow>Biz haqimizda</LandingEyebrow>
              <LandingTitle className="mt-3">
                Mahalliy ijara biznesi uchun yaratilgan zamonaviy boshqaruv tizimi.
              </LandingTitle>
              <LandingLead>
                Ijara AI O‘zbekiston ijara va property management bozoridagi real
                operatsion muammolarni bitta platformaga birlashtirish uchun
                yaratilgan: moliya, xodim, kirish nazorati va AI tahlil.
              </LandingLead>
              <blockquote className="mt-8 border-l-2 border-blue-600 pl-5 text-base font-medium leading-relaxed tracking-tight text-slate-900 sm:text-lg">
                Ijara AI — shunchaki AI qo‘shilgan CRM emas. Bu ijara
                operatsiyalarini yagona tizimda boshqarishga yordam beradigan
                Property Management platforma.
              </blockquote>
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="grid gap-3 sm:grid-cols-2">
              {ABOUT_POINTS.map((point) => (
                <article
                  key={point.title}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5"
                >
                  <h3 className="text-sm font-semibold text-slate-900">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {point.text}
                  </p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
