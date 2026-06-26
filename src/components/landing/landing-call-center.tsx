import { Headphones, Phone, Mic } from "lucide-react";

export function LandingCallCenter() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-purple-600/10 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-blue-600/10 blur-[80px]" />

          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
                Tez orada
              </span>
              <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
                Kelajakdagi AI Call Center
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-400">
                Mijoz telefon orqali so&apos;rov qoldiradi, AI operator esa hudud,
                budjet va talablarni tushunib, eng mos ijara variantlarini tavsiya
                qiladi — 24/7, inson operatorisiz.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {[
                {
                  icon: Phone,
                  title: "Telefon orqali so'rov",
                  text: "Mijoz qo'ng'iroq qiladi va talablarini aytaveradi.",
                },
                {
                  icon: Mic,
                  title: "Ovozni tahlil qilish",
                  text: "AI til va ma'noni tushunib, parametrlarni ajratadi.",
                },
                {
                  icon: Headphones,
                  title: "Mos variantlar",
                  text: "Platformadagi e'lonlar asosida eng yaxshi takliflar beriladi.",
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-600/20 text-purple-300">
                    <step.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{step.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-400">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
