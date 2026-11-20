import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { subscribeAuditBroadcast } from "../utils/liveBroadcast";

export function AuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const PAGE_SIZE = 40;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const maxLoadedIdRef = useRef<number>(0);
  const oldestLoadedIdRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const applyServerFilters = useCallback(
    (query: any) => {
      let q = query;
      if (selectedType !== "all") {
        q = q.ilike("type", selectedType);
      }
      if (selectedModule === "equipment") {
        q = q.or(
          "action.ilike.%equipment%,details.ilike.%equipment%,target.ilike.%equipment%,action.ilike.%restock%,details.ilike.%restock:%,details.ilike.%allocated supplies%,details.ilike.%reserved equipment%,action.ilike.%inventory%,details.ilike.%inventory%"
        );
      } else if (selectedModule === "booking") {
        q = q.or("action.ilike.%booking%,details.ilike.%booking%");
      } else if (selectedModule === "package") {
        q = q.or(
          "action.ilike.%package%,action.ilike.%inclusion%,details.ilike.%package%,details.ilike.%inclusion%"
        );
      } else if (selectedModule === "menu") {
        q = q.or(
          "action.ilike.%menu%,action.ilike.%dish%,details.ilike.%menu%,details.ilike.%dish%"
        );
      } else if (selectedModule === "system") {
        q = q.or(
          "action.ilike.%user%,action.ilike.%profile%,action.ilike.%cms%,action.ilike.%setting%"
        );
      }
      const cleanTerm = debouncedSearch.replace(/[,()]/g, " ").trim();
      if (cleanTerm) {
        const numericClause = /^\d+$/.test(cleanTerm) ? `,id.eq.${cleanTerm}` : "";
        q = q.or(
          `user_name.ilike.%${cleanTerm}%,action.ilike.%${cleanTerm}%,target.ilike.%${cleanTerm}%,type.ilike.%${cleanTerm}%,details.ilike.%${cleanTerm}%${numericClause}`
        );
      }
      return q;
    },
    [selectedType, selectedModule, debouncedSearch]
  );

  const fetchLogs = useCallback(
    async (cursorId: number | null = null, append = false) => {
      if (!append) setIsLoading(true);
      else setIsLoadingMore(true);

      try {
        let query = supabase
          .from("audit_logs")
          .select("id, action, target, type, details, user_name, created_at", {
            count: "exact",
          })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);

        query = applyServerFilters(query);

        if (append && cursorId !== null) {
          query = query.lt("id", cursorId);
        }

        const { data, count, error } = await query;

        if (error) {
          console.error("Error fetching audit logs:", error);
          return;
        }

        if (typeof count === "number") {
          setTotalCount(count);
        }

        const rows = data || [];
        setHasMore(rows.length === PAGE_SIZE);

        setLogs((prev) => {
          const next = append
            ? (() => {
                const seen = new Set(prev.map((l) => l.id));
                return [...prev, ...rows.filter((r) => !seen.has(r.id))];
              })()
            : rows;
          if (next.length > 0) {
            maxLoadedIdRef.current = Math.max(...next.map((l) => Number(l.id) || 0));
            oldestLoadedIdRef.current = Number(next[next.length - 1].id);
          } else if (!append) {
            maxLoadedIdRef.current = 0;
            oldestLoadedIdRef.current = null;
          }
          return next;
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [applyServerFilters]
  );

  const fetchNewInsertedLogs = useCallback(async () => {
    if (maxLoadedIdRef.current <= 0) {
      fetchLogs(null, false);
      return;
    }
    try {
      let query = supabase
        .from("audit_logs")
        .select("id, action, target, type, details, user_name, created_at")
        .gt("id", maxLoadedIdRef.current)
        .order("id", { ascending: false })
        .limit(20);

      query = applyServerFilters(query);
      const { data, error } = await query;
      if (error || !data || data.length === 0) return;

      setLogs((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        const fresh = data.filter((r) => !seen.has(r.id));
        if (fresh.length === 0) return prev;
        const merged = [...fresh, ...prev];
        maxLoadedIdRef.current = Math.max(...merged.map((l) => Number(l.id) || 0));
        setTotalCount((c) => c + fresh.length);
        return merged;
      });
    } catch {}
  }, [applyServerFilters, fetchLogs]);

  useEffect(() => {
    fetchLogs(null, false);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeAuditBroadcast((payload) => {
      if (payload.action === "insert") {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchNewInsertedLogs();
        }, 300);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [fetchLogs, fetchNewInsertedLogs]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && oldestLoadedIdRef.current !== null) {
      fetchLogs(oldestLoadedIdRef.current, true);
    }
  };

  const csvCell = (raw: unknown): string => {
    const str = String(raw ?? "");
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const handleDownloadArchive = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["ID", "Timestamp", "User", "Type", "Action", "Target", "Details"];
    const rows = filteredLogs.map((l) => [
      csvCell(l.id),
      csvCell(l.created_at || l.timestamp || ""),
      csvCell(l.user_name || l.user || "System"),
      csvCell(l.type || ""),
      csvCell(l.action || ""),
      csvCell(l.target || ""),
      csvCell(l.details || ""),
    ]);
    const csvContent = [headers.map(csvCell).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      {/* Module Filter Pills */}
      <div className="flex sm:flex-wrap items-center gap-1.5 sm:gap-2 border-b border-natural-border pb-2">
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
              type="button"
              aria-label={tab.label}
              title={tab.label}
              onClick={() => setSelectedModule(tab.id)}
              className={cn(
                "whitespace-nowrap flex items-center gap-1.5 sm:gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                isActive
                  ? "shrink-0 px-3 sm:px-4 bg-natural-accent text-white shadow-sm"
                  : "flex-1 sm:flex-initial justify-center px-2 sm:px-4 bg-white border border-natural-border text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className={cn(!isActive && "hidden sm:inline")}>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-bold",
                    !isActive && "hidden sm:inline-flex",
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
        <div className="p-4 border-b border-natural-border flex flex-col xl:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search by user, action, target, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
            </div>

            <div className="flex items-center gap-2 px-3 py-2 border border-natural-border rounded-lg bg-white w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-natural-text-main shrink-0" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full sm:w-auto text-xs font-bold text-natural-text-main bg-transparent outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="all">All Event Types</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="system">System</option>
              </select>
            </div>

            <span className="text-xs font-semibold text-natural-text-light whitespace-nowrap">
              Showing {filteredLogs.length}{totalCount > filteredLogs.length ? ` of ${totalCount}` : ""} record{filteredLogs.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full xl:w-auto xl:justify-end">
            <button
              onClick={() => fetchLogs(null, false)}
              disabled={isLoading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-all uppercase tracking-widest cursor-pointer"
              title="Refresh logs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={handleDownloadArchive}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-natural-sidebar text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-sidebar/90 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download Audit Archive
            </button>
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
                  key={log.id}
                  className="p-4 sm:p-6 hover:bg-natural-bg/10 transition-colors flex flex-col md:flex-row md:items-start gap-4"
                >
                  <div className="flex items-center gap-4 shrink-0 w-full md:w-64">
                    <div
                      className={cn(
                        "p-3 rounded-xl border",
                        log.type === "Update"
                          ? "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-950/50 dark:border-blue-800/60 dark:text-blue-300"
                          : log.type === "Create"
                            ? "bg-green-50 border-green-100 text-green-600 dark:bg-emerald-950/50 dark:border-emerald-800/60 dark:text-emerald-300"
                            : log.type === "Delete"
                              ? "bg-red-50 border-red-100 text-red-600 dark:bg-red-950/50 dark:border-red-800/60 dark:text-red-300"
                              : "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/50 dark:border-amber-800/60 dark:text-amber-300",
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
                      <p className="text-xs font-bold text-natural-text-main uppercase tracking-wider leading-none mb-1">
                        {log.type}
                      </p>
                      <p className="text-xs font-semibold text-natural-text-light uppercase tracking-wider">
                        ID: LOG-{log.id?.toString().padStart(5, "0")}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-base font-bold text-natural-text-main tracking-normal leading-snug">
                          {log.action?.replace(/inventory/gi, (m: string) => m[0] === 'I' ? 'Equipment' : 'equipment')}
                        </h4>
                        <p className="text-xs text-natural-text-light font-medium mt-1 break-words">
                          Target:{" "}
                          <span className="text-natural-text-main font-semibold">
                            {log.target?.replace(/inventory/gi, (m: string) => m[0] === 'I' ? 'Equipment' : 'equipment')}
                          </span>
                        </p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-sm font-bold text-natural-text-main tracking-normal">
                          {format(logDate, "hh:mm a")}
                        </p>
                        <p className="text-xs font-medium text-natural-text-light tracking-normal mt-0.5">
                          {format(logDate, "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    <div className="bg-natural-bg border border-natural-border px-4 py-3 rounded-lg mt-3 flex items-start gap-3">
                      <div className="w-1 h-8 bg-natural-border rounded-full shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider mb-1">
                          Administrative Changes
                        </p>
                        <p className="text-sm font-medium text-natural-text-main leading-relaxed">
                          "{log.details?.replace(/inventory/gi, (m: string) => m[0] === 'I' ? 'Equipment' : 'equipment')}"
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-48 pt-1 flex md:flex-col items-center md:items-end justify-between md:justify-start gap-3">
                    <div className="flex items-center gap-2 text-right">
                      <div className="text-right hidden md:block">
                        <p className="text-sm font-bold text-natural-text-main leading-snug">
                          {logUser}
                        </p>
                        <p className="text-xs font-semibold text-natural-text-light uppercase tracking-wider mt-0.5">
                          Access Granted
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-natural-sidebar text-[#f8f7f2] flex items-center justify-center text-xs font-bold shrink-0">
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

        {hasMore && logs.length > 0 && (
          <div className="p-4 bg-natural-bg/10 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="text-xs font-bold text-natural-text-light uppercase tracking-wider hover:text-natural-accent transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoadingMore ? "Loading Historical Entries..." : "Load Historical Entries"}
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
