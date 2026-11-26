import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  FileSignature,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROBOTRENT_TRIAL_DAYS_DEFAULT } from "@/lib/robotrent/constants";

const TRIAL_POINTS = [
  {
    icon: CalendarCheck,
    title: `${ROBOTRENT_TRIAL_DAYS_DEFAULT} kunlik sinov`,
    text: "Robot sizning obyektingizda real sharoitda ishlaydi. Sinov zonasi va boshlanish sanasi oldindan kelishiladi.",
  },
  {
    icon: BarChart3,
    title: "Kunlik natijalar",
    text: "Kunlik tozalangan maydon va hisobot xulosasi ariza sahifasida ko‘rinadi.",
  },
  {
    icon: Wallet,
    title: "Shaffof xarajat",
    text: "Kunlik narx va xarajat izohlari sinov boshlanishidan oldin aniq ko‘rsatiladi.",
  },
  {
    icon: FileSignature,
    title: "Oylik ijaraga o‘tish",
    text: "Natija mos kelsa, oylik to‘lov va shartlar bilan ijara taklifi beriladi. Mos kelmasa — majburiyat yo‘q.",
  },
];

export function RobotRentTrialRental() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white sm:text-4xl">
        Sinovdan ijaraga
      </h1>
      <p className="mt-3 max-w-2xl text-slate-300">
        Avval {ROBOTRENT_TRIAL_DAYS_DEFAULT} kun davomida robotni sinab ko‘ring,
        so‘ng qaror qiling. Har bir bosqich tracking kod orqali kuzatiladi.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {TRIAL_POINTS.map((p) => (
          <div key={p.title} className="robotrent-card p-6">
            <span className="flex size-11 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
              <p.icon className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-white">{p.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{p.text}</p>
          </div>
        ))}
      </div>

      <div className="robotrent-card mt-10 p-6">
        <h2 className="text-lg font-semibold text-white">
          Jarayon qanday kechadi?
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>Mijoz sifatida ariza qoldirasiz va tracking kod olasiz.</li>
          <li>Mutaxassis obyektni tekshiradi (Obyektni tekshirish).</li>
          <li>
            {ROBOTRENT_TRIAL_DAYS_DEFAULT} kunlik sinov taklifi kelishiladi
            (Sinov taklifi).
          </li>
          <li>
            Sinov yakunida oylik ijara taklifi beriladi (Oylik ijara). Holatni{" "}
            <Link
              href="/robotrent/track"
              className="font-medium text-cyan-300 hover:underline"
            >
              tracking sahifasida
            </Link>{" "}
            ko‘rasiz.
          </li>
        </ol>
      </div>

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
          <Link href="/robotrent/track">Ariza holatini tekshirish</Link>
        </Button>
      </div>
    </div>
  );
}
