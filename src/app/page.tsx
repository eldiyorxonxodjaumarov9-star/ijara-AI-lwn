import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Ijara AI — AI-powered Property Management Platform",
  description:
    "Ijara biznesini bitta platformadan boshqaring: mulklar, to‘lovlar, qarzdorlik, xodimlar, vazifalar, TTLock kirish nazorati va AI tahlil.",
  openGraph: {
    title: "Ijara AI — Property Management Platform",
    description:
      "To‘lovlar, arendatorlar, xarajatlar, xodimlar, vazifalar, aqlli qulflar va AI tahlil — bitta tizimda.",
    type: "website",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
