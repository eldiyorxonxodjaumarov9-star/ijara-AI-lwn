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
    <div className="mx-auto w-full max-w-lg md:max-w-3xl md:px-8 md:py-10">
      <RobotRentPartnerHero badge={PARTNER_BADGES[type]} />
      <div className="px-4 py-6 md:border md:border-[var(--rr-border)] md:bg-white md:px-8 md:py-8">
        <h1 className="rr-serif text-2xl font-semibold text-[var(--rr-text)]">
          {FORM_TITLES[type].mobile}
        </h1>
        <div className="mt-6">
          <RobotRentApplicationForm type={type} robotSlug={robotSlug} embedded />
        </div>
      </div>
    </div>
  );
}