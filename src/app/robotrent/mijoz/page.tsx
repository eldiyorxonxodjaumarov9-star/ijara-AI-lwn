import type { Metadata } from "next";

import { RobotRentPartnerPage } from "@/components/robotrent/robotrent-partner-page";

export const metadata: Metadata = {
  title: "Mijoz — sinovga ariza | RobotRent Global",
};

export default async function RobotRentCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ robot?: string | string[] }>;
}) {
  const { robot } = await searchParams;
  const robotSlug = (Array.isArray(robot) ? robot[0] : robot)?.slice(0, 120);

  return <RobotRentPartnerPage type="CUSTOMER" robotSlug={robotSlug} />;
}