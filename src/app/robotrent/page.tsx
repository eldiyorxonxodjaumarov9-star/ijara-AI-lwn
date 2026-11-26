import type { Metadata } from "next";

import { RobotRentHome } from "@/components/robotrent/robotrent-home";

export const metadata: Metadata = {
  title: "Robotni obyektingizda sinab ko‘ring",
};

export default function RobotRentPage() {
  return <RobotRentHome />;
}
