import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Info,
  ChevronDown,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useBooking } from "../context/BookingContext";
import { useInventory } from "../context/InventoryContext";
import { useUser } from "../context/UserContext";

export function AnalyticsPage() {
  const { bookings } = useBooking();
  const { items } = useInventory();
  const { users, activeUserCount } = useUser();

  const currentYear = new Date().getFullYear();
  const [timeRange, setTimeRange] = useState(currentYear.toString());

  const availableYears = Array.from(
    new Set([
      currentYear,
      ...bookings.map((b) => {
        const d = b.created_at ? new Date(b.created_at) : new Date(b.date);
        return d.getFullYear();
      }),
    ]),
  ).sort((a, b) => b - a);

  const filteredBookings = bookings.filter((b) => {
    if (timeRange === "all") return true;
    const targetDate = b.created_at ? new Date(b.created_at) : new Date(b.date);
    return targetDate.getFullYear().toString() === timeRange;
  });

  /**
   * Revenue Tracking & Metric Computations:
   * Calculates Total Revenue, Average Event Value, and Conversion Rate from live confirmed booking data.
   */
  const nonArchivedBookings = filteredBookings.filter(
    (b) => b.status !== "Archived",
  );
  const confirmedBookings = filteredBookings.filter(
    (b) => b.status === "Confirmed",
  );
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.budget, 0);
  const avgEventValue =
    confirmedBookings.length > 0 ? totalRevenue / confirmedBookings.length : 0;
  const conversionRate =
    nonArchivedBookings.length > 0
      ? (confirmedBookings.length / nonArchivedBookings.length) * 100
      : 0;

  /**
   * Data Visualization:
   * Maps confirmed booking data monthly to generate a Bar Chart representation.
   */
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
  const monthlyData = months.map((month, index) => {
    const monthBookings = confirmedBookings.filter((b) => {
      const date = new Date(b.date);
      return date.getMonth() === index;
    });
    return {
      name: month,
      total: monthBookings.reduce((sum, b) => sum + b.budget, 0),
      count: monthBookings.length,
    };
  });

  /**
   * Cross-Module Tracking:
   * Flags Low Stock inventory items directly on the dashboard.
   */
  const lowStockCount = items.filter(
    (i) => i.status !== "Healthy" && i.status !== "Archived",
  ).length;

  const inventoryData = [
    {
      name: "Healthy",
      value: items.filter((i) => i.status === "Healthy").length,
      color: "#6b8e23",
    },
    {
      name: "Low Stock",
      value: items.filter((i) => i.status === "Low Stock").length,
      color: "#fb923c",
    },
    {
      name: "Critical",
      value: items.filter((i) => i.status === "Critical").length,
      color: "#ef4444",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Business Analytics ({timeRange === "all" ? "All Time" : timeRange})
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Historical & real-time performance data
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative inline-block">
            <Filter className="w-3.5 h-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-natural-text-main pointer-events-none" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2.5 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-transparent hover:bg-natural-bg transition-all uppercase tracking-widest outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              {availableYears.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-natural-text-main pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Insight Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "Total Revenue",
            value: `₱${totalRevenue.toLocaleString()}`,
            trend: `${confirmedBookings.length} Confirmed`,
            icon: DollarSign,
          },
          {
            label: "Avg. Event Value",
            value: `₱${Math.round(avgEventValue).toLocaleString()}`,
            trend: `${confirmedBookings.length} Events`,
            icon: TrendingUp,
          },
          {
            label: "Conversion Rate",
            value: `${conversionRate.toFixed(1)}%`,
            trend: `${nonArchivedBookings.length} Total`,
            icon: Users,
            tooltip:
              "Calculated as Confirmed Bookings divided by Total Non-Archived Bookings.",
          },
          {
            label: "Inventory Alerts",
            value: lowStockCount.toString(),
            trend: "Needs Action",
            icon: Calendar,
          },
        ].map((s, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3 text-natural-text-light relative">
              <div className="flex items-center gap-1.5 group/tooltip">
                <span className="text-[0.65rem] font-bold uppercase tracking-widest">
                  {s.label}
                </span>
                {s.tooltip && (
                  <>
                    <Info className="w-3.5 h-3.5 opacity-50 cursor-help hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2.5 bg-white border border-natural-border text-[0.65rem] leading-relaxed text-natural-text-main text-left rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 shadow-xl pointer-events-none normal-case tracking-normal">
                      {s.tooltip}
                    </div>
                  </>
                )}
              </div>
              <s.icon className="w-4 h-4 opacity-40" />
            </div>
            <h4 className="text-xl font-bold font-serif text-natural-text-main mb-1">
              {s.value}
            </h4>
            <span
              className={cn("text-[0.65rem] font-bold text-natural-accent")}
            >
              {s.trend}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full">
        {/* Monthly Traffic/Revenue */}
        <div className="glass-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg text-natural-text-main">
              Monthly Revenue Distribution
            </h3>
            <div className="flex gap-2 text-[0.6rem] font-bold text-natural-text-light uppercase">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-natural-accent rounded-full" />{" "}
                Revenue (PHP)
              </span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E8E7E0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a8b82", fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a8b82", fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ fill: "#f8f7f2" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E8E7E0",
                  }}
                />
                <Bar dataKey="total" fill="#a68a56" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Stats */}
        <div className="glass-card p-6">
          <h3 className="font-serif font-bold text-lg text-natural-text-main mb-6">
            Account Overview
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-natural-bg/20 rounded-xl border border-natural-border text-center">
              <span className="text-2xl font-bold font-serif text-natural-accent">
                {users.filter((u) => u.id !== 0).length}
              </span>
              <p className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest mt-1">
                Total Registered Users
              </p>
            </div>
            <div className="p-4 bg-natural-bg/20 rounded-xl border border-natural-border text-center">
              <span className="text-2xl font-bold font-serif text-natural-accent">
                {activeUserCount ??
                  users.filter((u) => u.id !== 0 && u.status === "Active")
                    .length}
              </span>
              <p className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest mt-1">
                Active Accounts
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[
              {
                label: "Customers",
                count: users.filter((u) => u.role === "Customer").length,
                color: "#a68a56",
              },
              {
                label: "Owners",
                count: users.filter((u) => u.role === "Owner").length,
                color: "#8a8b82",
              },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs font-medium text-natural-text-main">
                  {r.label}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-natural-bg rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${(r.count / (users.length || 1)) * 100}%`,
                        backgroundColor: r.color,
                      }}
                    />
                  </div>
                  <span className="text-[0.65rem] font-bold text-natural-text-main">
                    {r.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Growth Forecast */}
        <div className="glass-card p-6">
          <h3 className="font-serif font-bold text-lg text-natural-text-main mb-6">
            Inventory Health
          </h3>
          <div className="h-[200px] w-full relative flex items-center justify-center border-2 border-dashed border-natural-border rounded-xl bg-natural-bg/20 p-2">
            {items.filter((i) => i.status !== "Archived").length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {inventoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #E8E7E0",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "#3d4035", fontWeight: "bold" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold font-serif text-natural-text-main">
                    {items.filter((i) => i.status !== "Archived").length}
                  </span>
                  <span className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest mt-1">
                    Total Items
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-natural-text-light italic leading-relaxed text-center px-6">
                No inventory data found. Please add supplies in the inventory
                management tab.
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-xl font-bold font-serif text-natural-text-main">
                {items.filter((i) => i.status !== "Archived").length}
              </div>
              <div className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-tighter">
                Total Items
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold font-serif text-[#6b8e23]">
                {items.filter((i) => i.status === "Healthy").length}
              </div>
              <div className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-tighter">
                Healthy
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold font-serif text-orange-400">
                {items.filter((i) => i.status === "Low Stock").length}
              </div>
              <div className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-tighter">
                Low
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold font-serif text-red-500">
                {items.filter((i) => i.status === "Critical").length}
              </div>
              <div className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-tighter">
                Critical
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
