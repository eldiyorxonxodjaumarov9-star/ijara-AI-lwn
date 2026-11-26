import type { Metadata } from "next";

import { RobotRentTrackPanel } from "@/components/robotrent/robotrent-track-panel";

export const metadata: Metadata = {
  title: "Ariza holati",
};

export default function RobotRentTrackPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 lg:max-w-3xl lg:px-8">
      <h1 className="rr-serif mb-2 text-2xl font-semibold text-[var(--rr-text)]">
        Ariza holati
      </h1>
      <p className="mb-8 text-[var(--rr-muted)]">
        Ariza topshirganda berilgan tracking kodni kiriting.
      </p>
      <RobotRentTrackPanel />
    </div>
  );
}
