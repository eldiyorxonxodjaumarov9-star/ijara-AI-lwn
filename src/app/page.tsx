import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Arenda AI — O'zbekistondagi ijara va ko'chmas mulk bozori uchun aqlli AI platforma",
  description:
    "Uy, ofis, do'kon, ombor, yer maydoni va boshqa ko'chmas mulklarni tez topish, joylashtirish va boshqarish uchun zamonaviy AI yechim.",
  openGraph: {
    title: "Arenda AI",
    description:
      "O'zbekistondagi ijara va ko'chmas mulk bozori uchun aqlli AI platforma",
    type: "website",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
