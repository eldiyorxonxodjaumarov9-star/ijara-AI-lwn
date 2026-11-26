"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Menu, X } from "lucide-react";

import { ROBOTRENT_BRAND } from "@/lib/robotrent/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/robotrent", label: "Bosh sahifa" },
  { href: "/robotrent/mijoz", label: "Mijoz" },
  { href: "/robotrent/distribyutor", label: "Distribyutor" },
  { href: "/robotrent/ishlab-chiqaruvchi", label: "Ishlab chiqaruvchi" },
  { href: "/robotrent/katalog", label: "Katalog" },
  { href: "/robotrent/sinovdan-ijaraga", label: "Sinovdan ijaraga" },
  { href: "/robotrent/track", label: "Holat" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/robotrent") return pathname === "/robotrent";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function RobotRentNav() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071429]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/robotrent"
          className="flex shrink-0 items-center gap-2 text-white"
          aria-label={ROBOTRENT_BRAND}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-300/30">
            <Bot className="size-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            {ROBOTRENT_BRAND}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 xl:flex"
          aria-label="RobotRent navigatsiya"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(pathname, l.href)
                  ? "bg-cyan-400/10 text-cyan-300"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/"
            className="ml-2 rounded-md border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/10"
          >
            Ijara AI
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md text-white hover:bg-white/10 xl:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open ? (
        <div
          id={menuId}
          className="border-t border-white/10 bg-[#071429] xl:hidden"
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-3 text-sm font-medium",
                  isActive(pathname, l.href)
                    ? "bg-cyan-400/10 text-cyan-300"
                    : "text-slate-200 hover:bg-white/5"
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-md border border-cyan-300/40 px-3 py-3 text-sm font-semibold text-cyan-300"
            >
              Ijara AI
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
