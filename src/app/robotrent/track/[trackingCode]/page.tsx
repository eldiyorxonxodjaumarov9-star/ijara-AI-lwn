import type { Metadata } from "next";

import { RobotRentTrackPanel } from "@/components/robotrent/robotrent-track-panel";

export const metadata: Metadata = {
  title: "Ariza holati",
  robots: { index: false, follow: false },
};

export default async function RobotRentTrackCodePage({
  params,
}: {
  params: Promise<{ trackingCode: string }>;
}) {
  const { trackingCode } = await params;
  const code = decodeURIComponent(trackingCode);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">Ariza holati</h1>
      <p className="mb-8 text-slate-400">
        Tracking kod bo‘yicha arizangiz bosqichlarini kuzating.
      </p>
      <RobotRentTrackPanel initialCode={code} />
    </div>
  );
}
