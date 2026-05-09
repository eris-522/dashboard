import React from "react";
import { supabase } from "./utils/supabase";
import { Sidebar } from "./components/Sidebar";
import { MetricCards } from "./components/MetricCards";
import { RevenueChart } from "./components/RevenueChart";
import { EventCalendar } from "./components/EventCalendar";
import { InventorySummary } from "./components/InventorySummary";
import { RecentActivities } from "./components/RecentActivities";
import { UserPage } from "./pages/UserPage";
import { BookingPage } from "./pages/BookingPage";
import { MenuPage } from "./pages/MenuPage";
import { PackagePage } from "./pages/PackagePage";
import { InventoryPage } from "./pages/InventoryPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuditTrailPage } from "./pages/AuditTrailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotificationCenter } from "./components/NotificationCenter";
import { Bell, Mail, LogOut, Users } from "lucide-react";
import { cn } from "./lib/utils";
import { InventoryProvider } from "./context/InventoryContext";
import { BookingProvider, useBooking } from "./context/BookingContext";
import { UserProvider, useUser } from "./context/UserContext";
import { MenuProvider } from "./context/MenuContext";
import { ServicesProvider } from "./context/ServicesContext";
import { PackageProvider } from "./context/PackageContext";
import { LoginPage } from "./pages/LoginPage";

/**
 * The primary dashboard view component.
 * Displays high-level metrics, revenue charts, and the interactive event calendar.
 * @param onNavigate Callback to switch between management sections.
 */
