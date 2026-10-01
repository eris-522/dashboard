import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  History,
  User,
  Clock,
  Shield,
  Database,
  RefreshCw,
  Warehouse,
  Calendar,
  Package,
  Utensils,
  Download,
} from "lucide-react";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { supabase } from "../utils/supabase";

export function AuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel("audit-logs-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        () => {
          fetchLogs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching audit logs:", error);
      } else if (data) {
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clears the current session's audit log display after user confirmation.
   * Note: In a production environment, this would require high-level authorization.
   */
  const handleClearLogs = async () => {
    if (
      confirm(
        "Are you sure you want to clear all audit logs? This action cannot be undone.",
      )
    ) {
      const { error } = await supabase.from("audit_logs").delete().neq("id", 0);
      if (error) {
        console.error("Error clearing logs:", error);
      } else {
        setLogs([]);
      }
    }
  };

  const handleDownloadArchive = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["ID", "Timestamp", "User", "Type", "Action", "Target", "Details"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.created_at || l.timestamp,
      `"${(l.user_name || l.user || "System").replace(/"/g, '""')}"`,
      `"${(l.type || "").replace(/"/g, '""')}"`,
      `"${(l.action || "").replace(/"/g, '""')}"`,
      `"${(l.target || "").replace(/"/g, '""')}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isEquipmentLog = (log: any) => {
    const action = (log.action || "").toLowerCase();
    const target = (log.target || "").toLowerCase();
    const details = (log.details || "").toLowerCase();
    return (
      action.includes("equipment") ||
      details.includes("equipment") ||
      target.includes("equipment") ||
      action.includes("restock") ||
      details.includes("restock:") ||
      details.includes("allocated supplies") ||
      details.includes("reserved equipment") ||
      action.includes("inventory") ||
      details.includes("inventory")
    );
  };

  const isBookingLog = (log: any) => {
    const action = (log.action || "").toLowerCase();
    const details = (log.details || "").toLowerCase();
    return action.includes("booking") || details.includes("booking");
  };

  const isPackageLog = (log: any) => {
    const action = (log.action || "").toLowerCase();
    const details = (log.details || "").toLowerCase();
    return (
      action.includes("package") ||
      action.includes("inclusion") ||
      details.includes("package") ||
      details.includes("inclusion")
    );
  };

  const isMenuLog = (log: any) => {
    const action = (log.action || "").toLowerCase();
    const details = (log.details || "").toLowerCase();
    return action.includes("menu") || action.includes("dish") || details.includes("menu") || details.includes("dish");
  };

  const isSystemLog = (log: any) => {
    const action = (log.action || "").toLowerCase();
    return action.includes("user") || action.includes("profile") || action.includes("cms") || action.includes("setting");
  };

  const moduleCounts = useMemo(() => {
    return {
      all: logs.length,
      equipment: logs.filter(isEquipmentLog).length,
      booking: logs.filter(isBookingLog).length,
      package: logs.filter(isPackageLog).length,
      menu: logs.filter(isMenuLog).length,
      system: logs.filter(isSystemLog).length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const query = searchQuery.toLowerCase();
      const user = (log.user_name || log.user || "").toLowerCase();
      const action = (log.action || "").toLowerCase();
      const target = (log.target || "").toLowerCase();
      const type = (log.type || "").toLowerCase();
      const details = (log.details || "").toLowerCase();
      const id = String(log.id || "");

      const matchesSearch =
        !query ||
        user.includes(query) ||
        action.includes(query) ||
        target.includes(query) ||
        type.includes(query) ||
        details.includes(query) ||
        id.includes(query);

      if (!matchesSearch) return false;

      // Module filter
      if (selectedModule === "equipment" && !isEquipmentLog(log)) return false;
      if (selectedModule === "booking" && !isBookingLog(log)) return false;
      if (selectedModule === "package" && !isPackageLog(log)) return false;
      if (selectedModule === "menu" && !isMenuLog(log)) return false;
      if (selectedModule === "system" && !isSystemLog(log)) return false;

      // Type filter
      if (selectedType !== "all" && type !== selectedType.toLowerCase()) return false;

      return true;
    });
  }, [logs, searchQuery, selectedModule, selectedType]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            System Audit Trail
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Complete record of administrative and equipment logistics actions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2.5 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-all uppercase tracking-widest cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-2 px-4 py-2.5 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-all uppercase tracking-widest cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            Clear Logs
          </button>
          <button
            onClick={handleDownloadArchive}
            className="flex items-center gap-2 bg-natural-sidebar text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-sidebar/90 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Audit Archive
          </button>
        </div>
      </div>

      {/* Module Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-natural-border pb-1">
        {[
          { id: "all", label: "All Activity", icon: Database, count: moduleCounts.all },
          { id: "equipment", label: "Equipment Monitoring", icon: Warehouse, count: moduleCounts.equipment },
          { id: "booking", label: "Bookings", icon: Calendar, count: moduleCounts.booking },
          { id: "package", label: "Packages & Inclusions", icon: Package, count: moduleCounts.package },
          { id: "menu", label: "Menu", icon: Utensils, count: moduleCounts.menu },
          { id: "system", label: "Users & Settings", icon: Shield, count: moduleCounts.system },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedModule === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedModule(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
                isActive
                  ? "bg-natural-accent text-white shadow-sm"
                  : "bg-white border border-natural-border text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px]",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-natural-bg text-natural-text-main"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="glass-card bg-white overflow-hidden">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by user, action, target, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-natural-border rounded-lg bg-white">
              <Filter className="w-3.5 h-3.5 text-natural-text-main" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="text-xs font-bold text-natural-text-main bg-transparent outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="all">All Event Types</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
              </select>
            </div>

            <span className="text-xs font-semibold text-natural-text-light">
              Showing {filteredLogs.length} record{filteredLogs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="divide-y divide-natural-border">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-natural-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-natural-text-light font-serif italic text-sm">
                Loading audit trail records...
              </p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 text-center">
              <History className="w-12 h-12 text-natural-text-light mx-auto mb-4 opacity-20" />
              <p className="text-natural-text-light font-serif italic text-sm">
                No administrative logs recorded yet
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const logDate = new Date(
                log.created_at || log.timestamp || new Date(),
              );
              const logUser = log.user_name || log.user || "Unknown User";

              return (
                <div
                  key={log.id || Math.random()}
                  className="p-6 hover:bg-natural-bg/10 transition-colors flex flex-col md:flex-row md:items-start gap-4"
                >
                  <div className="flex items-center gap-4 shrink-0 w-full md:w-64">
                    <div
                      className={cn(
                        "p-3 rounded-xl border",
                        log.type === "Update"
                          ? "bg-blue-50 border-blue-100 text-blue-600"
                          : log.type === "Create"
                            ? "bg-green-50 border-green-100 text-green-600"
                            : log.type === "Delete"
                              ? "bg-red-50 border-red-100 text-red-600"
                              : "bg-amber-50 border-amber-100 text-amber-600",
                      )}
                    >
                      {isEquipmentLog(log) ? (
                        <Warehouse className="w-5 h-5" />
                      ) : log.type === "Update" ? (
                        <Database className="w-5 h-5" />
                      ) : log.type === "Create" ? (
                        <Plus className="w-5 h-5" />
                      ) : log.type === "Delete" ? (
                        <Shield className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-natural-text-main uppercase tracking-widest leading-none mb-1">
                        {log.type}
                      </p>
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest opacity-60">
                        ID: LOG-{log.id?.toString().padStart(5, "0")}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-natural-text-main tracking-tight leading-tight">
                          {log.action?.replace(/inventory/gi, (m: string) => m[0] === 'I' ? 'Equipment' : 'equipment')}
                        </h4>
                        <p className="text-xs text-natural-text-light font-medium mt-0.5">
                          Target:{" "}
                          <span className="text-natural-text-main font-semibold">
                            {log.target?.replace(/inventory/gi, (m: string) => m[0] === 'I' ? 'Equipment' : 'equipment')}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-natural-text-main tracking-tighter">
                          {format(logDate, "HH:mm a")}
                        </p>
                        <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                          {format(logDate, "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    <div className="bg-natural-bg border border-natural-border px-4 py-3 rounded-lg mt-3 flex items-start gap-3">
                      <div className="w-1 h-8 bg-natural-border rounded-full" />
                      <div>
                        <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest mb-1">
                          Administrative Changes
                        </p>
                        <p className="text-xs font-medium text-natural-text-main italic">
                          "{log.details?.replace(/inventory/gi, (m: string) => m[0] === 'I' ? 'Equipment' : 'equipment')}"
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-48 pt-1 flex md:flex-col items-center md:items-end justify-between md:justify-start gap-3">
                    <div className="flex items-center gap-2 text-right">
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-natural-text-main leading-tight">
                          {logUser}
                        </p>
                        <p className="text-[9px] font-bold text-natural-text-light uppercase tracking-wider">
                          Access Granted
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-natural-sidebar text-[#f8f7f2] flex items-center justify-center text-[0.65rem] font-bold shrink-0">
                        {logUser === "System"
                          ? "S"
                          : logUser
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {logs.length > 0 && (
          <div className="p-4 bg-natural-bg/10 text-center">
            <button className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-[0.2em] hover:text-natural-accent transition-colors">
              Load Historical Entries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const Plus = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);
