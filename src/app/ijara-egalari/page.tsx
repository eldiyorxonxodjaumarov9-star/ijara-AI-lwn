import type { Metadata } from "next";

import { LandlordPortal } from "@/components/landing/landlord-portal";

export const metadata: Metadata = {
  title: "Arenda CRM — Ijara egalari platformasi",
  description:
    "AI-powered rental management CRM: mulklar, mijozlar, bronlash, reklama, to'lovlar va hisobotlar.",
};

export default function IjaraEgalariPage() {
  return <LandlordPortal />;
}
