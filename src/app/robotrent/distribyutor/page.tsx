import type { Metadata } from "next";

import { RobotRentApplicationForm } from "@/components/robotrent/robotrent-application-form";

export const metadata: Metadata = {
  title: "Distribyutor",
};

export default function RobotRentDistributorPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">Distribyutor</h1>
      <p className="mb-8 text-slate-400">
        Robot modellari va servis imkoniyatlaringiz bilan RobotRent hamkoriga
        aylaning.
      </p>
      <RobotRentApplicationForm type="DISTRIBUTOR" />
    </div>
  );
}
