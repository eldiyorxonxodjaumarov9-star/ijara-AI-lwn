import { LandingAbout } from "@/components/landing/landing-about";
import { LandingAudience } from "@/components/landing/landing-audience";
import { LandingCallCenter } from "@/components/landing/landing-call-center";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingDashboardSection } from "@/components/landing/landing-dashboard-section";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060d18] text-white selection:bg-cyan-500/30">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingAbout />
        <LandingFeatures />
        <LandingAudience />
        <LandingDashboardSection />
        <LandingCallCenter />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
