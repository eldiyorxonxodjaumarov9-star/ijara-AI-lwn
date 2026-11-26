import type { Metadata } from "next";

import { RobotRentTrackPanel } from "@/components/robotrent/robotrent-track-panel";

export const metadata: Metadata = {
  title: "Ariza holati",
};

export default function RobotRentTrackPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">Ariza holati</h1>
      <p className="mb-8 text-slate-400">
        Ariza topshirganda berilgan tracking kodni kiriting.
      </p>
      <RobotRentTrackPanel />
    </div>
  );
}
