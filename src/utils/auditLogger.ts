import { supabase } from "./supabase";
import { broadcastAuditChange } from "./liveBroadcast";

export interface AuditLogData {
  action: string;
  target: string;
  type: "Create" | "Update" | "Delete" | "System";
  details: string;
  user_name?: string;
}

export const logAuditAction = async (data: AuditLogData) => {
  try {
    let userName = data.user_name;

    if (!userName) {
      // Read cached admin identity from sessionStorage first (avoids 2 extra Auth + DB round-trips per log!)
      try {
        const cachedAdmin = sessionStorage.getItem("rp_admin_current_user");
        if (cachedAdmin) {
          const parsed = JSON.parse(cachedAdmin);
          if (parsed?.name || parsed?.email) {
            userName = parsed.name || parsed.email;
          }
        }
      } catch {}

      if (!userName) {
        const { data: sessionData } = await supabase.auth.getSession();
        userName = sessionData?.session?.user?.email || "Admin User";
      }
    }

    const { data: insertedRows, error } = await supabase
      .from("audit_logs")
      .insert([
        {
          ...data,
          user_name: userName,
        },
      ])
      .select()
      .limit(1);

    if (error) {
      console.error("Audit log insert error:", error.message);
    } else {
      const inserted = insertedRows?.[0] || {
        ...data,
        user_name: userName,
        created_at: new Date().toISOString(),
      };
      window.dispatchEvent(
        new CustomEvent("auditLogged", {
          detail: inserted,
        }),
      );
      broadcastAuditChange("insert", inserted);
    }
  } catch (error) {
    console.error("Failed to log audit action:", error);
  }
};
