import React, { useState, useEffect } from "react";
import { Activity, Shield, Database, Plus, Clock, ChevronRight, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "../utils/supabase";
import { cn } from "../lib/utils";

export interface AuditLogItem {
  id: number;
  action: string;
  target: string;
  type: "Create" | "Update" | "Delete" | "System" | string;
  details: string;
  user_name?: string;
  created_at: string;
}

/**
 * Displays a real-time chronological list of recent system changes and administrative actions.
 */
export function RecentActivities({ onViewLogs }: { onViewLogs?: () => void }) {
  const [activities, setActivities] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecentLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        console.error("Error fetching recent audit logs:", error);
      } else if (data) {
        setActivities(data);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentLogs();

    // Set up real-time listener for audit log additions
    const channel = supabase
      .channel("recent-activities-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        () => {
          fetchRecentLogs();
        }
      )
      .subscribe();

    const handleCustomLog = () => {
      fetchRecentLogs();
    };

    window.addEventListener("auditLogged", handleCustomLog);
    window.addEventListener("markAdminNotifRead", handleCustomLog);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("auditLogged", handleCustomLog);
      window.removeEventListener("markAdminNotifRead", handleCustomLog);
    };
  }, []);

  const formatRelativeTime = (timestampStr: string) => {
    try {
      const date = new Date(timestampStr);
      if (isNaN(date.getTime())) return "Recently";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return "Recently";
    }
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col bg-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif flex items-center gap-2">
            <History className="w-4 h-4 text-natural-accent" />
            Recent Audit Trail
          </h3>
          <p className="text-[0.7rem] text-natural-text-light font-medium uppercase tracking-wider">
            Live administrative & system actions
          </p>
        </div>
        <button
          onClick={onViewLogs}
          className="text-[0.7rem] font-bold text-natural-accent hover:underline flex items-center uppercase tracking-widest cursor-pointer"
        >
          View All <ChevronRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>

      <div className="flex-1 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-natural-text-light">
            <div className="w-6 h-6 border-2 border-natural-accent border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-serif italic">Loading live audit trail...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-natural-text-light opacity-50">
            <Activity className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-[0.75rem] font-serif italic">No recent system activities</p>
            <p className="text-[0.65rem] uppercase tracking-wider mt-1">Actions across the dashboard will appear here</p>
          </div>
        ) : (
          activities.map((activity) => {
            const userName = activity.user_name || "Admin User";
            const userInitial = userName === "System" ? "S" : userName.charAt(0).toUpperCase();

            return (
              <div key={activity.id} className="relative pl-6 pb-3.5 last:pb-0 group">
                {/* Timeline connector & dot */}
                <div
                  className={cn(
                    "absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs z-10",
                    activity.type === "Create"
                      ? "bg-green-500 ring-2 ring-green-100"
                      : activity.type === "Update"
                        ? "bg-blue-500 ring-2 ring-blue-100"
                        : activity.type === "Delete"
                          ? "bg-red-500 ring-2 ring-red-100"
                          : "bg-amber-500 ring-2 ring-amber-100"
                  )}
                />

                <div className="flex flex-col bg-natural-bg/30 hover:bg-natural-bg/70 p-2.5 rounded-xl border border-natural-border/40 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-natural-text-main">
                        {userName}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border",
                          activity.type === "Create"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : activity.type === "Update"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : activity.type === "Delete"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {activity.type}
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold text-natural-text-light shrink-0">
                      {formatRelativeTime(activity.created_at)}
                    </span>
                  </div>

                  <p className="text-[11px] text-natural-text-main font-medium leading-snug">
                    <span className="font-semibold">{activity.action}</span>
                    {activity.target && (
                      <span className="text-natural-accent font-bold ml-1">
                        "{activity.target}"
                      </span>
                    )}
                  </p>

                  {activity.details && (
                    <p className="text-[10px] text-natural-text-light line-clamp-1 italic mt-1 pl-1 border-l-2 border-natural-border">
                      {activity.details}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onViewLogs}
        className="mt-6 py-2.5 w-full bg-natural-bg hover:bg-natural-border/60 border border-natural-border rounded-xl text-[0.7rem] font-bold text-natural-text-main transition-all uppercase tracking-widest shadow-xs cursor-pointer"
      >
        View Full System Audit Trail
      </button>
    </div>
  );
}
