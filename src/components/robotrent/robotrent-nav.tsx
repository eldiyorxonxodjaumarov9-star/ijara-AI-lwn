"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { ROBOTRENT_BRAND } from "@/lib/robotrent/constants";
import { cn } from "@/lib/utils";

const DESKTOP_LINKS = [
  { href: "/robotrent/katalog", label: "Katalog" },
  { href: "/robotrent/sinovdan-ijaraga", label: "Sinovdan ijaraga" },
  { href: "/robotrent/track", label: "Holat" },
] as const;

const MOBILE_LINKS = [
  { href: "/robotrent", label: "Bosh sahifa" },
  { href: "/robotrent/mijoz", label: "Mijoz" },
  { href: "/robotrent/distribyutor", label: "Distribyutor" },
  { href: "/robotrent/ishlab-chiqaruvchi", label: "Ishlab chiqaruvchi" },
  ...DESKTOP_LINKS,
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
    <header className="sticky top-0 z-50 border-b border-[var(--rr-border)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 md:h-16 md:px-8">
        <Link
          href="/robotrent"
          className="text-base font-bold tracking-tight text-[var(--rr-text)] md:text-lg"
        >
          {ROBOTRENT_BRAND}
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="RobotRent">
          {DESKTOP_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "text-sm font-medium text-[var(--rr-muted)] hover:text-[var(--rr-text)]",
                isActive(pathname, l.href) && "text-[var(--rr-primary)]"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--rr-text)] hover:bg-[var(--rr-surface)] md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open ? (
        <div id={menuId} className="border-t border-[var(--rr-border)] bg-white md:hidden">
          <nav className="mx-auto flex max-w-lg flex-col px-4 py-3">
            {MOBILE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-3 text-sm font-medium",
                  isActive(pathname, l.href)
                    ? "bg-[var(--rr-surface)] text-[var(--rr-primary)]"
                    : "text-[var(--rr-text)]"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}