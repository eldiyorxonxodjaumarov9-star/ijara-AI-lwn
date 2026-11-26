import type { Metadata } from "next";

import { RobotRentCatalog } from "@/components/robotrent/robotrent-catalog";

export const metadata: Metadata = {
  title: "Katalog",
};

export default function RobotRentCatalogPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <h1 className="rr-serif mb-2 text-2xl font-semibold text-[var(--rr-text)] md:text-3xl">
        Robotlar katalogi
      </h1>
      <p className="mb-8 text-[var(--rr-muted)]">
        Obyektingiz uchun mos robotni tanlang va 14 kunlik sinovga ariza
        qoldiring.
      </p>
      <RobotRentCatalog />
    </div>
  );
}
