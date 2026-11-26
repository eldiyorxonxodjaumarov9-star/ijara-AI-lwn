import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Factory,
  FileSignature,
  Handshake,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ROBOTRENT_BRAND,
  ROBOTRENT_STATUS_LABELS,
  ROBOTRENT_STATUS_ORDER,
  ROBOTRENT_TRIAL_DAYS_DEFAULT,
} from "@/lib/robotrent/constants";

const PARTNERS = [
  {
    icon: Building2,
    title: "Mijoz",
    text: "Ofis, ombor, savdo markazi yoki zavod uchun robotni 14 kun sinab ko‘ring.",
    href: "/robotrent/mijoz",
    cta: "Ariza qoldirish",
  },
  {
    icon: Truck,
    title: "Distribyutor",
    text: "Robot modellaringiz va xizmat ko‘rsatish imkoniyatlaringiz bilan hamkor bo‘ling.",
    href: "/robotrent/distribyutor",
    cta: "Hamkor bo‘lish",
  },
  {
    icon: Factory,
    title: "Ishlab chiqaruvchi",
    text: "Robotlaringizni O‘zbekiston bozoriga oylik ijara modeli orqali olib kiring.",
    href: "/robotrent/ishlab-chiqaruvchi",
    cta: "Taklif yuborish",
  },
];

const STEPS = [
  {
    icon: Search,
    title: "Robotni tanlang",
    text: "Katalogdan obyektingiz uchun mos robot modelini tanlang.",
  },
  {
    icon: ClipboardCheck,
    title: "Ariza qoldiring",
    text: "Obyekt, maydon va boshlanish sanasi haqida qisqa ma’lumot yuboring.",
  },
  {
    icon: CalendarCheck,
    title: `${ROBOTRENT_TRIAL_DAYS_DEFAULT} kunlik sinov`,
    text: "Robot obyektingizda ishlaydi, kunlik natijalar hisobotga yoziladi.",
  },
  {
    icon: FileSignature,
    title: "Oylik ijara",
    text: "Natijadan mamnun bo‘lsangiz, oylik ijara shartnomasiga o‘ting.",
  },
];

const STAGE_HINTS: Record<string, string> = {
  RECEIVED: "Arizangiz tizimga tushdi va tracking kod berildi.",
  SITE_INSPECTION: "Mutaxassis obyektni ko‘zdan kechiradi.",
  TRIAL_OFFER: "Sinov muddati, zona va narx kelishiladi.",
  MONTHLY_RENTAL: "Oylik ijara taklifi va shartlar tasdiqlanadi.",
};

export function RobotRentHome() {
  return (
    <div>
      {/* Hero */}
      <section className="robotrent-glow relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              <Bot className="size-3.5" />
              {ROBOTRENT_BRAND}
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Robotni obyektingizda sinab ko‘ring
            </h1>
            <p className="mt-5 text-lg text-slate-300">
              {ROBOTRENT_TRIAL_DAYS_DEFAULT} kunlik sinov muddati: robot sizning
              obyektingizda ishlaydi, natijani o‘zingiz ko‘rasiz. Mos kelsa —
              oylik ijaraga o‘tasiz.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-cyan-400 text-[#071429] hover:bg-cyan-300"
              >
                <Link href="/robotrent/mijoz">
                  Sinovga ariza berish
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/robotrent/katalog">Katalogni ko‘rish</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 text-sm">
              <div className="robotrent-card p-4">
                <dt className="text-slate-400">Sinov</dt>
                <dd className="mt-1 text-xl font-semibold text-cyan-300">
                  {ROBOTRENT_TRIAL_DAYS_DEFAULT} kun
                </dd>
              </div>
              <div className="robotrent-card p-4">
                <dt className="text-slate-400">Ijara</dt>
                <dd className="mt-1 text-xl font-semibold text-cyan-300">
                  Oylik
                </dd>
              </div>
              <div className="robotrent-card p-4">
                <dt className="text-slate-400">Kuzatuv</dt>
                <dd className="mt-1 text-xl font-semibold text-cyan-300">
                  Online
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Partner cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Kim uchun?
        </h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          Mijoz, distribyutor yoki ishlab chiqaruvchi sifatida platformaga
          qo‘shiling.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PARTNERS.map((p) => (
            <div key={p.title} className="robotrent-card flex flex-col p-6">
              <span className="flex size-11 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <p.icon className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {p.title}
              </h3>
              <p className="mt-2 flex-1 text-sm text-slate-400">{p.text}</p>
              <Link
                href={p.href}
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                {p.cta}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/10 bg-[#0b1d3a]/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Qanday ishlaydi?
          </h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="robotrent-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-[#071429]">
                    {i + 1}
                  </span>
                  <s.icon className="size-5 text-cyan-300" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rental stages */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Ijara bosqichlari
        </h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          Arizangiz har bir bosqichda{" "}
          <Link
            href="/robotrent/track"
            className="font-medium text-cyan-300 hover:underline"
          >
            tracking kod
          </Link>{" "}
          orqali kuzatiladi.
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {ROBOTRENT_STATUS_ORDER.map((status, i) => (
            <li
              key={status}
              className="robotrent-card relative p-5"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                {i + 1}-bosqich
              </span>
              <h3 className="mt-2 font-semibold text-white">
                {ROBOTRENT_STATUS_LABELS[status]}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {STAGE_HINTS[status]}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            asChild
            className="bg-cyan-400 text-[#071429] hover:bg-cyan-300"
          >
            <Link href="/robotrent/sinovdan-ijaraga">
              Sinovdan ijaraga o‘tish
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/robotrent/track">Ariza holatini tekshirish</Link>
          </Button>
        </div>
      </section>

      {/* Ijara AI link */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="robotrent-card flex flex-col gap-5 p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <ShieldCheck className="size-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">
                Ko‘chmas mulk ijarasini boshqarasizmi?
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Ijara AI — mulklar, to‘lovlar va shartnomalarni bitta tizimda
                boshqaring.
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-cyan-300/40 bg-transparent text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200"
          >
            <Link href="/">
              <Handshake />
              Ijara AI ga o‘tish
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
