import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import {
  FOOTER_ACCESS,
  FOOTER_COMPANY,
  FOOTER_PRODUCT,
  LANDING_BRAND,
} from "@/lib/landing-content";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#071429] text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <BrandMark />
            </div>
            <span className="text-lg font-semibold text-white">{LANDING_BRAND}</span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Ijara biznesi uchun Property Management platformasi. Mulk, moliya,
            jamoa va kirish nazorati — bitta tizimda.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Mahsulot
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FOOTER_PRODUCT.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Kompaniya
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FOOTER_COMPANY.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Kirish
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FOOTER_ACCESS.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            &copy; {year} {LANDING_BRAND}. Barcha huquqlar himoyalangan.
          </p>
          <p>O‘zbekiston ijara va property management bozori uchun.</p>
        </div>
      </div>
    </footer>
  );
}
