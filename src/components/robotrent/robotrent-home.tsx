import Image from "next/image";
import Link from "next/link";
import { Factory, Store, UserRound } from "lucide-react";

const CARDS = [
  {
    title: "Mijoz",
    href: "/robotrent/mijoz",
    cta: "Sinovga ariza berish",
    icon: UserRound,
  },
  {
    title: "Distribyutor",
    href: "/robotrent/distribyutor",
    cta: "Robot taklif qilish",
    icon: Store,
  },
  {
    title: "Ishlab chiqaruvchi",
    href: "/robotrent/ishlab-chiqaruvchi",
    cta: "Hamkorlikka ariza berish",
    icon: Factory,
  },
] as const;

export function RobotRentHome() {
  return (
    <div>
      {/* Mobile: stacked. Desktop lg+: left copy, right large photo */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-16">
        <div className="order-1">
          <h1 className="rr-serif text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-[var(--rr-text)] lg:text-[2.85rem]">
            Robotni obyektingizda sinab ko‘ring
          </h1>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-[var(--rr-muted)] lg:text-base">
            14 kunlik pulli sinov. Natija asosida oylik ijara.
          </p>
          <Link href="/robotrent/mijoz" className="rr-btn mt-6">
            Sinovga ariza berish
          </Link>
        </div>

        <div className="relative order-2 aspect-square w-full overflow-hidden border border-[var(--rr-border)] bg-[#e8e4dc] lg:aspect-[5/4]">
          <Image
            src="/robotrent/hero-mobile.jpg"
            alt="RobotRent Global tozalash roboti"
            fill
            priority
            className="object-cover object-center lg:hidden"
            sizes="100vw"
          />
          <Image
            src="/robotrent/hero-desktop.jpg"
            alt="RobotRent Global tozalash roboti"
            fill
            priority
            className="hidden object-cover object-center lg:block"
            sizes="(min-width: 1024px) 560px, 100vw"
          />
        </div>
      </section>

      <section
        id="qanday-ishlaydi"
        className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-3 lg:gap-5 lg:px-8 lg:pb-14"
      >
        {CARDS.map((c) => (
          <article key={c.title} className="rr-card flex flex-col">
            <c.icon className="size-6 text-[var(--rr-text)]" strokeWidth={1.5} />
            <h2 className="mt-4 text-lg font-semibold text-[var(--rr-text)]">{c.title}</h2>
            <Link href={c.href} className="rr-btn mt-6 w-full lg:mt-auto">
              {c.cta}
            </Link>
          </article>
        ))}
      </section>

      <div className="rr-process">
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-sm font-medium tracking-wide text-[var(--rr-text)] lg:px-8 lg:text-base">
          Ariza → Robot tanlash → 14 kunlik sinov → Oylik ijara
        </p>
      </div>
    </div>
  );
}
