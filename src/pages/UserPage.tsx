import React, { useState, useEffect, useMemo } from "react";
import {
  Send,
  Search,
  UserPlus,
  Filter,
  MoreVertical,
  Mail,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  Archive,
  RotateCcw,
  Edit3,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
  Users,
  AlertCircle,
  RefreshCw,
  Shield,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";
import { useUser } from "../context/UserContext";
import { logAuditAction } from "../utils/auditLogger";

type SortField = "name" | "role" | "created_at" | "status";
type SortOrder = "asc" | "desc" | null;

interface SortConfig {
  field: SortField | null;
  order: SortOrder;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  phone?: string;
  phone_number?: string;
  is_admin_record?: boolean;
}

const BLOCKED_DOMAINS = new Set([
  "example.com", "example.org", "example.net",
  "test.com", "test.org", "testing.com",
  "sample.com", "sample.org",
  "fake.com", "dummy.com", "invalid.com",
  "localhost", "none.com", "mailinator.com",
  "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "yopmail.com", "throwawaymail.com",
  "sharklasers.com", "getairmail.com", "dispostable.com",
  "trashmail.com", "spam4.me", "bccto.me", "chacuo.net"
]);

export function validateAdminEmail(
  email: string,
  existingAdmins: User[]
): { valid: boolean; error?: string } {
  if (!email || !email.trim()) {
    return { valid: false, error: "Email address is required." };
  }

  const clean = email.trim().toLowerCase();

  if (clean.length > 254) {
    return { valid: false, error: "Email address cannot exceed 254 characters." };
  }

  const atParts = clean.split("@");
  if (atParts.length !== 2) {
    return { valid: false, error: "Email address must contain exactly one '@' symbol." };
  }

  const [localPart, domain] = atParts;

  if (!localPart) {
    return { valid: false, error: "Please enter the username before '@'." };
  }
  if (localPart.length > 64) {
    return { valid: false, error: "Username part cannot exceed 64 characters." };
  }
  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return { valid: false, error: "Username part cannot begin or end with a period." };
  }
  if (localPart.includes("..")) {
    return { valid: false, error: "Username cannot contain consecutive periods (..)." };
  }

  if (!domain) {
    return { valid: false, error: "Please enter a domain after '@' (e.g. gmail.com)." };
  }
  if (domain.length < 3) {
    return { valid: false, error: "Domain name is incomplete." };
  }
  if (
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.startsWith("-") ||
    domain.endsWith("-") ||
    domain.includes("..")
  ) {
    return { valid: false, error: "Domain name contains an invalid character placement." };
  }

  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return { valid: false, error: "Domain must include an extension (e.g. .com, .ph, .org)." };
  }

  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-z]{2,24}$/i.test(tld)) {
    return {
      valid: false,
      error: `'.${tld}' is not a valid domain extension. Top-level domains must contain only letters.`,
    };
  }

  const rfcRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!rfcRegex.test(clean)) {
    return {
      valid: false,
      error: "Please provide a valid, properly formatted email address (e.g. name@company.com).",
    };
  }

  if (BLOCKED_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: `Disposable or placeholder domain '@${domain}' is not allowed for administrators.`,
    };
  }

  const isAlreadyAdmin =
    clean === "erica@gmail.com" ||
    existingAdmins.some((a) => (a.email || "").toLowerCase() === clean);

  if (isAlreadyAdmin) {
    return {
      valid: false,
      error: `An administrator account with email '${clean}' already exists.`,
    };
  }

  return { valid: true };
}

