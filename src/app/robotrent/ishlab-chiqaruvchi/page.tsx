import type { Metadata } from "next";

import { RobotRentApplicationForm } from "@/components/robotrent/robotrent-application-form";

export const metadata: Metadata = {
  title: "Ishlab chiqaruvchi",
};

export default function RobotRentManufacturerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">Ishlab chiqaruvchi</h1>
      <p className="mb-8 text-slate-400">
        Robotlaringizni oylik ijara modeli orqali O‘zbekiston bozoriga taklif
        qiling.
      </p>
      <RobotRentApplicationForm type="MANUFACTURER" />
    </div>
  );
}
