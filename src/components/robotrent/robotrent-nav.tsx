"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { ROBOTRENT_BRAND } from "@/lib/robotrent/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/robotrent", label: "Bosh sahifa" },
  { href: "/robotrent#qanday-ishlaydi", label: "Qanday ishlaydi" },
  { href: "/robotrent/mijoz", label: "Mijoz" },
  { href: "/robotrent/distribyutor", label: "Distribyutor" },
  { href: "/robotrent/ishlab-chiqaruvchi", label: "Ishlab chiqaruvchi" },
  { href: "/robotrent/katalog", label: "Katalog" },
  { href: "/robotrent/track", label: "Holat" },
] as const;

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
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[var(--rr-bg)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 lg:h-16 lg:px-8">
        <Link
          href="/robotrent"
          className="text-[0.95rem] font-bold tracking-tight text-[var(--rr-text)] lg:text-base"
        >
          {ROBOTRENT_BRAND}
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="RobotRent">
          <Link
            href="/robotrent#qanday-ishlaydi"
            className="text-sm font-medium text-[var(--rr-text)] hover:opacity-70"
          >
            Qanday ishlaydi
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center text-[var(--rr-text)] lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open ? (
        <div id={menuId} className="border-t border-black/10 bg-[var(--rr-bg)] lg:hidden">
          <nav className="mx-auto flex max-w-lg flex-col px-4 py-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "px-1 py-3 text-sm font-medium",
                  pathname === l.href || (l.href !== "/robotrent" && pathname.startsWith(l.href))
                    ? "text-[var(--rr-primary)]"
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