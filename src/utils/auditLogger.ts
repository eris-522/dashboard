import { supabase } from "./supabase";

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        userName = profile?.name || user.email || "Admin User";
      } else {
        userName = "System";
      }
    }

    const { error } = await supabase.from("audit_logs").insert([
      {
        ...data,
        user_name: userName,
      },
    ]);

    if (error) {
      console.error("Audit log insert error:", error.message);
    }
  } catch (error) {
    console.error("Failed to log audit action:", error);
  }
};