function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { bookings } = useBooking();
  const confirmedBookings = bookings.filter((b) => b.status === "Confirmed");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats */}
      <MetricCards />

      {/* Charts & Calendar Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="lg:col-span-1">
          <EventCalendar bookings={confirmedBookings} />
        </div>
      </div>

      {/* Inventory & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <InventorySummary onViewAll={() => onNavigate("inventory")} />
        <RecentActivities onViewLogs={() => onNavigate("audit-trail")} />
      </div>
    </div>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);
  const { currentUser, logout } = useUser();
  const { bookings } = useBooking();

  const [dismissedIds, setDismissedIds] = React.useState<number[]>(() => {
    if (!currentUser) return [];
    const saved = localStorage.getItem(`dismissedBookingIds_${currentUser.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  React.useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`dismissedBookingIds_${currentUser.id}`, JSON.stringify(dismissedIds));
    }
  }, [dismissedIds, currentUser]);

  const pendingCount = bookings.filter((b) => {
    const status = b.status || "Pending";
    return (status === "Pending" || status === "Inquiry") && !dismissedIds.includes(b.id);
  }).length;

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex bg-natural-bg min-h-screen">
                <Sidebar active={activeTab} setActive={setActiveTab} />

                <main className="flex-1 ml-56 p-8">
                  {/* Top Header */}
                  <header className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-serif font-bold text-natural-text-main">
                        {activeTab === "dashboard"
                          ? "Executive Dashboard"
                          : activeTab === "user"
                            ? "Account Management"
                            : activeTab === "booking"
                              ? "Event Logistics"
                              : activeTab === "menu"
                                ? "Culinary Workspace"
                                : activeTab === "packages"
                                  ? "Package Bundles"
                                  : activeTab === "inventory"
                                    ? "Inventory Control"
                                    : activeTab === "analytics"
                                      ? "Insights & Performance"
                                      : activeTab === "audit-trail"
                                        ? "Administrative Log"
                                        : activeTab === "setting"
                                          ? "Account Preferences"
                                          : "Catering Workspace"}
                      </h2>
                      <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
                        {activeTab === "dashboard"
                          ? "Business Intelligence & Logistics"
                          : activeTab === "user"
                            ? "User Roles & Access Control"
                            : activeTab === "booking"
                              ? "Scheduled Catering & Operations"
                              : activeTab === "menu"
                                ? "Menu Development & Inventory Link"
                                : activeTab === "packages"
                                  ? "Tiered Event Solutions"
                                  : activeTab === "inventory"
                                    ? "Asset Management & Fulfillment"
                                    : activeTab === "analytics"
                                      ? "Data-Driven Growth Strategies"
                                      : activeTab === "audit-trail"
                                        ? "Chronological System Activity Trail"
                                        : activeTab === "setting"
                                          ? "Workflow & Environment Configuration"
                                          : "Management Console"}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 relative">
                        <button
                          onClick={() =>
                            setIsNotificationOpen(true)
                          }
                          className={cn(
                            "p-2 bg-white border border-natural-border rounded-lg relative hover:bg-natural-bg transition-colors shadow-xs",
                            isNotificationOpen &&
                              "ring-2 ring-natural-accent/20 bg-natural-bg",
                          )}
                        >
                          <Bell className="w-4 h-4 text-natural-text-main" />
                          {pendingCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full border border-white shadow-sm">
                              {pendingCount > 99 ? '99+' : pendingCount}
                            </span>
                          )}
                        </button>

                        <NotificationCenter 
                          isOpen={isNotificationOpen} 
                          onClose={() => setIsNotificationOpen(false)} 
                          onManageBooking={() => setActiveTab("booking")}
                          onViewAllLogs={() => setActiveTab("audit-trail")}
                          dismissedIds={dismissedIds}
                          onDismiss={(id) => setDismissedIds((prev) => [...prev, id])}
                        />
                      </div>

                      <div className="h-8 w-px bg-natural-border" />

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-bold text-natural-text-main uppercase tracking-tight">
                            {currentUser.name}
                          </p>
                          <p className="text-[9px] font-bold text-natural-text-light uppercase tracking-widest opacity-70">
                            {currentUser.role} Account
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab("setting")}
                          title="Go to Settings"
                          className="w-9 h-9 rounded-lg bg-natural-accent/10 border border-natural-accent/20 flex items-center justify-center text-natural-accent font-bold text-xs select-none uppercase hover:bg-natural-accent/20 transition-colors cursor-pointer"
                        >
                          {currentUser.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </button>
                        <button
                          onClick={() => logout()}
                          className="p-2 ml-1 text-natural-text-light hover:text-red-500 hover:bg-white rounded-lg transition-all"
                          title="Sign Out"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </header>

                  {/* Content Area */}
                  <div className="max-w-7xl">
                    {activeTab === "dashboard" ? (
                      <Dashboard onNavigate={setActiveTab} />
                    ) : activeTab === "user" ? (
                      <UserPage />
                    ) : activeTab === "booking" ? (
                      <BookingPage />
                    ) : activeTab === "menu" ? (
                      <MenuPage />
                    ) : activeTab === "packages" ? (
                      <PackagePage />
                    ) : activeTab === "inventory" ? (
                      <InventoryPage />
                    ) : activeTab === "analytics" ? (
                      <AnalyticsPage />
                    ) : activeTab === "audit-trail" ? (
                      <AuditTrailPage />
                    ) : activeTab === "setting" ? (
                      <SettingsPage />
                    ) : (
                      <div className="p-20 text-center glass-card">
                        <p className="text-natural-text-light font-serif italic">
                          This section ({activeTab}) is under construction.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <footer className="mt-12 py-6 border-t border-natural-border text-center">
                    <p className="text-[10px] text-natural-text-light font-bold uppercase tracking-widest">
                      © 2019 Roxan Policarpio Events & Catering
                    </p>
                  </footer>
                </main>
    </div>
  );
}

/**
 * The core application shell including the persistent navigation sidebar and header.
 * Manages the active view state and provides context providers for data domains.
 */
function MainApp() {
  const { currentUser } = useUser();

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <MenuProvider>
      <ServicesProvider>
        <PackageProvider>
          <BookingProvider>
            <InventoryProvider>
              <AppContent />
            </InventoryProvider>
          </BookingProvider>
        </PackageProvider>
      </ServicesProvider>
    </MenuProvider>
  );
}

export default function App() {
  return (
    <UserProvider>
      <MainApp />
    </UserProvider>
  );
}
