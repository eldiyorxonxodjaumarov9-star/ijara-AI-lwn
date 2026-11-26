import type { Metadata } from "next";

import { RobotRentPartnerPage } from "@/components/robotrent/robotrent-partner-page";

export const metadata: Metadata = {
  title: "Distribyutor | RobotRent Global",
};

export default function RobotRentDistributorPage() {
  return <RobotRentPartnerPage type="DISTRIBUTOR" />;
}