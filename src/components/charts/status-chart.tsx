"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-4)",
  "var(--color-chart-3)",
];

const PREMIUM_COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#a78bfa"];

export function StatusChart({
  data,
  premium = false,
}: {
  data: { name: string; value: number }[];
  premium?: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colors = premium ? PREMIUM_COLORS : COLORS;
  const tipBg = premium ? "#0d1c34" : "var(--popover)";
  const tipBorder = premium
    ? "1px solid rgb(148 163 184 / 0.2)"
    : "1px solid var(--border)";
  const tipColor = premium ? "#e8eef8" : "var(--popover-foreground)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: tipBg,
                border: tipBorder,
                borderRadius: 12,
                fontSize: 12,
                color: tipColor,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={
              premium
                ? "text-2xl font-bold text-slate-50"
                : "text-2xl font-bold"
            }
          >
            {total}
          </span>
          <span
            className={
              premium
                ? "text-xs text-slate-400"
                : "text-xs text-muted-foreground"
            }
          >
            Jami mulk
          </span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-full"
              style={{ background: colors[index % colors.length] }}
            />
            <span
              className={
                premium ? "text-slate-400" : "text-muted-foreground"
              }
            >
              {item.name}
            </span>
            <span
              className={
                premium
                  ? "ml-auto font-medium text-slate-100"
                  : "ml-auto font-medium"
              }
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
