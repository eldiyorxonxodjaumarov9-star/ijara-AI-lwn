import { LANDING_FEATURES } from "@/lib/landing-content";

export function LandingFeatures() {
  return (
    <section id="funksiyalar" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            AI funksiyalar
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Ijara bozori uchun to&apos;liq ekotizim — qidiruvdan boshqaruvgacha.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_FEATURES.map((feature) => (
            <article
              key={feature.id}
              id={feature.id === "ai-qidiruv" ? "ai-qidiruv" : undefined}
              className="group flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-6 backdrop-blur-sm transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-blue-600/20 text-cyan-400 transition-colors group-hover:bg-blue-600/30">
                <feature.icon className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
