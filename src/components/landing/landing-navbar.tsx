"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#bosh", label: "Bosh sahifa", path: "/" },
  { href: "/ijara-qidiruv", label: "Ijara qidiruv", path: "/ijara-qidiruv" },
  { href: "/#funksiyalar", label: "Funksiyalar", path: "/" },
  { href: "/#biz-haqimizda", label: "Biz haqimizda", path: "/" },
  { href: "/ijara-egalari", label: "Ijara egalari", path: "/ijara-egalari" },
] as const;

const PAGE_PATHS = ["/ijara-egalari", "/ijara-qidiruv"] as const;

export function LandingNavbar({ activePath }: { activePath?: string } = {}) {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0a1628]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={closeMenu}
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30">
            <span className="text-sm font-bold">A</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Arenda<span className="text-cyan-400"> AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive = activePath === link.path && link.path !== "/";
            const isPageLink = PAGE_PATHS.includes(
              link.path as (typeof PAGE_PATHS)[number]
            );
            const className = cn(
              "text-sm font-medium transition-colors",
              isActive
                ? "text-cyan-400"
                : "text-slate-300 hover:text-white"
            );
            if (isPageLink) {
              return (
                <Link key={link.href} href={link.href} className={className}>
                  {link.label}
                </Link>
              );
            }
            return (
              <a key={link.href} href={link.href} className={className}>
                {link.label}
              </a>
            );
          })}
          <Link
            href="/dashboard"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-cyan-400 hover:shadow-blue-500/40"
          >
            Dashboard
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-300 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-white/10 bg-[#0a1628]/95 backdrop-blur-xl md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          {NAV_LINKS.map((link) => {
            const isActive = activePath === link.path && link.path !== "/";
            const isPageLink = PAGE_PATHS.includes(
              link.path as (typeof PAGE_PATHS)[number]
            );
            const className = cn(
              "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-cyan-500/10 text-cyan-400"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            );
            if (isPageLink) {
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
              <a
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={className}
              >
                {link.label}
              </a>
            );
          })}
          <Link
            href="/dashboard"
            onClick={closeMenu}
            className="mt-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
