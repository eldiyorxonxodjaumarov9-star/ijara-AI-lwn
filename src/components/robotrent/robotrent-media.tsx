"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

export const ROBOTRENT_ASSETS = {
  heroRobot: "/robotrent/hero-robot.svg",
  partnerHero: "/robotrent/hero-robot.svg",
} as const;

function AssetImage({
  src,
  alt,
  className,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#e8eaef] to-[#d9dce3] text-center",
          className
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--rr-muted)]">
          RobotRent Global
        </span>
        <span className="max-w-[12rem] px-4 text-sm text-[var(--rr-muted)]">
          Robot fotosurati (Figma asset kutilmoqda)
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-[var(--rr-surface)]", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className="object-cover object-center"
        sizes="(max-width: 768px) 100vw, 960px"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function RobotRentHeroImage({ className }: { className?: string }) {
  return (
    <AssetImage
      src={ROBOTRENT_ASSETS.heroRobot}
      alt="Yer yuvish roboti"
      className={cn("aspect-[4/3] w-full max-h-[420px] rounded-[var(--rr-radius-lg)]", className)}
      priority
    />
  );
}

export function RobotRentPartnerHero({ badge }: { badge: string }) {
  return (
    <div className="relative w-full">
      <AssetImage
        src={ROBOTRENT_ASSETS.partnerHero}
        alt=""
        className="aspect-[16/10] w-full rounded-none md:max-w-3xl md:rounded-[var(--rr-radius-lg)]"
      />
      <span className="absolute left-4 top-4 rounded-full bg-[var(--rr-primary)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
        {badge}
      </span>
    </div>
  );
}