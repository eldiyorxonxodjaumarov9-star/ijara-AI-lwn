import "@/components/landing/landing.css";

import { LandingAbout } from "@/components/landing/landing-about";
import { LandingAnalytics } from "@/components/landing/landing-analytics";
import { LandingAudience } from "@/components/landing/landing-audience";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingHow } from "@/components/landing/landing-how";
import { LandingHumanAi } from "@/components/landing/landing-human-ai";
import { LandingInspection } from "@/components/landing/landing-inspection";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingOs } from "@/components/landing/landing-os";
import { LandingProblems } from "@/components/landing/landing-problems";
import { LandingSmartLock } from "@/components/landing/landing-smart-lock";
import { LandingTelegram } from "@/components/landing/landing-telegram";
import { LandingTrust } from "@/components/landing/landing-trust";

export function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-white text-slate-900">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingTrust />
        <LandingProblems />
        <LandingOs />
        <LandingAnalytics />
        <LandingInspection />
        <LandingSmartLock />
        <LandingTelegram />
        <LandingAudience />
        <LandingHow />
        <LandingAbout />
        <LandingHumanAi />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
