"use client";

import { useEffect, useState } from "react";
import { BarChart3, Building2, Users } from "lucide-react";

import { getCrmReports } from "@/lib/landlord-crm";
import { formatUzs } from "@/lib/rental-search";

export function LandlordReportsTab({ refreshKey }: { refreshKey: number }) {
  const [reports, setReports] = useState(getCrmReports());

  useEffect(() => {
    setReports(getCrmReports());
  }, [refreshKey]);

  const cards = [
    {
      icon: Users,
      label: "Mijozlar",
      value: reports.totalClients,
      sub: `${reports.approvedClients} ta xabar`,
    },
    {
      icon: Building2,
      label: "E'lonlar",
      value: reports.totalListings,
      sub: `${reports.activeListings} faol · ${reports.rentedListings} ijarada`,
    },
    {
      icon: BarChart3,
      label: "Oylik potensial",
      value: formatUzs(reports.monthlyPotential),
      sub: "Faol e'lonlar summasi",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-white/5 p-5"
          >
            <card.icon className="size-5 text-cyan-400" />
            <p className="mt-3 text-sm text-slate-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="font-semibold">Qisqa xulosa</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>
            Qidiruv topilmagan:{" "}
            <span className="font-medium text-white">{reports.checkingClients}</span>
          </li>
          <li>
            Faol e&apos;lonlar:{" "}
            <span className="font-medium text-white">{reports.activeListings}</span>
          </li>
          <li>
            Ijaraga berilgan:{" "}
            <span className="font-medium text-white">{reports.rentedListings}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
