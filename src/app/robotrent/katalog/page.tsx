import type { Metadata } from "next";

import { RobotRentCatalog } from "@/components/robotrent/robotrent-catalog";

export const metadata: Metadata = {
  title: "Katalog",
};

export default function RobotRentCatalogPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">Robotlar katalogi</h1>
      <p className="mb-8 text-slate-400">
        Obyektingiz uchun mos robotni tanlang va 14 kunlik sinovga ariza
        qoldiring.
      </p>
      <RobotRentCatalog />
    </div>
  );
}
