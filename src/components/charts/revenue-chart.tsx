"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/utils";
import type { RevenuePoint } from "@/lib/analytics";

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function RevenueChart({
  data,
  premium = false,
}: {
  data: RevenuePoint[];
  premium?: boolean;
}) {
  const grid = premium ? "rgb(148 163 184 / 0.12)" : "var(--border)";
  const tick = premium ? "#94a3b8" : "var(--muted-foreground)";
  const income = premium ? "#34d399" : "var(--color-chart-1)";
  const expense = premium ? "#fb7185" : "var(--color-chart-4)";
  const tipBg = premium ? "#0d1c34" : "var(--popover)";
  const tipColor = premium ? "#e8eef8" : "var(--popover-foreground)";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={income} stopOpacity={0.35} />
            <stop offset="95%" stopColor={income} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={expense} stopOpacity={0.3} />
            <stop offset="95%" stopColor={expense} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke={tick}
        />
        <YAxis
          tickFormatter={compact}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={42}
          stroke={tick}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            background: tipBg,
            border: premium
              ? "1px solid rgb(148 163 184 / 0.2)"
              : "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
            color: tipColor,
          }}
        />
        <Area
          type="monotone"
          dataKey="daromad"
          name="Daromad"
          stroke={income}
          strokeWidth={2}
          fill="url(#fillRevenue)"
        />
        <Area
          type="monotone"
          dataKey="xarajat"
          name="Xarajat"
          stroke={expense}
          strokeWidth={2}
          fill="url(#fillExpense)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
