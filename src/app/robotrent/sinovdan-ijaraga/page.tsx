import type { Metadata } from "next";

import { RobotRentTrialRental } from "@/components/robotrent/robotrent-trial-rental";

export const metadata: Metadata = {
  title: "Sinovdan ijaraga",
};

export default function RobotRentTrialRentalPage() {
  return <RobotRentTrialRental />;
}
