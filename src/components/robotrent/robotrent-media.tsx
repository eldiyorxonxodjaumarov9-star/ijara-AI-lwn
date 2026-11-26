"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

export function RobotRentPartnerHero({ badge }: { badge: string }) {
  return (
    <div className="relative w-full">
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-[var(--rr-border)] bg-[#e8e4dc] md:mx-auto md:max-w-3xl md:border md:border-[var(--rr-border)]">
        <Image
          src="/robotrent/hero-9.jpg"
          alt=""
          fill
          className="object-cover object-center"
          sizes="(max-width: 768px) 100vw, 720px"
          priority
        />
      </div>
      <span
        className={cn(
          "absolute left-4 top-4 bg-[var(--rr-primary)] px-3 py-1 text-xs font-semibold text-white"
        )}
      >
        {badge}
      </span>
    </div>
  );
}