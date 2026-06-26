import type { Metadata } from "next";

import { IjaraQidiruvPortal } from "@/components/landing/ijara-qidiruv-portal";

export const metadata: Metadata = {
  title: "Ijara qidiruv — Arenda AI",
  description:
    "Arendatorlar uchun ijara qidiruv: forma to'ldiring, e'lonlarni ko'ring va ijara egasiga xabar yuboring.",
};

export default function IjaraQidiruvPage() {
  return <IjaraQidiruvPortal />;
}
