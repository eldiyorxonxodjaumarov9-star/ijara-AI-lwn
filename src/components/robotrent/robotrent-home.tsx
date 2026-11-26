import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { RobotRentHeroImage } from "@/components/robotrent/robotrent-media";
import { ROBOTRENT_BRAND } from "@/lib/robotrent/constants";

const PARTNERS = [
  { title: "Mijoz", href: "/robotrent/mijoz" },
  { title: "Distribyutor", href: "/robotrent/distribyutor" },
  { title: "Ishlab chiqaruvchi", href: "/robotrent/ishlab-chiqaruvchi" },
] as const;

export function RobotRentHome() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-6 md:max-w-5xl md:px-8 md:pb-24 md:pt-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--rr-muted)] md:text-base">
        {ROBOTRENT_BRAND}
      </p>
      <h1 className="mt-3 text-[1.75rem] font-bold leading-tight text-[var(--rr-text)] md:mt-4 md:max-w-xl md:text-4xl">
        Robotni obyektingizda sinab ko‘ring
      </h1>

      <div className="mt-6 md:mt-8">
        <RobotRentHeroImage />
      </div>

      <div className="mt-6 flex flex-col gap-3 md:mt-10 md:max-w-md">
        {PARTNERS.map((p) => (
          <Link key={p.href} href={p.href} className="robotrent-partner-link">
            <span>{p.title}</span>
            <ChevronRight className="size-5 text-[var(--rr-muted)]" aria-hidden />
          </Link>
        ))}
      </div>

      <div className="mt-10 hidden border-t border-[var(--rr-border)] pt-8 md:grid md:grid-cols-3 md:gap-6">
        <Link href="/robotrent/katalog" className="robotrent-card p-6 text-sm font-semibold">
          Robotlar katalogi
        </Link>
        <Link href="/robotrent/sinovdan-ijaraga" className="robotrent-card p-6 text-sm font-semibold">
          Sinovdan ijaragacha
        </Link>
        <Link href="/robotrent/track" className="robotrent-card p-6 text-sm font-semibold">
          Ariza holati
        </Link>
      </div>
    </div>
  );
}