import { Reveal } from "@/components/landing/landing-reveal";
import { AccessPreview } from "@/components/landing/landing-mockups";
import {
  LandingContainer,
  LandingEyebrow,
  LandingLead,
  LandingSection,
  LandingTitle,
} from "@/components/landing/landing-shell";
import { LOCK_STEPS } from "@/lib/landing-content";

export function LandingSmartLock() {
  return (
    <LandingSection id="smart-access" tone="light">
      <LandingContainer>
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <Reveal>
            <div>
              <LandingEyebrow>Smart Access</LandingEyebrow>
              <LandingTitle className="mt-3">Aqlli kirish boshqaruvi</LandingTitle>
              <LandingLead>
                Mos TTLock konfiguratsiyasida vaqtli kirish va access nazoratini
                boshqaring. Arendator, muddat, PIN va xona bitta kartochkada
                bog‘lanadi.
              </LandingLead>

              <ol className="mt-8 space-y-3">
                {LOCK_STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="flex gap-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0b1f3b] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{step.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="mt-6 text-sm leading-relaxed text-slate-500">
                Masofaviy ochish/yopish gateway va qulf onlayn holatiga bog‘liq
                bo‘lishi mumkin. Landing mavjud boshqaruv modelini ko‘rsatadi —
                “har doim ishlaydi” deb da’vo qilinmaydi.
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="lg:sticky lg:top-28">
              <AccessPreview />
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  "Vaqtinchalik PIN",
                  "Vaqt chegarasi",
                  "Huquq berish / bekor qilish",
                  "Kirish tarixi",
                  "Xona bilan bog‘lash",
                  "Huquq nazorati",
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </LandingContainer>
    </LandingSection>
  );
}
