import type { ReactNode } from "react";
import Link from "next/link";

import "./robotrent.css";

import { RobotRentNav } from "@/components/robotrent/robotrent-nav";
import { ROBOTRENT_BRAND } from "@/lib/robotrent/constants";

export function RobotRentShell({ children }: { children: ReactNode }) {
  return (
    <div className="robotrent-root flex min-h-screen flex-col">
      <RobotRentNav />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--rr-border)] bg-[var(--rr-surface)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-5 text-xs text-[var(--rr-muted)] md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} {ROBOTRENT_BRAND}</p>
          <Link href="/robotrent/track" className="hover:text-[var(--rr-text)]">
            Ariza holati
          </Link>
        </div>
      </footer>
    </div>
  );
}