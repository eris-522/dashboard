import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  UtensilsCrossed, 
  Package, 
  PackageSearch, 
  BarChart3, 
  History, 
  Settings,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Users, label: 'User', id: 'user' },
  { icon: CalendarCheck, label: 'Booking', id: 'booking' },
  { icon: UtensilsCrossed, label: 'Menu', id: 'menu' },
  { icon: Package, label: 'Packages', id: 'packages' },
  { icon: PackageSearch, label: 'Inventory', id: 'inventory' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics' },
  { icon: History, label: 'Audit Trail', id: 'audit-trail' },
  { icon: Settings, label: 'Setting', id: 'setting' },
];

export interface SidebarProps {
  active: string;
  setActive: (id: string) => void;
}

export function Sidebar({ active, setActive }: SidebarProps) {
  return (
    <aside className="w-56 h-screen bg-natural-sidebar text-[#f8f7f2] flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 pt-8">
        <h1 className="text-xl font-serif font-bold text-natural-accent leading-tight">
          ROXAN POLICARPIO
          <span className="block text-xs font-sans font-normal opacity-80 mt-1 uppercase tracking-widest text-[#f8f7f2]">
            Events & Catering
          </span>
        </h1>
      </div>

      <nav className="flex-1 px-0 py-4 mt-4">
        <ul className="space-y-0">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <button
                  id={`nav-${item.id}`}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-6 py-2.5 transition-all duration-200 text-[0.85rem] font-normal text-left",
                    isActive 
                      ? "bg-white/5 border-l-4 border-natural-accent opacity-100" 
                      : "opacity-80 hover:opacity-100 hover:bg-white/5 border-l-4 border-transparent"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4",
                    isActive ? "text-natural-accent" : "text-[#f8f7f2]/60"
                  )} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

    </aside>
  );
}
