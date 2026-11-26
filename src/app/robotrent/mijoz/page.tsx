import type { Metadata } from "next";

import { RobotRentApplicationForm } from "@/components/robotrent/robotrent-application-form";

export const metadata: Metadata = {
  title: "Mijoz — sinovga ariza",
};

export default async function RobotRentCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ robot?: string | string[] }>;
}) {
  const { robot } = await searchParams;
  const robotSlug = (Array.isArray(robot) ? robot[0] : robot)?.slice(0, 120);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">Mijoz</h1>
      <p className="mb-8 text-slate-400">
        Obyektingiz haqida ma’lumot qoldiring — robotni 14 kun sinab ko‘rishni
        tashkil qilamiz.
      </p>
      <RobotRentApplicationForm type="CUSTOMER" robotSlug={robotSlug} />
    </div>
  );
}
