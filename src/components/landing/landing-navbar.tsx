"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { LANDING_BRAND, LANDING_NAV, PORTAL_NAV } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

export function LandingNavbar({ activePath }: { activePath?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();
  const isPortal = Boolean(activePath);
  const onDarkHero = !isPortal && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter,color] duration-300",
        isPortal
          ? "border-b border-white/10 bg-[#0a1628]/80 text-white backdrop-blur-xl"
          : scrolled
            ? "border-b border-slate-200/80 bg-white/85 text-slate-900 shadow-sm backdrop-blur-xl"
            : "border-b border-white/10 bg-[#071429]/55 text-white backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          onClick={closeMenu}
        >
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-xl text-white shadow-sm",
              isPortal
                ? "bg-gradient-to-br from-blue-500 to-cyan-400"
                : onDarkHero
                  ? "bg-white/10"
                  : "bg-[#0b1f3b]"
            )}
          >
            <BrandMark />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {LANDING_BRAND}
          </span>
        </Link>

        {isPortal ? (
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Asosiy navigatsiya">
            {PORTAL_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none",
                  activePath === link.path ? "text-cyan-400" : "text-slate-300"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            >
              Kirish
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
            >
              Dashboard
            </Link>
          </nav>
        ) : (
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Asosiy navigatsiya">
            {LANDING_NAV.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
                  onDarkHero
                    ? "text-slate-200 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {!isPortal ? (
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
                onDarkHero
                  ? "text-slate-100 hover:bg-white/10"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              Kirish
            </Link>
            <Link
              href="/login"
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
                onDarkHero
                  ? "bg-white text-[#071429] hover:bg-blue-50"
                  : "bg-[#0b1f3b] text-white hover:bg-[#132848]"
              )}
            >
              Dashboard
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          className={cn(
            "rounded-lg p-2 lg:hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
            isPortal || onDarkHero ? "text-slate-100" : "text-slate-800"
          )}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
        >
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 top-16 z-40 bg-black/40 lg:hidden"
          aria-label="Menyuni yopish"
          onClick={closeMenu}
        />
      ) : null}

      <div
        id={menuId}
        className={cn(
          "relative z-50 lg:hidden",
          open ? "block" : "hidden",
          isPortal
            ? "border-t border-white/10 bg-[#0a1628]"
            : onDarkHero
              ? "border-t border-white/10 bg-[#0b1f3b]"
              : "border-t border-slate-200 bg-white"
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Mobil navigatsiya">
          {(isPortal ? PORTAL_NAV : LANDING_NAV).map((link) => {
            const className = cn(
              "rounded-lg px-3 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
              isPortal || onDarkHero
                ? "text-slate-100 hover:bg-white/5"
                : "text-slate-800 hover:bg-slate-50"
            );
            if ("path" in link) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={className}
                >
                  {link.label}
                </Link>
              );
            }
            return (
              <a key={link.href} href={link.href} onClick={closeMenu} className={className}>
                {link.label}
              </a>
            );
          })}
          <Link
            href="/login"
            onClick={closeMenu}
            className={cn(
              "rounded-lg px-3 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
              isPortal || onDarkHero
                ? "text-slate-100 hover:bg-white/5"
                : "text-slate-800 hover:bg-slate-50"
            )}
          >
            Kirish
          </Link>
          <Link
            href="/login"
            onClick={closeMenu}
            className={cn(
              "mt-2 rounded-lg px-4 py-3 text-center text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
              isPortal
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                : onDarkHero
                  ? "bg-white text-[#071429]"
                  : "bg-[#0b1f3b] text-white"
            )}
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
