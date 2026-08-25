import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useBooking } from "../context/BookingContext";
import { useTheme } from "../context/ThemeContext";

const getEventDate = (b: any): Date => {
  if (b.date) {
    const d = new Date(`${b.date}T12:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  if (b.event_date) {
    const d = new Date(`${b.event_date}T12:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  if (b.created_at) {
    const d = new Date(b.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

/**
 * Visualizes projected revenue over time using an AreaChart.
 * Allows filtering by year.
 */
export function RevenueChart() {
  const { bookings } = useBooking();
  const { resolvedTheme } = useTheme();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const availableYears = useMemo(() => {
    const years = bookings.map((b) => getEventDate(b).getFullYear());
    return Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a);
  }, [bookings, currentYear]);

  const data = useMemo(() => {
    const confirmedBookings = bookings.filter((b) => b.status === "Confirmed");
    const yearBookings = confirmedBookings.filter((b) => {
      return getEventDate(b).getFullYear().toString() === selectedYear;
    });

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return months.map((month, index) => {
      const monthBookings = yearBookings.filter((b) => {
        return getEventDate(b).getMonth() === index;
      });
      return {
        name: month,
        value: monthBookings.reduce((sum, b) => sum + (Number(b.budget) || 0), 0),
        count: monthBookings.length,
      };
    });
  }, [bookings, selectedYear]);

  const hasData = data.some((d) => d.value > 0);
  const accentColorHex = resolvedTheme === "dark" ? "#c4a96e" : "#a68a56";
  const gridStroke = resolvedTheme === "dark" ? "#2e3028" : "#E8E7E0";
  const tickColor = resolvedTheme === "dark" ? "#9e9f96" : "#8a8b82";

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif">
            Monthly Revenue Overview
          </h3>
          <p className="text-[0.7rem] text-natural-text-light font-medium uppercase tracking-wider">
            Revenue trends for {selectedYear}
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="text-[0.7rem] border border-natural-border rounded-lg px-2.5 py-1.5 bg-natural-bg font-bold text-natural-text-main outline-none uppercase tracking-wider cursor-pointer hover:bg-natural-bg/80 transition-colors"
        >
          {availableYears.map((year) => (
            <option key={year} value={year.toString()}>
              Year {year}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full flex-1 min-h-[300px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColorHex} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={accentColorHex} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridStroke}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 10, fontWeight: 600 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 10, fontWeight: 600 }}
                tickFormatter={(value) => `₱${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
              />
              <Tooltip
                formatter={(value: any, name: any, item: any) => [
                  `₱${Number(value || 0).toLocaleString()} (${item?.payload?.count || 0} Events)`,
                  "Revenue",
                ]}
                contentStyle={{
                  backgroundColor: resolvedTheme === "dark" ? "#1c1d18" : "#ffffff",
                  borderRadius: "10px",
                  border: `1px solid ${gridStroke}`,
                  boxShadow: resolvedTheme === "dark" ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 14px rgba(0,0,0,0.06)",
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  color: resolvedTheme === "dark" ? "#f3f3ee" : "#2d2e2a",
                }}
                itemStyle={{
                  color: accentColorHex,
                }}
                labelStyle={{
                  color: resolvedTheme === "dark" ? "#9e9f96" : "#8a8b82",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColorHex}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-natural-border rounded-xl bg-natural-bg/10 min-h-[260px]">
            <p className="text-xs text-natural-text-light font-serif italic">
              No confirmed event revenue recorded for {selectedYear}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
