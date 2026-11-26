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
    <div className="mx-auto w-full max-w-lg md:max-w-3xl">
      <RobotRentPartnerHero badge={PARTNER_BADGES[type]} />
      <div className="px-4 py-6 md:px-0 md:py-10">
        <h1 className="text-2xl font-bold text-[var(--rr-text)] md:hidden">
          {FORM_TITLES[type].mobile}
        </h1>
        <div className="robotrent-form-panel robotrent-card mt-6 md:mt-0 md:p-8">
          <h1 className="mb-6 hidden text-2xl font-bold text-[var(--rr-text)] md:block">
            {FORM_TITLES[type].desktop}
          </h1>
          <RobotRentApplicationForm type={type} robotSlug={robotSlug} embedded />
        </div>
      </div>
    </div>
  );
}