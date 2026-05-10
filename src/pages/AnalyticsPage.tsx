import React from 'react';
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
  LineChart,
  Line
} from 'recharts';
import { TrendingUp, Users, Calendar, DollarSign, Download, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { useBooking } from '../context/BookingContext';
import { useInventory } from '../context/InventoryContext';
import { useUser } from '../context/UserContext';

const COLORS = ['#a68a56', '#3d4035', '#8a8b82', '#e8e7e0', '#6b8e23', '#d4af37'];

export function AnalyticsPage() {
  const { bookings } = useBooking();
  const { items } = useInventory();
  const { users } = useUser();

  /**
   * Derived metrics for the business dashboard.
   * Calculates revenue, average event values, and conversion rates from live booking data.
   */
  const confirmedBookings = bookings.filter(b => b.status === 'Confirmed');
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.budget, 0);
  const avgEventValue = confirmedBookings.length > 0 ? totalRevenue / confirmedBookings.length : 0;
  const conversionRate = bookings.length > 0 ? (confirmedBookings.length / bookings.length) * 100 : 0;
  
  // Weekly Data (Mocking days based on existing bookings dates)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData = days.map(day => {
    const dayBookings = confirmedBookings.filter(b => {
      const date = new Date(b.date);
      return days[date.getDay()] === day;
    });
    return {
      name: day,
      total: dayBookings.reduce((sum, b) => sum + b.budget, 0),
      count: dayBookings.length
    };
  });

  // Category Distribution
  const eventTypes = Array.from(new Set(bookings.map(b => b.eventType)));
  const categoryData = eventTypes.map(type => ({
    name: type,
    value: bookings.filter(b => b.eventType === type).length
  }));

  // Low Stock Items
  const lowStockCount = items.filter(i => i.status !== 'Healthy' && i.status !== 'Archived').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">Business Analytics</h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">Historical & real-time performance data</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-all uppercase tracking-widest">
            <Filter className="w-3.5 h-3.5" />
            Time Range
          </button>
          <button className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Insight Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Revenue', value: `₱${totalRevenue.toLocaleString()}`, trend: 'Confirmed', icon: DollarSign },
          { label: 'Avg. Event Value', value: `₱${Math.round(avgEventValue).toLocaleString()}`, trend: `${confirmedBookings.length} Events`, icon: TrendingUp },
          { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, trend: `${bookings.length} Total`, icon: Users },
          { label: 'Inventory Alerts', value: lowStockCount.toString(), trend: 'Needs Action', icon: Calendar },
        ].map((s, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3 text-natural-text-light">
               <span className="text-[0.65rem] font-bold uppercase tracking-widest">{s.label}</span>
               <s.icon className="w-4 h-4 opacity-40" />
            </div>
            <h4 className="text-xl font-bold font-serif text-natural-text-main mb-1">{s.value}</h4>
            <span className={cn(
              "text-[0.65rem] font-bold text-natural-accent"
            )}>{s.trend}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Traffic/Revenue */}
        <div className="lg:col-span-2 glass-card p-6">
           <div className="mb-6 flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg text-natural-text-main">Weekly Revenue Distribution</h3>
              <div className="flex gap-2 text-[0.6rem] font-bold text-natural-text-light uppercase">
                 <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-natural-accent rounded-full" /> Revenue (PHP)</span>
              </div>
           </div>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E7E0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#8a8b82', fontSize: 10}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#8a8b82', fontSize: 10}} />
                  <Tooltip cursor={{fill: '#f8f7f2'}} contentStyle={{borderRadius: '8px', border: '1px solid #E8E7E0'}} />
                  <Bar dataKey="total" fill="#a68a56" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Category Breakdown */}
        <div className="lg:col-span-1 glass-card p-6 flex flex-col">
           <h3 className="font-serif font-bold text-lg text-natural-text-main mb-6">Event Type Distribution</h3>
           <div className="flex-1 min-h-[220px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-natural-border rounded-xl">
                  <p className="text-xs text-natural-text-light italic">No booking data available</p>
                </div>
              )}
           </div>
           <div className="mt-4 grid grid-cols-1 gap-2">
              {categoryData.map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                    <span className="text-[0.65rem] font-bold text-natural-text-main uppercase tracking-tight">{d.name}</span>
                   </div>
                   <span className="text-[0.65rem] font-bold text-natural-text-light">{d.value}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Stats */}
        <div className="glass-card p-6">
           <h3 className="font-serif font-bold text-lg text-natural-text-main mb-6">Account Overview</h3>
           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-natural-bg/20 rounded-xl border border-natural-border text-center">
                <span className="text-2xl font-bold font-serif text-natural-accent">{users.filter((u) => u.id !== 0).length}</span>
                <p className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest mt-1">Total Registered Users</p>
              </div>
              <div className="p-4 bg-natural-bg/20 rounded-xl border border-natural-border text-center">
                <span className="text-2xl font-bold font-serif text-natural-accent">{users.filter((u) => u.id !== 0 && u.status === 'Active').length}</span>
                <p className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest mt-1">Active Accounts</p>
              </div>
           </div>
           <div className="mt-6 space-y-3">
              {[
                { label: 'Customers', count: users.filter(u => u.role === 'Customer').length, color: '#a68a56' },
                { label: 'Staff', count: users.filter(u => u.role === 'Staff').length, color: '#3d4035' },
                { label: 'Owners', count: users.filter(u => u.role === 'Owner').length, color: '#8a8b82' }
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                   <span className="text-xs font-medium text-natural-text-main">{r.label}</span>
                   <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-natural-bg rounded-full overflow-hidden">
                        <div className="h-full" style={{width: `${(r.count / (users.length || 1)) * 100}%`, backgroundColor: r.color}} />
                      </div>
                      <span className="text-[0.65rem] font-bold text-natural-text-main">{r.count}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Growth Forecast */}
        <div className="glass-card p-6">
           <h3 className="font-serif font-bold text-lg text-natural-text-main mb-6">Inventory Health</h3>
           <div className="h-[200px] w-full text-center flex flex-col justify-center border-2 border-dashed border-natural-border rounded-xl bg-natural-bg/20 p-6">
              <p className="text-xs text-natural-text-light italic leading-relaxed">
                {items.filter(i => i.status !== 'Archived').length > 0 
                  ? `Monitoring ${items.filter(i => i.status !== 'Archived').length} active items. ${lowStockCount > 0 ? `${lowStockCount} items require immediate restocking.` : "All supplies are within healthy margins."}`
                  : "No inventory data found. Please add supplies in the inventory management tab."}
              </p>
           </div>
           <div className="mt-4 flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-xl font-bold font-serif text-natural-text-main">{items.filter(i => i.status === 'Healthy').length}</div>
                <div className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-tighter">Healthy</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-serif text-orange-400">{items.filter(i => i.status === 'Low Stock').length}</div>
                <div className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-tighter">Low</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-serif text-red-500">{items.filter(i => i.status === 'Critical').length}</div>
                <div className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-tighter">Critical</div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
