import { RobotRentApplicationForm, type RobotRentFormType } from "@/components/robotrent/robotrent-application-form";
import { RobotRentPartnerHero } from "@/components/robotrent/robotrent-media";
import { FORM_TITLES, PARTNER_BADGES } from "@/lib/robotrent/form-fields";

export function RobotRentPartnerPage({
  type,
  robotSlug,
}: {
  type: RobotRentFormType;
  robotSlug?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-0 lg:max-w-6xl lg:px-8 lg:py-12">
      {/* Mobile: image → form stack. Desktop: side-by-side balanced columns */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-24">
          <RobotRentPartnerHero badge={PARTNER_BADGES[type]} />
        </div>

        <div className="px-4 py-6 lg:border lg:border-[var(--rr-border)] lg:bg-white lg:px-8 lg:py-8">
          <h1 className="rr-serif text-2xl font-semibold text-[var(--rr-text)] lg:text-[1.75rem]">
            {FORM_TITLES[type].mobile}
          </h1>
          <div className="mt-6">
            <RobotRentApplicationForm type={type} robotSlug={robotSlug} embedded />
          </div>
        </div>
      </div>
    </div>
  );
}
