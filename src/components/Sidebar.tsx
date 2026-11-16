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
  Globe,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Users, label: 'User', id: 'user' },
  { icon: CalendarCheck, label: 'Booking', id: 'booking' },
  { icon: UtensilsCrossed, label: 'Menu', id: 'menu' },
  { icon: Package, label: 'Packages', id: 'packages' },
  { icon: PackageSearch, label: 'Equipment Monitoring', id: 'inventory' },
  { icon: Globe, label: 'CMS (Website)', id: 'cms' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics' },
  { icon: History, label: 'Audit Trail', id: 'audit-trail' },
  { icon: Settings, label: 'Setting', id: 'setting' },
];

export interface SidebarProps {
  active: string;
  setActive: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ active, setActive, isOpen = false, onClose }: SidebarProps) {
  React.useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="admin-sidebar-drawer"
        aria-label="Primary sidebar navigation"
        className={cn(
          "w-64 max-w-[82dvw] lg:w-56 h-dvh bg-natural-sidebar text-[#f8f7f2] flex flex-col fixed left-0 top-0 z-50 border-r border-natural-border/30 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 pt-7 lg:pt-8 flex items-start justify-between gap-2 shrink-0">
          <h1 className="text-xl font-serif font-bold text-natural-accent leading-tight">
            ROXAN POLICARPIO
            <span className="block text-xs font-sans font-normal opacity-80 mt-1 uppercase tracking-widest text-[#f8f7f2]">
              Events & Catering
            </span>
          </h1>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 -mr-1 rounded-lg text-[#f8f7f2]/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-0 py-3 mt-1 lg:mt-4 overflow-y-auto no-scrollbar">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <button
                    id={`nav-${item.id}`}
                    type="button"
                    onClick={() => {
                      setActive(item.id);
                      onClose?.();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-6 py-3 lg:py-2.5 transition-all duration-200 text-[0.85rem] font-normal text-left cursor-pointer",
                      isActive 
                        ? "bg-white/5 border-l-4 border-natural-accent opacity-100 font-semibold" 
                        : "opacity-80 hover:opacity-100 hover:bg-white/5 border-l-4 border-transparent"
                    )}
                  >
                    <item.icon className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-natural-accent" : "text-[#f8f7f2]/60"
                    )} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
