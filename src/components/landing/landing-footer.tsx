"use client";

import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { useLandingT } from "@/hooks/use-landing-t";
import { LANDING_BRAND } from "@/lib/landing-content";
import type { LandingMessageKey } from "@/lib/i18n/landing";

const FOOTER_PRODUCT = [
  { href: "/#platforma", labelKey: "footer.product.platform" as const },
  { href: "/#ai", labelKey: "footer.product.ai" as const },
  { href: "/#smart-access", labelKey: "footer.product.smartAccess" as const },
  { href: "/#vazifalar", labelKey: "footer.product.tasks" as const },
] satisfies ReadonlyArray<{ href: string; labelKey: LandingMessageKey }>;

const FOOTER_COMPANY = [
  { href: "/#biz-haqimizda", labelKey: "footer.company.about" as const },
  { href: "/#kimlar-uchun", labelKey: "footer.company.audience" as const },
] satisfies ReadonlyArray<{ href: string; labelKey: LandingMessageKey }>;

const FOOTER_ACCESS = [
  { href: "/login", labelKey: "footer.access.login" as const },
  { href: "/login", labelKey: "footer.access.dashboard" as const },
] satisfies ReadonlyArray<{ href: string; labelKey: LandingMessageKey }>;

export function LandingFooter() {
  const t = useLandingT();
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
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
            {t("footer.col.product")}
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FOOTER_PRODUCT.map((item) => (
              <li key={item.labelKey}>
                <Link href={item.href} className="transition-colors hover:text-white">
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
            {t("footer.col.company")}
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FOOTER_COMPANY.map((item) => (
              <li key={item.labelKey}>
                <Link href={item.href} className="transition-colors hover:text-white">
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
            {t("footer.col.access")}
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FOOTER_ACCESS.map((item) => (
              <li key={item.labelKey}>
                <Link href={item.href} className="transition-colors hover:text-white">
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            &copy; {year} {LANDING_BRAND}. {t("footer.copyright")}
          </p>
          <p>{t("footer.market")}</p>
        </div>
      </div>
    </footer>
  );
}
