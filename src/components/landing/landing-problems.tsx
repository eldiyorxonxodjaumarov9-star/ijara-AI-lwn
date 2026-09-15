import { Reveal } from "@/components/landing/landing-reveal";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { PROBLEMS } from "@/lib/landing-content";

export function LandingProblems() {
  return (
    <LandingSection tone="muted">
      <LandingContainer>
        <Reveal>
          <div className="max-w-3xl">
            <LandingEyebrow>Muammolar</LandingEyebrow>
            <LandingTitle className="mt-3">
              Ijara biznesida boshqaruv nega qiyin?
            </LandingTitle>
            <LandingLead>
              Muammo bitta e‘lon yoki bitta to‘lovda emas. Muammo — jarayonlarning
              tarqoqligi. Har bir kechikish keyingi oy hisobiga o‘tadi.
            </LandingLead>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <article className="h-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
              <p className="text-xs font-semibold tracking-[0.16em] text-blue-700 uppercase">
                Asosiy bosim
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {PROBLEMS.featured.title}
              </h3>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                {PROBLEMS.featured.text}
              </p>
            </article>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            {PROBLEMS.secondary.map((item, index) => (
              <Reveal key={item.title} delayMs={index * 70}>
                <article className="h-full rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PROBLEMS.rest.map((item, index) => (
            <Reveal key={item.title} delayMs={index * 40}>
              <article className="h-full rounded-2xl border border-slate-200/80 bg-white/80 p-5">
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
