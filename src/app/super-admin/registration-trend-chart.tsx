"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDateKeyShort } from "@/lib/super-admin-dashboard";

export function RegistrationTrendChart({ data }: { data: { date: string; count: number }[] }) {
  const points = data.map((d) => ({ ...d, label: formatDateKeyShort(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={points} margin={{ left: -16, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="rgb(148 163 184 / 0.15)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} stroke="#94a3b8" />
        <Tooltip
          cursor={{ fill: "rgb(56 189 248 / 0.08)" }}
          formatter={(value) => [String(value), "Registratsiya"]}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            background: "#0c1c34",
            border: "1px solid rgb(148 163 184 / 0.25)",
            borderRadius: 12,
            fontSize: 12,
            color: "#e2e8f0",
          }}
        />
        <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