export function UserPage() {
  const { currentUser, createAdminUser } = useUser();
  const [activeTab, setActiveTab] = useState<"customers" | "admins">("customers");

  const [customerUsers, setCustomerUsers] = useState<User[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    order: null,
  });

  // Edit / Archive states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [visibleEmails, setVisibleEmails] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<{
    type: "edit" | "archive" | "unarchive";
    userId?: string;
    userName: string;
  } | null>(null);

  // Add Admin Modal states
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdminData, setNewAdminData] = useState({
    name: "",
    email: "",
    role: "Admin",
    phone_number: "",
  });
  const [isSubmittingNewAdmin, setIsSubmittingNewAdmin] = useState(false);
  const [addAdminError, setAddAdminError] = useState("");
  const [addAdminSuccess, setAddAdminSuccess] = useState("");
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  const emailValidation = useMemo(() => {
    if (!newAdminData.email.trim()) return null;
    return validateAdminEmail(newAdminData.email, adminUsers);
  }, [newAdminData.email, adminUsers]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const [profilesRes, adminsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("admins").select("*"),
      ]);

      if (profilesRes.error) {
        console.error("Error fetching profiles:", profilesRes.error.message);
      }
      if (adminsRes.error) {
        console.error("Error fetching admins:", adminsRes.error.message);
      }

      // Process raw profiles
      const rawProfiles = (profilesRes.data || []) as any[];
      const normalizedProfiles = rawProfiles
        .map((row) => {
          const idRaw = row?.id ?? row?.user_id ?? row?.userId ?? null;
          const id =
            typeof idRaw === "string" ? idRaw : idRaw ? String(idRaw) : "";
          if (!id) return null;

          const nameStr = typeof row?.name === "string" ? row.name.trim() : "";
          const fullNameStrs = [
            row?.full_name,
            row?.fullName,
            row?.fullname,
          ].filter((v) => typeof v === "string") as string[];
          const fullNameStr = fullNameStrs.length ? fullNameStrs[0].trim() : "";
          const displayName = nameStr || fullNameStr || "Unnamed Customer";

          return {
            ...(row as Record<string, unknown>),
            id,
            name: displayName,
            email: row?.email || "",
            role: row?.role || "Customer",
            status: row?.status || "Active",
            phone: row?.phone_number ? String(row.phone_number) : row?.phone || "",
            phone_number: row?.phone_number ? String(row.phone_number) : row?.phone || "",
            created_at: row?.created_at || new Date().toISOString(),
          };
        })
        .filter(Boolean) as User[];

      // Process admins from admins table
      const rawAdmins = (adminsRes.data || []) as any[];
      const normalizedAdmins = rawAdmins
        .map((row) => {
          const id = String(row?.id || "");
          if (!id) return null;
          return {
            ...(row as Record<string, unknown>),
            id,
            name: row?.name || row?.full_name || "Unnamed Administrator",
            email: row?.email || "",
            role: row?.role || "Admin",
            status: row?.status || "Active",
            phone: row?.phone_number || "",
            phone_number: row?.phone_number || "",
            created_at: row?.created_at || new Date().toISOString(),
            is_admin_record: true,
          };
        })
        .filter(Boolean) as User[];

      const adminEmails = new Set(normalizedAdmins.map((a) => (a.email || "").toLowerCase()));

      // Include any admin or coordinator profiles found in the profiles table that aren't yet in admins
      rawProfiles.forEach((p) => {
        const role = (p.role || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        if (
          (role === "admin" || role === "coordinator" || role === "owner" || role === "staff") &&
          email &&
          !adminEmails.has(email)
        ) {
          normalizedAdmins.push({
            id: String(p.id),
            name: p.name || p.full_name || "Staff Member",
            email: p.email,
            role: p.role || "Admin",
            status: p.status || "Active",
            phone: p.phone_number ? String(p.phone_number) : "",
            phone_number: p.phone_number ? String(p.phone_number) : "",
            created_at: p.created_at || new Date().toISOString(),
            is_admin_record: false,
          });
          adminEmails.add(email);
        }
      });

      // Always ensure the primary administrator account is registered in the list
      if (!adminEmails.has("erica@gmail.com")) {
        normalizedAdmins.unshift({
          id: "0",
          name: "Kyle Erica Santos",
          email: "erica@gmail.com",
          role: "Admin",
          status: "Active",
          phone: "09467158519",
          phone_number: "09467158519",
          created_at: "2026-04-24T00:00:00.000Z",
          is_admin_record: true,
        });
        adminEmails.add("erica@gmail.com");
      }

      // Filter customers (strictly excluding admin/staff accounts and root admin id "0")
      const pureCustomers = normalizedProfiles.filter((u) => {
        const role = (u.role || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        if (
          String(u.id) === "0" ||
          email === "erica@gmail.com"
        ) {
          return false;
        }
        if (role === "admin" || role === "owner" || role === "coordinator" || role === "staff") {
          return false;
        }
        return true;
      });

      setCustomerUsers(pureCustomers);
      setAdminUsers(normalizedAdmins);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const toggleEmailVisibility = (id: string) => {
    setVisibleEmails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const censorEmail = (email: string, isVisible: boolean) => {
    if (!email) return "";
    if (isVisible) return email;
    const [name, domain] = email.split("@");
    if (!name || !domain) return email;
    return `${name[0]}${"*".repeat(Math.min(name.length - 1, 5))}@${domain}`;
  };

  const handleSort = (field: SortField) => {
    let order: SortOrder = "asc";
    if (sortConfig.field === field && sortConfig.order === "asc") {
      order = "desc";
    } else if (sortConfig.field === field && sortConfig.order === "desc") {
      order = null;
    }
    setSortConfig({ field: order ? field : null, order });
  };

  const currentDataset = activeTab === "customers" ? customerUsers : adminUsers;

  const filteredUsers = useMemo(() => {
    return currentDataset.filter((user) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (user.name || "").toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        (user.role || "").toLowerCase().includes(query) ||
        (user.phone_number || user.phone || "").toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "All Roles" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "All Status"
          ? user.status !== "Archived"
          : user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [currentDataset, searchQuery, roleFilter, statusFilter]);

  const sortedUsers = useMemo(() => {
    if (!sortConfig.field || !sortConfig.order) return filteredUsers;

    return [...filteredUsers].sort((a, b) => {
      const { field, order } = sortConfig;
      let valA = a[field as keyof User];
      let valB = b[field as keyof User];

      if (field === "created_at") {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return order === "asc" ? dateA - dateB : dateB - dateA;
      }

      const stringA = String(valA || "").toLowerCase();
      const stringB = String(valB || "").toLowerCase();

      if (stringA < stringB) return order === "asc" ? -1 : 1;
      if (stringA > stringB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortConfig]);

  const handleArchiveClick = (id: string, name: string) => {
    setConfirmAction({
      type: "archive",
      userId: id,
      userName: name,
    });
  };

  const handleUnarchiveClick = (id: string, name: string) => {
    setConfirmAction({
      type: "unarchive",
      userId: id,
      userName: name,
    });
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setIsModalOpen(true);
  };

  const handleConfirmSave = () => {
    setIsModalOpen(false);
    setConfirmAction({
      type: "edit",
      userId: editingUser?.id,
      userName: formData.name || "User",
    });
  };

  const handleExecuteAction = async () => {
    if (!confirmAction) return;

    const isAdminUser =
      activeTab === "admins" ||
      editingUser?.role === "Admin" ||
      editingUser?.role === "Coordinator" ||
      editingUser?.role === "Staff";

    if (confirmAction.type === "edit" && confirmAction.userId) {
      const trimmedName = (formData.name ?? "").toString().trim();
      const trimmedPhone = (formData.phone_number ?? formData.phone ?? "").toString().trim();

      if (isAdminUser && confirmAction.userId !== "0") {
        await supabase
          .from("admins")
          .update({
            name: trimmedName,
            role: formData.role,
            status: formData.status,
            phone_number: trimmedPhone || null,
          })
          .eq("id", confirmAction.userId);
      }

      if (confirmAction.userId !== "0") {
        await supabase
          .from("profiles")
          .update({
            name: trimmedName,
            role: formData.role,
            status: formData.status,
            phone_number: trimmedPhone ? parseInt(trimmedPhone.replace(/\D/g, ""), 10) || null : null,
          })
          .eq("id", confirmAction.userId);
      }

      await logAuditAction({
        action: isAdminUser ? "Updated Administrator Profile" : "Updated User Profile",
        target: trimmedName || confirmAction.userName,
        type: "Update",
        details: `Modified role (${formData.role}) or status (${formData.status})`,
      });
    } else if (confirmAction.type === "archive" && confirmAction.userId) {
      if (isAdminUser && confirmAction.userId !== "0") {
        await supabase
          .from("admins")
          .update({ status: "Archived" })
          .eq("id", confirmAction.userId);
      }

      if (confirmAction.userId !== "0") {
        await supabase
          .from("profiles")
          .update({ status: "Archived" })
          .eq("id", confirmAction.userId);
      }

      await logAuditAction({
        action: isAdminUser ? "Archived Administrator Account" : "Archived User Account",
        target: confirmAction.userName,
        type: "Delete",
        details: `Archived user account and restricted access`,
      });
    } else if (confirmAction.type === "unarchive" && confirmAction.userId) {
      if (isAdminUser && confirmAction.userId !== "0") {
        await supabase
          .from("admins")
          .update({ status: "Active" })
          .eq("id", confirmAction.userId);
      }

      if (confirmAction.userId !== "0") {
        await supabase
          .from("profiles")
          .update({ status: "Active" })
          .eq("id", confirmAction.userId);
      }

      await logAuditAction({
        action: isAdminUser ? "Restored Administrator Account" : "Unarchived User Account",
        target: confirmAction.userName,
        type: "Update",
        details: `Restored account to Active status`,
      });
    }

    await fetchUsers();
    setConfirmAction(null);
    setFormData({});
  };

  const handleResendInvite = async (user: User) => {
    setResendingEmail(user.email);
    try {
      const res = await createAdminUser({
        name: user.name,
        email: user.email,
        role: user.role,
        action: "resend_invite",
      });

      if (res.success) {
        await logAuditAction({
          action: "Resent Administrator Invitation",
          target: `${user.name} (${user.email})`,
          type: "Update",
          details: `Resent invite for role: ${user.role}`,
        });
        alert(`Invitation link successfully resent to ${user.email}!`);
      } else {
        alert(res.error || "Failed to resend invitation.");
      }
    } catch (err: any) {
      alert(err?.message || "Error resending invitation.");
    } finally {
      setResendingEmail(null);
    }
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminError("");
    setAddAdminSuccess("");

    if (!newAdminData.name.trim()) {
      setAddAdminError("Full name is required.");
      return;
    }

    const emailCheck = validateAdminEmail(newAdminData.email, adminUsers);
    if (!emailCheck.valid) {
      setAddAdminError(emailCheck.error || "Please enter a valid, real email address.");
      return;
    }

    setIsSubmittingNewAdmin(true);
    try {
      const res = await createAdminUser({
        name: newAdminData.name.trim(),
        email: newAdminData.email.trim().toLowerCase(),
        role: newAdminData.role,
        phone_number: newAdminData.phone_number.trim() || undefined,
        action: "invite",
      });

      if (!res.success) {
        setAddAdminError(res.error || "Failed to send administrator invitation.");
        setIsSubmittingNewAdmin(false);
        return;
      }

      await logAuditAction({
        action: "Sent Administrator Invitation",
        target: `${newAdminData.name.trim()} (${newAdminData.email.trim().toLowerCase()})`,
        type: "Create",
        details: `Assigned role: ${newAdminData.role}`,
      });

      setAddAdminSuccess(
        res.message || `Invitation link successfully sent to ${newAdminData.email.trim().toLowerCase()}!`
      );
      await fetchUsers();

      setTimeout(() => {
        setIsAddAdminModalOpen(false);
        setNewAdminData({
          name: "",
          email: "",
          role: "Admin",
          phone_number: "",
        });
        setAddAdminSuccess("");
      }, 1500);
    } catch (err: any) {
      setAddAdminError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingNewAdmin(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1.5 opacity-30" />;
    return sortConfig.order === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1.5 text-natural-accent" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1.5 text-natural-accent" />
    );
  };

  const isProtectedAccount = (user: User) => {
    const email = (user.email || "").toLowerCase();
    return (
      String(user.id) === String(currentUser?.id) ||
      String(user.id) === "0" ||
      email === "erica@gmail.com"
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            User Management
          </h2>
          <p className="text-natural-text-light text-xs font-medium uppercase tracking-wider">
            Manage your registered clients and dashboard administrators
          </p>
        </div>

        {/* Add Admin CTA Button (shown on top when on Admins tab) */}
        {activeTab === "admins" && (
          <button
            onClick={() => {
              setAddAdminError("");
              setAddAdminSuccess("");
              setIsAddAdminModalOpen(true);
            }}
            className="px-4 py-2.5 bg-natural-accent hover:bg-natural-accent/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer whitespace-nowrap self-start md:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Admin User</span>
          </button>
        )}
      </div>

      {/* Tabs Switcher: Customers vs Administrators & Staff */}
      <div className="flex items-center gap-2 border-b border-natural-border">
        <button
          onClick={() => {
            setActiveTab("customers");
            setRoleFilter("All Roles");
            setStatusFilter("All Status");
            setSearchQuery("");
          }}
          className={cn(
            "flex items-center gap-2.5 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === "customers"
              ? "border-natural-accent text-natural-accent bg-natural-accent/5"
              : "border-transparent text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Customers</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-natural-border/70 text-natural-text-main font-semibold">
            {customerUsers.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("admins");
            setRoleFilter("All Roles");
            setStatusFilter("All Status");
            setSearchQuery("");
          }}
          className={cn(
            "flex items-center gap-2.5 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === "admins"
              ? "border-natural-accent text-natural-accent bg-natural-accent/5"
              : "border-transparent text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50"
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Administrators &amp; Staff</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30">
            {adminUsers.length}
          </span>
        </button>
      </div>

      <div className="glass-card bg-white overflow-hidden">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder={
                activeTab === "customers"
                  ? "Search clients by name, email, phone..."
                  : "Search admins by name, email, role..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider shadow-xs"
            >
              <option>All Roles</option>
              {activeTab === "customers" ? (
                <option>Customer</option>
              ) : (
                <>
                  <option>Admin</option>
                  <option>Coordinator</option>
                  <option>Staff</option>
                </>
              )}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider shadow-xs"
            >
              <option>All Status</option>
              <option>Active</option>
              {activeTab === "admins" && <option value="Pending Invite">Pending Invite</option>}
              <option>Inactive</option>
              <option>Archived</option>
            </select>

            {activeTab === "admins" && (
              <button
                onClick={() => {
                  setAddAdminError("");
                  setAddAdminSuccess("");
                  setIsAddAdminModalOpen(true);
                }}
                className="md:hidden px-3 py-2 bg-natural-accent hover:bg-natural-accent/90 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ml-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Admin</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-natural-bg/30">
                <th
                  className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    User Info <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                  onClick={() => handleSort("role")}
                >
                  <div className="flex items-center">
                    Role <SortIcon field="role" />
                  </div>
                </th>
                <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border">
                  Contact
                </th>
                <th
                  className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                  onClick={() => handleSort("created_at")}
                >
                  <div className="flex items-center">
                    Date Joined <SortIcon field="created_at" />
                  </div>
                </th>
                <th
                  className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status <SortIcon field="status" />
                  </div>
                </th>
                <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => {
                const isProtected = isProtectedAccount(user);

                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "transition-colors group",
                      user.status === "Archived"
                        ? "bg-natural-bg/40 opacity-60 grayscale-[0.5]"
                        : "hover:bg-natural-bg/20"
                    )}
                  >
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-sm shrink-0 border",
                            activeTab === "admins"
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                              : "bg-natural-accent/10 border-natural-accent/20 text-natural-accent"
                          )}
                        >
                          {user.name
                            ? user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                            : "U"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-bold text-natural-text-main tracking-normal leading-snug">
                              {user.name || "Unnamed User"}
                            </p>
                            {isProtected && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-natural-border/70 text-natural-text-light"
                                title="Primary or Active Session Account"
                              >
                                Current / Root
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-natural-text-light font-medium flex items-center gap-1.5 mt-1 tracking-normal">
                            <Mail className="w-3.5 h-3.5 text-natural-accent/70 shrink-0" />{" "}
                            <span>{censorEmail(user.email, !!visibleEmails[user.id])}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md inline-flex items-center gap-1 border",
                          user.role === "Admin" || user.role === "Owner"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                            : user.role === "Coordinator"
                              ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                              : "bg-natural-sidebar/5 text-natural-sidebar border-natural-border"
                        )}
                      >
                        {(user.role === "Admin" || user.role === "Owner") && (
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                        )}
                        {user.role || "Unassigned"}
                      </span>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div className="space-y-1">
                        <p className="text-xs text-natural-text-light font-medium flex items-center gap-1.5 tracking-normal">
                          <Phone className="w-3.5 h-3.5 text-natural-accent/70 shrink-0" />{" "}
                          <span>{user.phone_number || user.phone || "No phone"}</span>
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div className="space-y-1">
                        <p className="text-xs text-natural-text-light font-medium flex items-center gap-1.5 tracking-normal">
                          <Calendar className="w-3.5 h-3.5 text-natural-accent/70 shrink-0" /> Joined{" "}
                          <span>
                            {user.created_at
                              ? new Date(user.created_at).toLocaleDateString()
                              : "Unknown"}
                          </span>
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md border shadow-2xs inline-flex items-center gap-1.5",
                          user.status === "Active"
                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                            : user.status === "Pending Invite"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60"
                              : user.status === "Archived"
                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60"
                                : "bg-natural-text-light/5 text-natural-text-light border-natural-border dark:bg-natural-bg/40 dark:border-natural-border/60"
                        )}
                      >
                        {user.status === "Pending Invite" && <Mail className="w-3 h-3 shrink-0" />}
                        {user.status === "Pending Invite" ? "Pending Invite" : (user.status || "Unknown")}
                      </span>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50 text-right">
                      <div className="flex items-center justify-end gap-2 min-h-[32px]">
                        <button
                          onClick={() => toggleEmailVisibility(user.id)}
                          className="p-2 text-natural-text-light hover:text-natural-text-main hover:bg-white hover:shadow-xs rounded-lg transition-all cursor-pointer"
                          title={
                            visibleEmails[user.id] ? "Hide Email" : "Show Email"
                          }
                        >
                          {visibleEmails[user.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>

                        {user.status !== "Archived" ? (
                          <>
                            {activeTab === "admins" && user.status === "Pending Invite" && (
                              <button
                                onClick={() => handleResendInvite(user)}
                                disabled={resendingEmail === user.email}
                                className="p-2 text-natural-accent hover:text-white hover:bg-natural-accent hover:shadow-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                title="Resend Invitation Email"
                              >
                                <Send className={cn("w-4 h-4", resendingEmail === user.email && "animate-pulse")} />
                              </button>
                            )}

                            <button
                              onClick={() => handleEditClick(user)}
                              className="p-2 text-natural-text-light hover:text-natural-text-main hover:bg-white hover:shadow-xs rounded-lg transition-all cursor-pointer"
                              title="Edit User"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {isProtected ? (
                              <span
                                className="p-2 text-natural-text-light/40 cursor-not-allowed"
                                title="Root / Active user account is protected from archival"
                              >
                                <Lock className="w-4 h-4" />
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  handleArchiveClick(user.id, user.name || "User")
                                }
                                className="p-2 text-natural-text-light hover:text-red-500 hover:bg-white hover:shadow-xs rounded-lg transition-all cursor-pointer"
                                title="Archive User"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              handleUnarchiveClick(user.id, user.name || "User")
                            }
                            className="flex items-center gap-1 px-2.5 py-1 text-natural-accent hover:text-white hover:bg-natural-accent border border-natural-accent/30 rounded-lg transition-all text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
                            title="Unarchive User"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sortedUsers.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-natural-text-light font-serif italic">
                {activeTab === "customers"
                  ? "No customers found matching your criteria"
                  : "No administrators found matching your criteria"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-6 border-b border-natural-border flex items-center justify-between bg-natural-bg/10">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                {activeTab === "admins" ? "Edit Administrator Profile" : "Edit Customer Profile"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-natural-border shadow-xs cursor-pointer"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
                  placeholder="e.g. Juan Luna"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email || ""}
                    disabled={true}
                    className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs disabled:opacity-50"
                    placeholder="name@example.com"
                  />
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-natural-text-light" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.phone_number || formData.phone || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone_number: e.target.value,
                        phone: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
                    placeholder="09123456789"
                  />
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-natural-text-light" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                    User Role
                  </label>
                  <select
                    value={formData.role || (activeTab === "admins" ? "Admin" : "Customer")}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    disabled={String(editingUser?.id) === String(currentUser?.id)}
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeTab === "admins" ? (
                      <>
                        <option value="Admin">Admin</option>
                        <option value="Coordinator">Coordinator</option>
                        <option value="Staff">Staff</option>
                      </>
                    ) : (
                      <option value="Customer">Customer</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                    Status
                  </label>
                  <select
                    value={formData.status || "Active"}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    disabled={String(editingUser?.id) === String(currentUser?.id)}
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/10 border-t border-natural-border flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white transition-all shadow-xs cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Administrator Modal */}
      {isAddAdminModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-6 border-b border-natural-border flex items-center justify-between bg-natural-bg/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-natural-accent/10 border border-natural-accent/20 flex items-center justify-center text-natural-accent">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-natural-text-main">
                    Add Administrator / Staff
                  </h3>
                  <p className="text-xs text-natural-text-light">
                    Create credentials to access the admin portal
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddAdminModalOpen(false);
                  setAddAdminError("");
                  setAddAdminSuccess("");
                }}
                className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-natural-border shadow-xs cursor-pointer"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>

            <form onSubmit={handleCreateAdminSubmit} className="p-6 space-y-4">

              {addAdminError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addAdminError}</span>
                </div>
              )}

              {addAdminSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{addAdminSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAdminData.name}
                  onChange={(e) =>
                    setNewAdminData({ ...newAdminData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
                  placeholder="e.g. Maria Santos"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                  Email Address *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={newAdminData.email}
                    onChange={(e) => {
                      setNewAdminData({ ...newAdminData, email: e.target.value });
                      if (addAdminError) setAddAdminError("");
                    }}
                    className={cn(
                      "w-full pl-10 pr-4 py-2.5 bg-natural-bg/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all shadow-xs",
                      emailValidation
                        ? emailValidation.valid
                          ? "border-emerald-500/50 focus:ring-emerald-500/10 focus:border-emerald-500"
                          : "border-red-500/60 focus:ring-red-500/10 focus:border-red-500"
                        : "border-natural-border focus:ring-natural-accent/10 focus:bg-white"
                    )}
                    placeholder="e.g. maria.santos@gmail.com"
                  />
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-natural-text-light" />
                </div>
                {emailValidation && (
                  <p
                    className={cn(
                      "text-[11px] font-medium pl-1 flex items-center gap-1.5 transition-colors",
                      emailValidation.valid
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                    )}
                  >
                    {emailValidation.valid ? (
                      <>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Valid email format</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{emailValidation.error}</span>
                      </>
                    )}
                  </p>
                )}
                {!emailValidation && (
                  <p className="text-[10px] text-natural-text-light pl-1">
                    Must be an active, real email address with a valid domain (e.g. name@gmail.com).
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-sky-500/10 border border-sky-500/25 rounded-xl text-xs text-sky-800 dark:text-sky-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  Official Email Verification Link
                </p>
                <p className="text-[11px] text-natural-text-light leading-relaxed">
                  An activation link will be sent directly to this address. The recipient must open the email to verify their inbox and set their personal password to activate the account.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                    Role *
                  </label>
                  <select
                    value={newAdminData.role}
                    onChange={(e) =>
                      setNewAdminData({ ...newAdminData, role: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs cursor-pointer font-medium"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Coordinator">Coordinator</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newAdminData.phone_number}
                      onChange={(e) =>
                        setNewAdminData({
                          ...newAdminData,
                          phone_number: e.target.value,
                        })
                      }
                      className="w-full pl-9 pr-3 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
                      placeholder="09123456789"
                    />
                    <Phone className="absolute left-3 top-3 w-3.5 h-3.5 text-natural-text-light" />
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  Administrative Safeguard
                </p>
                <p className="text-[11px] text-natural-text-light leading-relaxed">
                  The account will remain in <strong className="text-amber-700 dark:text-amber-300">Pending Invite</strong> until verified by the email owner. If the email address does not exist, it will bounce and cannot access the dashboard.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  disabled={isSubmittingNewAdmin}
                  onClick={() => {
                    setIsAddAdminModalOpen(false);
                    setAddAdminError("");
                    setAddAdminSuccess("");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-natural-bg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewAdmin || (emailValidation !== null && !emailValidation.valid)}
                  className="flex-1 bg-natural-accent text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingNewAdmin ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending Invite...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Invite Link
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Edit / Archive / Unarchive */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-8 text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0",
                  confirmAction.type === "edit"
                    ? "bg-natural-accent shadow-natural-accent/20"
                    : confirmAction.type === "unarchive"
                      ? "bg-emerald-600 shadow-emerald-200"
                      : "bg-red-600 shadow-red-200"
                )}
              >
                {confirmAction.type === "edit" && (
                  <Edit3 className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "archive" && (
                  <Archive className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "unarchive" && (
                  <RotateCcw className="w-8 h-8 text-white" />
                )}
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                {confirmAction.type === "edit"
                  ? "Save Changes?"
                  : confirmAction.type === "unarchive"
                    ? "Restore Account?"
                    : "Archive Account?"}
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                {confirmAction.type === "edit" ? (
                  <>
                    You are about to update the profile details for{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.userName}
                    </span>
                    . Continue?
                  </>
                ) : confirmAction.type === "unarchive" ? (
                  <>
                    This will restore{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.userName}
                    </span>
                    's account back to Active status, allowing them to access the platform.
                  </>
                ) : (
                  <>
                    This will move{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.userName}
                    </span>{" "}
                    to the archives. They will no longer be able to access the dashboard.
                  </>
                )}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleExecuteAction}
                  className={cn(
                    "w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-inherit cursor-pointer",
                    confirmAction.type === "edit"
                      ? "bg-natural-accent hover:bg-natural-accent/90"
                      : confirmAction.type === "unarchive"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                  )}
                >
                  Confirm {confirmAction.type}
                </button>

                <button
                  onClick={() => setConfirmAction(null)}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all active:scale-[0.98] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
