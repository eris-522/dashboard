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

/**
 * Visualizes projected revenue over time using an AreaChart.
 * Allows filtering by year (currently static in UI).
 */
export function RevenueChart() {
  const { bookings } = useBooking();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const availableYears = useMemo(() => {
    const years = bookings.map((b) => {
      const d = b.created_at ? new Date(b.created_at) : new Date(b.date);
      return d.getFullYear();
    });
    return Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a);
  }, [bookings, currentYear]);

  const data = useMemo(() => {
    const confirmedBookings = bookings.filter((b) => b.status === "Confirmed");
    const yearBookings = confirmedBookings.filter((b) => {
      const targetDate = b.created_at
        ? new Date(b.created_at)
        : new Date(b.date);
      return targetDate.getFullYear().toString() === selectedYear;
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
        const date = new Date(b.date);
        return date.getMonth() === index;
      });
      return {
        name: month,
        value: monthBookings.reduce((sum, b) => sum + b.budget, 0),
      };
    });
  }, [bookings, selectedYear]);

  const hasData = data.some((d) => d.value > 0);

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
          className="text-[0.7rem] border border-natural-border rounded-lg px-2 py-1 bg-natural-bg font-semibold text-natural-text-main outline-none uppercase tracking-wider cursor-pointer hover:bg-natural-bg/80 transition-colors"
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
                  <stop offset="5%" stopColor="#a68a56" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#a68a56" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E8E7E0"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8a8b82", fontSize: 10, fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8a8b82", fontSize: 10, fontWeight: 500 }}
                tickFormatter={(value) => `₱${value / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #E8E7E0",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                  fontSize: "11px",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#a68a56"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-natural-border rounded-xl bg-natural-bg/10">
            <p className="text-xs text-natural-text-light italic">
              Insufficient data to generate revenue trends
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
