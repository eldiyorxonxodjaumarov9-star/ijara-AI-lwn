import { Brain, Shield, Zap } from "lucide-react";

const POINTS = [
  {
    icon: Brain,
    title: "Aqlli tahlil",
    description:
      "Tabiiy til orqali qidiruv, narx baholash va mos e'lonlarni avtomatik tanlash.",
  },
  {
    icon: Zap,
    title: "Tez va qulay",
    description:
      "E'lon joylash, mijoz bilan aloqa va boshqaruv — barchasi bir platformada.",
  },
  {
    icon: Shield,
    title: "Ishonchli boshqaruv",
    description:
      "Admin dashboard orqali mulklar, to'lovlar, shartnomalar va statistikani nazorat qiling.",
  },
];

export function LandingAbout() {
  return (
    <section id="biz-haqimizda" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Arenda AI nima qiladi?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Biz ijara jarayonini sun&apos;iy intellekt yordamida soddalashtiramiz —
            qidiruvdan boshqaruvgacha barcha bosqichlarda vaqt va resurs tejaymiz.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {POINTS.map((point) => (
            <div
              key={point.title}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.07]"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/30 to-cyan-500/20 text-cyan-400">
                <point.icon className="size-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
