import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function LandingHero() {
  return (
    <section
      id="bosh"
      className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-20 right-0 h-[300px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.15),transparent_50%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300 backdrop-blur-sm">
            <Sparkles className="size-4" />
            O&apos;zbekiston ijara bozori uchun AI platforma
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Arenda AI — O&apos;zbekistondagi ijara va ko&apos;chmas mulk bozori
            uchun{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
              aqlli AI platforma
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Uy, ofis, do&apos;kon, ombor, yer maydoni va boshqa ko&apos;chmas
            mulklarni tez topish, joylashtirish va boshqarish uchun zamonaviy AI
            yechim.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="#funksiyalar"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              Funksiyalarni ko&apos;rish
            </Link>
            <Link
              href="/ijara-qidiruv"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-500/30 transition-all hover:from-blue-500 hover:to-cyan-400"
            >
              Ijara qidiruv
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-cyan-400">
            AI Qidiruv misoli
          </p>
          <p className="text-lg text-slate-200 sm:text-xl">
            &ldquo;Chilonzorda 2 xonali kvartira kerak, budjet 5 million&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <span className="size-2 animate-pulse rounded-full bg-cyan-400" />
            AI hudud, narx va talablarni tahlil qilmoqda...
          </div>
        </div>
      </div>
    </section>
  );
}
