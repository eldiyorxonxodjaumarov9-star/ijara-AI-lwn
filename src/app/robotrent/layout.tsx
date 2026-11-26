import type { Metadata } from "next";
import type { ReactNode } from "react";

import { RobotRentShell } from "@/components/robotrent/robotrent-shell";

export const metadata: Metadata = {
  title: {
    default: "RobotRent Global",
    template: "%s | RobotRent Global",
  },
  description:
    "RobotRent Global — tozalash robotlarini obyektingizda 14 kun sinab ko‘ring, so‘ng oylik ijaraga o‘ting.",
};

export default function RobotRentLayout({ children }: { children: ReactNode }) {
  return <RobotRentShell>{children}</RobotRentShell>;
}
