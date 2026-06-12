"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatMoney } from "@/lib/money";
import { useChartTheme } from "@/lib/chart-theme";

interface ChartData {
  date: string;
  revenue: number;
  count: number;
}

export function RevenueChart({ data }: { data: ChartData[] }) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#133157" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#133157" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2E7CC2" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#2E7CC2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke={ct.grid}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: ct.axisTick }}
          tickLine={false}
          axisLine={{ stroke: ct.axisLine }}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 11, fill: ct.axisTick }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: "#2E7CC2", strokeWidth: 1, strokeDasharray: "4 4" }}
          contentStyle={ct.tooltipContentStyle}
          labelStyle={ct.tooltipLabelStyle}
          formatter={(val: number, name: string) => [
            name === "revenue" ? formatMoney(val) : val,
            name === "revenue" ? "Revenue" : "Appointments",
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={9}
          wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 8 }}
          formatter={(val) => (
            <span style={{ color: "#64748B" }}>
              {val === "revenue" ? "Revenue" : "Appointments"}
            </span>
          )}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#133157"
          strokeWidth={2.5}
          fill="url(#colorRevenue)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: ct.dotStroke }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#2E7CC2"
          strokeWidth={2.5}
          fill="url(#colorCount)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: ct.dotStroke }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
