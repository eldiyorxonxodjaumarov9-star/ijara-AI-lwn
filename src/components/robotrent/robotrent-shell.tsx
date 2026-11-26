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
      <footer className="border-t border-white/10 bg-[#050f20]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {ROBOTRENT_BRAND}. Barcha huquqlar
            himoyalangan.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/robotrent/track" className="hover:text-cyan-300">
              Ariza holati
            </Link>
            <Link href="/robotrent/katalog" className="hover:text-cyan-300">
              Katalog
            </Link>
            <Link href="/" className="hover:text-cyan-300">
              Ijara AI
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
