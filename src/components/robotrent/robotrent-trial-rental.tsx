import Image from "next/image";
import Link from "next/link";

import { ROBOTRENT_TRIAL_DAYS_DEFAULT } from "@/lib/robotrent/constants";

const CARDS = [
  {
    title: `${ROBOTRENT_TRIAL_DAYS_DEFAULT} kunlik sinov taklifi`,
    points: ["Robot modeli", "Sinov zonasi", "Boshlanish sanasi"],
    image: "/robotrent/hero-1.jpg",
  },
  {
    title: "Sinov hisoboti",
    points: ["Kunlik maydon", "Xodim aralashuvi", "Xarajat izohi"],
    image: "/robotrent/hero-9.jpg",
  },
  {
    title: "Oylik ijara taklifi",
    points: ["Oylik to‘lov", "Texnik servis", "Shartlar"],
    image: "/robotrent/hero-5.jpg",
  },
] as const;

export function RobotRentTrialRental() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <h1 className="rr-serif text-center text-3xl font-semibold text-[var(--rr-text)] md:text-4xl">
        Sinovdan ijaragacha
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--rr-muted)]">
        Ariza → robot tanlash → {ROBOTRENT_TRIAL_DAYS_DEFAULT} kunlik sinov → oylik ijara.
        Ma’lumot kiritilmagan maydonlarda “Ma’lumot kiritilmagan” ko‘rsatiladi.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {CARDS.map((c) => (
          <article key={c.title} className="rr-card flex flex-col p-0">
            <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-[var(--rr-border)] bg-[#e8e4dc]">
              <Image
                src={c.image}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 360px"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h2 className="rr-serif text-lg font-semibold">{c.title}</h2>
              <ul className="mt-4 space-y-2 text-sm text-[var(--rr-muted)]">
                {c.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden>◆</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/robotrent/mijoz" className="rr-btn">
          Sinovga ariza berish
        </Link>
        <Link
          href="/robotrent/track"
          className="inline-flex min-h-11 items-center border border-[var(--rr-border)] px-5 text-sm font-semibold"
        >
          Ariza holatini tekshirish
        </Link>
      </div>
    </div>
  );
}