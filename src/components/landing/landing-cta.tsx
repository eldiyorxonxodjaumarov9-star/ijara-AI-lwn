import Link from "next/link";
import { ArrowRight, Building2, Search } from "lucide-react";

export function LandingCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 px-8 py-16 text-center sm:px-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Arenda AI bilan ijara jarayonini aqlli boshqaring
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-blue-100">
              Ijara qidiring yoki e&apos;lon joylang — barchasi bir platformada.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/ijara-qidiruv"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-blue-700 shadow-xl transition-all hover:bg-blue-50"
              >
                <Search className="size-4" />
                Ijara qidiruv
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/ijara-egalari"
                className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <Building2 className="size-4" />
                Ijara egalari
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
