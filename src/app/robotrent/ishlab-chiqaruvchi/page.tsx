import type { Metadata } from "next";

import { RobotRentPartnerPage } from "@/components/robotrent/robotrent-partner-page";

export const metadata: Metadata = {
  title: "Ishlab chiqaruvchi | RobotRent Global",
};

export default function RobotRentManufacturerPage() {
  return <RobotRentPartnerPage type="MANUFACTURER" />;
}