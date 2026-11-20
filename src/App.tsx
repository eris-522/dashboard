import React, { Suspense, lazy } from "react";
import { Sidebar } from "./components/Sidebar";
import { MetricCards } from "./components/MetricCards";
import { RevenueChart } from "./components/RevenueChart";
import { EventCalendar } from "./components/EventCalendar";
import { InventorySummary } from "./components/InventorySummary";
import { RecentActivities } from "./components/RecentActivities";
import { NotificationCenter, buildAdminNotifications } from "./components/NotificationCenter";
import { Bell, LogOut, Sun, Moon, Menu } from "lucide-react";
import { cn } from "./lib/utils";
import { InventoryProvider } from "./context/InventoryContext";
import { BookingProvider, useBooking } from "./context/BookingContext";
import { UserProvider, useUser } from "./context/UserContext";
import { MenuProvider } from "./context/MenuContext";
import { ServicesProvider } from "./context/ServicesContext";
import { PackageProvider } from "./context/PackageContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

// Lazy-load individual management views on-demand to reduce initial bundle and Vercel bandwidth
const UserPage = lazy(() => import("./pages/UserPage").then((m) => ({ default: m.UserPage })));
const BookingPage = lazy(() => import("./pages/BookingPage").then((m) => ({ default: m.BookingPage })));
const MenuPage = lazy(() => import("./pages/MenuPage").then((m) => ({ default: m.MenuPage })));
const PackagePage = lazy(() => import("./pages/PackagePage").then((m) => ({ default: m.PackagePage })));
const InventoryPage = lazy(() => import("./pages/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const AuditTrailPage = lazy(() => import("./pages/AuditTrailPage").then((m) => ({ default: m.AuditTrailPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const CMSPage = lazy(() => import("./pages/CMSPage").then((m) => ({ default: m.CMSPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));

function SectionLoadingFallback() {
  return (
    <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
      <div className="w-8 h-8 border-3 border-natural-accent/20 border-t-natural-accent rounded-full animate-spin" />
      <span className="text-xs text-natural-text-light font-medium uppercase tracking-wider">
        Loading Section...
      </span>
    </div>
  );
}

/**
 * The primary dashboard view component.
 * Displays high-level metrics, revenue charts, and the interactive event calendar.
 * @param onNavigate Callback to switch between management sections.
 */
function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { bookings } = useBooking();
  const confirmedBookings = bookings.filter((b) => b.status === "Confirmed" || b.status === "Completed");

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 min-w-0">
      {/* Stats */}
      <MetricCards onNavigate={onNavigate} />

      {/* Charts & Calendar Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 w-full">
        <div className="xl:col-span-2">
          <RevenueChart />
        </div>
        <div className="xl:col-span-1">
          <EventCalendar bookings={confirmedBookings} />
        </div>
      </div>

      {/* Equipment Monitoring & Activity Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 w-full">
        <InventorySummary onViewAll={() => onNavigate("inventory")} />
        <RecentActivities onViewLogs={() => onNavigate("audit-trail")} />
      </div>
    </div>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);
  const { currentUser, logout } = useUser();
  const { bookings } = useBooking();
  const { resolvedTheme, toggleTheme } = useTheme();

  const notificationRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileMenuOpen]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    if (isNotificationOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotificationOpen]);

  const [dismissedIds, setDismissedIds] = React.useState<string[]>(() => {
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
    const handleMarkRead = (e: any) => {
      const { id, status, key: explicitKey } = e.detail || {};
      const key = explicitKey || `${id}-${status}`;
      setDismissedIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
    };
    window.addEventListener("markAdminNotifRead", handleMarkRead);
    return () => window.removeEventListener("markAdminNotifRead", handleMarkRead);
  }, []);

  React.useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`dismissedBookingIds_${currentUser.id}`, JSON.stringify(dismissedIds));
    }
  }, [dismissedIds, currentUser]);

  const pendingCount = React.useMemo(() => {
    return buildAdminNotifications(bookings).filter(
      (item) => item.isActionable && !dismissedIds.includes(item.notifKey)
    ).length;
  }, [bookings, dismissedIds]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex bg-natural-bg min-h-screen">
      <Sidebar
        active={activeTab}
        setActive={setActiveTab}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 ml-0 lg:ml-56 px-4 sm:px-6 lg:px-8 pb-6 lg:pb-8 min-w-0">
        {/* Top Header */}
        <header
          className={cn(
            "sticky top-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-3 sm:pb-4 mb-4 flex items-center justify-between gap-2 sm:gap-3 transition-colors duration-250",
            isNotificationOpen ? "z-50" : "z-30"
          )}
        >
          {/* Separate backdrop layer so fixed mobile NotificationCenter isn't trapped by backdrop-filter */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-natural-bg/95 backdrop-blur-md -z-10 border-b border-natural-border/40 lg:border-b-0 pointer-events-none"
          />

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                setIsNotificationOpen(false);
                setIsMobileMenuOpen(true);
              }}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="admin-sidebar-drawer"
              className="lg:hidden p-2 bg-white border border-natural-border rounded-lg text-natural-text-main hover:bg-natural-bg transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-2xl font-serif font-bold text-natural-text-main leading-tight truncate">
                <span className="sm:hidden">
                  {activeTab === "dashboard"
                    ? "Dashboard"
                    : activeTab === "user"
                      ? "Users"
                      : activeTab === "booking"
                        ? "Bookings"
                        : activeTab === "menu"
                          ? "Menu"
                          : activeTab === "packages"
                            ? "Packages"
                            : activeTab === "inventory"
                              ? "Equipment Monitoring"
                              : activeTab === "cms"
                                ? "Website CMS"
                                : activeTab === "analytics"
                                  ? "Analytics"
                                  : activeTab === "audit-trail"
                                    ? "Audit Trail"
                                    : activeTab === "setting"
                                      ? "Settings"
                                      : "Workspace"}
                </span>
                <span className="hidden sm:inline">
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
                              ? "Equipment Monitoring"
                              : activeTab === "cms"
                                ? "Website Content Management"
                                : activeTab === "analytics"
                                  ? "Insights & Performance"
                                  : activeTab === "audit-trail"
                                    ? "Administrative Log"
                                    : activeTab === "setting"
                                      ? "Account Preferences"
                                      : "Catering Workspace"}
                </span>
              </h2>
              <p className="text-natural-text-light text-[0.6rem] sm:text-[0.8rem] font-medium uppercase tracking-wide sm:tracking-wider truncate">
                <span className="sm:hidden">
                  {activeTab === "dashboard"
                    ? "Overview & Logistics"
                    : activeTab === "user"
                      ? "Roles & Access"
                      : activeTab === "booking"
                        ? "Catering & Schedule"
                        : activeTab === "menu"
                          ? "Dishes & Equipment"
                          : activeTab === "packages"
                            ? "Event Bundles"
                            : activeTab === "inventory"
                              ? "Stock & Rentals"
                              : activeTab === "cms"
                                ? "Live Portal Sync"
                                : activeTab === "analytics"
                                  ? "Revenue & Metrics"
                                  : activeTab === "audit-trail"
                                    ? "Activity History"
                                    : activeTab === "setting"
                                      ? "Profile & Theme"
                                      : "Admin Console"}
                </span>
                <span className="hidden sm:inline">
                  {activeTab === "dashboard"
                    ? "Business Intelligence & Logistics"
                    : activeTab === "user"
                      ? "User Roles & Access Control"
                      : activeTab === "booking"
                        ? "Scheduled Catering & Operations"
                        : activeTab === "menu"
                          ? "Menu Development & Equipment Link"
                          : activeTab === "packages"
                            ? "Tiered Event Solutions"
                            : activeTab === "inventory"
                              ? "Equipment Tracking, Allocation & Logistics"
                              : activeTab === "cms"
                                ? "Customer Portal Customization & Real-Time Sync"
                                : activeTab === "analytics"
                                  ? "Data-Driven Growth Strategies"
                                  : activeTab === "audit-trail"
                                    ? "Chronological System Activity Trail"
                                    : activeTab === "setting"
                                      ? "Workflow & Environment Configuration"
                                      : "Management Console"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 lg:gap-6 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} Mode (Appearance Settings)`}
              aria-label={`Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} Mode`}
              className="p-2 bg-white border border-natural-border rounded-lg relative hover:bg-natural-bg transition-all shadow-xs cursor-pointer text-natural-text-main hover:scale-105 active:scale-95"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-natural-text-main animate-in spin-in-180 duration-300" />
              )}
            </button>

            {/* Notification Bell */}
            <div className="flex items-center gap-2 relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                aria-label="Notifications"
                aria-expanded={isNotificationOpen}
                className={cn(
                  "p-2 bg-white border border-natural-border rounded-lg relative hover:bg-natural-bg transition-colors shadow-xs cursor-pointer",
                  isNotificationOpen && "ring-2 ring-natural-accent/20 bg-natural-bg"
                )}
              >
                <Bell className="w-4 h-4 text-natural-text-main" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full border border-white shadow-sm">
                    {pendingCount > 99 ? "99+" : pendingCount}
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

            <div className="hidden sm:block h-8 w-px bg-natural-border" />

            <div className="flex items-center gap-1.5 sm:gap-3">
              <div className="text-right hidden md:block">
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
                aria-label="Go to Account Settings"
                className="w-9 h-9 rounded-lg bg-natural-accent/10 border border-natural-accent/20 flex items-center justify-center text-natural-accent font-bold text-xs select-none uppercase hover:bg-natural-accent/20 transition-colors cursor-pointer"
              >
                {currentUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </button>
              <button
                onClick={() => logout()}
                className="p-2 text-natural-text-light hover:text-red-500 hover:bg-white rounded-lg transition-all cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="w-full max-w-none transition-all duration-300 min-w-0">
          <Suspense fallback={<SectionLoadingFallback />}>
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
            ) : activeTab === "cms" ? (
              <CMSPage />
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
          </Suspense>
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
  const { currentUser, isAuthChecking } = useUser();

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-natural-bg flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-natural-accent border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold uppercase tracking-widest text-natural-text-light">
          Verifying Session...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-natural-light flex items-center justify-center" />}>
        <LoginPage />
      </Suspense>
    );
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
    <ThemeProvider>
      <UserProvider>
        <MainApp />
      </UserProvider>
    </ThemeProvider>
  );
}
