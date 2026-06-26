import { LANDING_AUDIENCE } from "@/lib/landing-content";

export function LandingAudience() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Kimlar uchun?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Har xil foydalanuvchilar uchun moslashtirilgan yechimlar.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_AUDIENCE.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all hover:border-cyan-500/20"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
                <item.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
