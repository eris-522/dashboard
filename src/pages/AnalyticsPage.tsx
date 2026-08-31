import React, { useState, useMemo } from "react";
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
  Legend,
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
  Boxes,
  Award,
  Package,
  Layers,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useBooking } from "../context/BookingContext";
import { useInventory } from "../context/InventoryContext";
import { useUser } from "../context/UserContext";
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

const PACKAGE_COLORS = ["#a68a56", "#6b8e23", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

export function AnalyticsPage() {
  const { bookings } = useBooking();
  const { items, getAllocatedStock, calculatePackageEquipment } = useInventory();
  const { users, activeUserCount } = useUser();
  const { resolvedTheme } = useTheme();

  const currentYear = new Date().getFullYear();
  const [timeRange, setTimeRange] = useState(currentYear.toString());

  const availableYears = useMemo(() => {
    const years = bookings.map((b) => getEventDate(b).getFullYear());
    return Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a);
  }, [bookings, currentYear]);

  // Filter Bookings by Time Range
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (timeRange === "all") return true;
      return getEventDate(b).getFullYear().toString() === timeRange;
    });
  }, [bookings, timeRange]);

  const confirmedBookings = useMemo(() => {
    return filteredBookings.filter((b) => b.status === "Confirmed" || b.status === "Completed");
  }, [filteredBookings]);

  const totalRevenue = useMemo(() => {
    return confirmedBookings.reduce((sum, b) => sum + (Number(b.budget) || 0), 0);
  }, [confirmedBookings]);

  const avgEventValue = useMemo(() => {
    return confirmedBookings.length > 0 ? totalRevenue / confirmedBookings.length : 0;
  }, [confirmedBookings, totalRevenue]);

  const totalPaxServed = useMemo(() => {
    return confirmedBookings.reduce((sum, b) => {
      const pax = (Number(b.guestCount) || 50) + (Number(b.additionalPax) || 0);
      return sum + pax;
    }, 0);
  }, [confirmedBookings]);

  // Monthly Revenue & Event Volume Data
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

  const monthlyData = useMemo(() => {
    return months.map((month, index) => {
      const monthBookings = confirmedBookings.filter((b) => {
        return getEventDate(b).getMonth() === index;
      });
      return {
        name: month,
        revenue: monthBookings.reduce((sum, b) => sum + (Number(b.budget) || 0), 0),
        events: monthBookings.length,
        guests: monthBookings.reduce(
          (sum, b) => sum + (Number(b.guestCount) || 50) + (Number(b.additionalPax) || 0),
          0
        ),
      };
    });
  }, [confirmedBookings]);

  // Package Breakdown
  const packageAnalytics = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};

    confirmedBookings.forEach((b) => {
      const pkg = b.package || "Custom Package";
      if (!map[pkg]) {
        map[pkg] = { name: pkg, count: 0, revenue: 0 };
      }
      map[pkg].count += 1;
      map[pkg].revenue += Number(b.budget) || 0;
    });

    const list = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    return list.map((item, idx) => ({
      ...item,
      color: PACKAGE_COLORS[idx % PACKAGE_COLORS.length],
      percent: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0,
    }));
  }, [confirmedBookings, totalRevenue]);

  // Event Type Breakdown
  const eventTypeAnalytics = useMemo(() => {
    const map: Record<string, { type: string; count: number; revenue: number }> = {};

    confirmedBookings.forEach((b) => {
      const type = b.eventType || "Wedding";
      if (!map[type]) {
        map[type] = { type, count: 0, revenue: 0 };
      }
      map[type].count += 1;
      map[type].revenue += Number(b.budget) || 0;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [confirmedBookings]);

  // Inventory Stock Health Data
  const activeItems = useMemo(() => {
    return items.filter((i) => i.status !== "Archived" && i.status?.toLowerCase() !== "archived");
  }, [items]);

  const lowStockCount = useMemo(() => {
    return activeItems.filter((i) => i.status !== "Healthy").length;
  }, [activeItems]);

  const totalAllocatedEquipment = useMemo(() => {
    return activeItems.reduce((sum, i) => sum + getAllocatedStock(i.id), 0);
  }, [activeItems, getAllocatedStock]);

  const inventoryPieData = useMemo(() => {
    return [
      {
        name: "Healthy Stock",
        value: activeItems.filter((i) => i.status === "Healthy").length,
        color: "#6b8e23",
      },
      {
        name: "Low Stock",
        value: activeItems.filter((i) => i.status === "Low Stock").length,
        color: "#f59e0b",
      },
      {
        name: "Critical",
        value: activeItems.filter((i) => i.status === "Critical").length,
        color: "#ef4444",
      },
    ].filter((d) => d.value > 0);
  }, [activeItems]);

  // CSV Report Generator
  const handleExportReport = () => {
    const periodLabel = timeRange === "all" ? "All Time" : `Year ${timeRange}`;
    let csv = `ROXAN POLICARPIO CATERING SERVICES - BUSINESS ANALYTICS REPORT\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n`;
    csv += `Reporting Period: ${periodLabel}\n\n`;

    csv += `--- EXECUTIVE SUMMARY ---\n`;
    csv += `Total Confirmed Revenue,PHP ${totalRevenue.toLocaleString()}\n`;
    csv += `Total Confirmed Events,${confirmedBookings.length}\n`;
    csv += `Total Guests Served,${totalPaxServed.toLocaleString()} Pax\n`;
    csv += `Average Event Value,PHP ${Math.round(avgEventValue).toLocaleString()}\n`;
    csv += `Inventory Units Allocated,${totalAllocatedEquipment} Units\n\n`;

    csv += `--- MONTHLY PERFORMANCE BREAKDOWN ---\n`;
    csv += `Month,Revenue (PHP),Confirmed Events,Guests Served\n`;
    monthlyData.forEach((m) => {
      csv += `${m.name},${m.revenue},${m.events},${m.guests}\n`;
    });
    csv += `\n`;

    csv += `--- PACKAGE PERFORMANCE BREAKDOWN ---\n`;
    csv += `Package Name,Bookings Count,Total Revenue (PHP),Revenue Share (%)\n`;
    packageAnalytics.forEach((p) => {
      csv += `"${p.name}",${p.count},${p.revenue},${p.percent.toFixed(1)}%\n`;
    });
    csv += `\n`;

    csv += `--- EVENT TYPE BREAKDOWN ---\n`;
    csv += `Event Type,Total Bookings,Revenue Generated (PHP)\n`;
    eventTypeAnalytics.forEach((e) => {
      csv += `"${e.type}",${e.count},${e.revenue}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `catering_analytics_report_${timeRange === "all" ? "all_time" : timeRange}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Business Analytics & Intelligence ({timeRange === "all" ? "All Time" : `Year ${timeRange}`})
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Real-time catering financial performance, event metrics, and logistics utilization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative inline-block">
            <Filter className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-natural-text-main pointer-events-none" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2.5 border border-natural-border rounded-xl text-xs font-bold text-natural-text-main bg-white hover:bg-natural-bg/50 transition-all uppercase tracking-widest outline-none cursor-pointer shadow-xs"
            >
              <option value="all">All Time</option>
              {availableYears.map((year) => (
                <option key={year} value={year.toString()}>
                  Year {year}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-natural-text-main pointer-events-none" />
          </div>

          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV Report
          </button>
        </div>
      </div>

      {/* KPI Insight Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="glass-card p-5 bg-white border-l-4 border-natural-accent">
          <div className="flex items-center justify-between text-natural-text-light mb-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-natural-accent" />
          </div>
          <h4 className="text-xl font-bold font-serif text-natural-text-main">
            ₱{totalRevenue.toLocaleString()}
          </h4>
          <span className="text-[10px] font-bold text-natural-accent block mt-1">
            {confirmedBookings.length} Confirmed Events
          </span>
        </div>

        <div className="glass-card p-5 bg-white">
          <div className="flex items-center justify-between text-natural-text-light mb-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">Avg. Event Value</span>
            <TrendingUp className="w-4 h-4 text-[#6b8e23]" />
          </div>
          <h4 className="text-xl font-bold font-serif text-natural-text-main">
            ₱{Math.round(avgEventValue).toLocaleString()}
          </h4>
          <span className="text-[10px] font-bold text-natural-text-light block mt-1">
            Per booking average
          </span>
        </div>

        <div className="glass-card p-5 bg-white">
          <div className="flex items-center justify-between text-natural-text-light mb-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">Total Guests (Pax)</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <h4 className="text-xl font-bold font-serif text-natural-text-main">
            {totalPaxServed.toLocaleString()}
          </h4>
          <span className="text-[10px] font-bold text-blue-700 block mt-1">
            Catered attendees
          </span>
        </div>

        <div className="glass-card p-5 bg-white">
          <div className="flex items-center justify-between text-natural-text-light mb-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">Equipment Reserved</span>
            <Boxes className="w-4 h-4 text-purple-600" />
          </div>
          <h4 className="text-xl font-bold font-serif text-natural-text-main">
            {totalAllocatedEquipment.toLocaleString()}
          </h4>
          <span className="text-[10px] font-bold text-purple-700 block mt-1">
            Units allocated to events
          </span>
        </div>

        <div className="glass-card p-5 bg-white">
          <div className="flex items-center justify-between text-natural-text-light mb-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">Inventory Health</span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <h4 className="text-xl font-bold font-serif text-natural-text-main">
            {lowStockCount === 0 ? "Optimal" : `${lowStockCount} Low`}
          </h4>
          <span
            className={cn(
              "text-[10px] font-bold block mt-1",
              lowStockCount > 0 ? "text-amber-700" : "text-[#6b8e23]"
            )}
          >
            {lowStockCount > 0 ? "Needs Restocking" : "All Items Sufficient"}
          </span>
        </div>
      </div>

      {/* Main Row: Monthly Revenue & Events Chart */}
      <div className="glass-card p-6 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-natural-border pb-4">
          <div>
            <h3 className="font-serif font-bold text-lg text-natural-text-main flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-natural-accent" />
              Monthly Revenue & Event Volume ({timeRange === "all" ? "All Time" : `Year ${timeRange}`})
            </h3>
            <p className="text-xs text-natural-text-light mt-0.5">
              Gross revenue generated and event bookings executed per month
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-natural-text-light">
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-natural-accent rounded-sm" />
              Revenue (₱)
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-[#6b8e23] rounded-sm" />
              Events Count
            </span>
          </div>
        </div>

        <div className="h-[320px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === "dark" ? "#2e3028" : "#E8E7E0"} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: resolvedTheme === "dark" ? "#9e9f96" : "#8a8b82", fontSize: 11, fontWeight: 600 }}
                dy={8}
              />
              <YAxis
                yAxisId="revenue"
                axisLine={false}
                tickLine={false}
                tick={{ fill: resolvedTheme === "dark" ? "#9e9f96" : "#8a8b82", fontSize: 10, fontWeight: 600 }}
                tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <YAxis
                yAxisId="events"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: resolvedTheme === "dark" ? "#4caf50" : "#6b8e23", fontSize: 10, fontWeight: 600 }}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value: any, name: any) => [
                  name === "revenue" ? `₱${Number(value || 0).toLocaleString()}` : `${value} Events`,
                  name === "revenue" ? "Monthly Revenue" : "Event Bookings",
                ]}
                contentStyle={{
                  backgroundColor: resolvedTheme === "dark" ? "#1c1d18" : "#ffffff",
                  borderRadius: "10px",
                  border: resolvedTheme === "dark" ? "1px solid #2e3028" : "1px solid #E8E7E0",
                  boxShadow: resolvedTheme === "dark" ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 14px rgba(0,0,0,0.06)",
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  color: resolvedTheme === "dark" ? "#f3f3ee" : "#2d2e2a",
                }}
              />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                fill="#a68a56"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                yAxisId="events"
                dataKey="events"
                fill="#6b8e23"
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second Row: Package Performance & Event Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Package Revenue Share */}
        <div className="glass-card p-6 bg-white flex flex-col justify-between">
          <div>
            <div className="border-b border-natural-border pb-4 mb-4">
              <h3 className="font-serif font-bold text-lg text-natural-text-main flex items-center gap-2">
                <Award className="w-5 h-5 text-natural-accent" />
                Package Performance & Revenue Share
              </h3>
              <p className="text-xs text-natural-text-light mt-0.5">
                Distribution of revenue and booking popularity by catering tier
              </p>
            </div>

            {packageAnalytics.length === 0 ? (
              <div className="py-16 text-center text-natural-text-light italic font-serif">
                No confirmed package bookings in this timeframe
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={packageAnalytics}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="revenue"
                        stroke="none"
                      >
                        {packageAnalytics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`₱${Number(val).toLocaleString()}`, "Revenue"]}
                        contentStyle={{
                          backgroundColor: resolvedTheme === "dark" ? "#1c1d18" : "#ffffff",
                          borderRadius: "8px",
                          border: resolvedTheme === "dark" ? "1px solid #2e3028" : "1px solid #E8E7E0",
                          boxShadow: resolvedTheme === "dark" ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 14px rgba(0,0,0,0.06)",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: resolvedTheme === "dark" ? "#f3f3ee" : "#2d2e2a",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 pt-2">
                  {packageAnalytics.map((pkg, idx) => (
                    <div key={idx} className="p-3 bg-natural-bg/30 rounded-xl border border-natural-border flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pkg.color }} />
                        <div>
                          <p className="text-xs font-bold text-natural-text-main">{pkg.name}</p>
                          <span className="text-[10px] text-natural-text-light font-semibold">
                            {pkg.count} {pkg.count === 1 ? "Booking" : "Bookings"} • {pkg.percent.toFixed(1)}% Share
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold font-serif text-natural-accent">
                        ₱{pkg.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Event Type & User Accounts */}
        <div className="space-y-8">
          {/* Event Types Card */}
          <div className="glass-card p-6 bg-white">
            <div className="border-b border-natural-border pb-4 mb-4">
              <h3 className="font-serif font-bold text-lg text-natural-text-main flex items-center gap-2">
                <Layers className="w-5 h-5 text-natural-accent" />
                Event Types Distribution
              </h3>
              <p className="text-xs text-natural-text-light mt-0.5">
                Popularity of celebrations catered (Weddings, Debuts, Birthdays, Corporate)
              </p>
            </div>

            {eventTypeAnalytics.length === 0 ? (
              <div className="py-12 text-center text-natural-text-light italic font-serif">
                No events recorded yet
              </div>
            ) : (
              <div className="space-y-3">
                {eventTypeAnalytics.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-natural-bg/30 rounded-xl border border-natural-border">
                    <div>
                      <p className="text-xs font-bold text-natural-text-main">{ev.type}</p>
                      <span className="text-[10px] text-natural-text-light font-semibold">
                        {ev.count} {ev.count === 1 ? "Event" : "Events"} confirmed
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold font-serif text-natural-text-main block">
                        ₱{ev.revenue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inventory Health & Stock Distribution */}
          <div className="glass-card p-6 bg-white">
            <div className="border-b border-natural-border pb-4 mb-4">
              <h3 className="font-serif font-bold text-lg text-natural-text-main flex items-center gap-2">
                <Boxes className="w-5 h-5 text-natural-accent" />
                Warehouse Supply Health & Demand
              </h3>
              <p className="text-xs text-natural-text-light mt-0.5">
                Status of supplies and equipment ready for event allocation
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-natural-bg/40 border border-natural-border rounded-xl">
                <span className="text-xl font-serif font-bold text-natural-text-main block">
                  {activeItems.length}
                </span>
                <span className="text-[9px] font-bold text-natural-text-light uppercase tracking-wider">
                  Item Types
                </span>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-xl font-serif font-bold text-green-700 block">
                  {activeItems.filter((i) => i.status === "Healthy").length}
                </span>
                <span className="text-[9px] font-bold text-green-800 uppercase tracking-wider">
                  Healthy
                </span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-xl font-serif font-bold text-amber-700 block">
                  {activeItems.filter((i) => i.status === "Low Stock").length}
                </span>
                <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">
                  Low Stock
                </span>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <span className="text-xl font-serif font-bold text-red-700 block">
                  {activeItems.filter((i) => i.status === "Critical").length}
                </span>
                <span className="text-[9px] font-bold text-red-800 uppercase tracking-wider">
                  Critical
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
