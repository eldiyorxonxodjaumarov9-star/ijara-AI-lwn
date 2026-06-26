import type { Metadata } from "next";

import { LandlordPortal } from "@/components/landing/landlord-portal";

export const metadata: Metadata = {
  title: "Ijara egalari — Arenda AI",
  description:
    "Ijara egalari uchun shaxsiy profil: mulk ma'lumotlari, kontakt va boshqaruv kabineti.",
};

export default function IjaraEgalariPage() {
  return <LandlordPortal />;
}
