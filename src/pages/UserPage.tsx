import React, { useState, useEffect, useMemo } from "react";
import {
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
  Edit3,
  Trash2,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";

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
}

export function UserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    order: null,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<
    Partial<User> & { password?: string }
  >({});
  const [isCensored, setIsCensored] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{
    type: "create" | "edit" | "archive";
    userId?: string;
    userName: string;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from("profiles").select("*");

    if (error) {
      console.error("Error fetching users:", error.message);
      return;
    }

    if (data) {
      setUsers(data as User[]);
    }
  };

  const censorEmail = (email: string) => {
    if (!email) return "";
    if (!isCensored) return email;
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

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        (user.name || "").toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        (user.role || "").toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "All Roles" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "All Status" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

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

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setIsModalOpen(true);
  };

  const handleConfirmSave = () => {
    setIsModalOpen(false);
    setConfirmAction({
      type: editingUser ? "edit" : "create",
      userId: editingUser?.id,
      userName: formData.name || "New User",
    });
  };

  const handleExecuteAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "create") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email || "",
        password: formData.password || "",
        options: {
          data: {
            full_name: formData.name,
          },
        },
      });

      if (signUpError) {
        console.error("Error creating user auth:", signUpError.message);
      } else if (data?.user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          email: formData.email,
          name: formData.name,
          role: formData.role || "Staff",
          status: formData.status || "Active",
        });
        if (profileError)
          console.error("Error saving profile:", profileError.message);
      }
    } else if (confirmAction.type === "edit" && confirmAction.userId) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          role: formData.role,
          status: formData.status,
        })
        .eq("id", confirmAction.userId);
      if (updateError)
        console.error("Error updating profile:", updateError.message);
    } else if (confirmAction.type === "archive" && confirmAction.userId) {
      const { error: archiveError } = await supabase
        .from("profiles")
        .update({
          status: "Archived",
        })
        .eq("id", confirmAction.userId);
      if (archiveError)
        console.error("Error archiving profile:", archiveError.message);
    }

    await fetchUsers();
    setConfirmAction(null);
    setFormData({});
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            User Management
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Manage your staff and clients
          </p>
        </div>

        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ role: "Staff", status: "Active" });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="glass-card bg-white overflow-hidden">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search users by name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setIsCensored(!isCensored)}
              className="flex items-center gap-2 px-3 py-2 border border-natural-border rounded-lg text-[0.6rem] font-bold text-natural-text-main hover:bg-natural-bg transition-all uppercase tracking-widest shadow-xs"
              title={isCensored ? "Show Emails" : "Censor Emails"}
            >
              {isCensored ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              {isCensored ? "Show" : "Hide"}
            </button>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider shadow-xs"
            >
              <option>All Roles</option>
              <option>Customer</option>
              <option>Owner</option>
              <option>Staff</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider shadow-xs"
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Archived</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-natural-bg/30">
                <th
                  className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    User Info <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                  onClick={() => handleSort("role")}
                >
                  <div className="flex items-center">
                    Role <SortIcon field="role" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                  Contact
                </th>
                <th
                  className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status <SortIcon field="status" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr
                  key={user.id}
                  className={cn(
                    "transition-colors group",
                    user.status === "Archived"
                      ? "bg-natural-bg/40 opacity-60 grayscale-[0.5]"
                      : "hover:bg-natural-bg/20",
                  )}
                >
                  <td className="px-6 py-4 border-b border-natural-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-natural-accent/10 border border-natural-accent/20 flex items-center justify-center text-natural-accent font-bold text-xs uppercase shadow-sm">
                        {user.name
                          ? user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .substring(0, 2)
                          : "U"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-natural-text-main tracking-tight">
                          {user.name || "Unnamed User"}
                        </p>
                        <p className="text-[0.7rem] text-natural-text-light font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {censorEmail(user.email)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-b border-natural-border/50">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-natural-sidebar px-2.5 py-1 bg-natural-sidebar/5 rounded-md">
                      {user.role || "Unassigned"}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-b border-natural-border/50">
                    <div className="space-y-1">
                      <p className="text-[0.65rem] text-natural-text-light font-medium flex items-center gap-1.5 opacity-70">
                        <Calendar className="w-3.5 h-3.5" /> Joined{" "}
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-b border-natural-border/50">
                    <span
                      className={cn(
                        "text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded border",
                        user.status === "Active"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : user.status === "Archived"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-natural-text-light/5 text-natural-text-light border-natural-border",
                      )}
                    >
                      {user.status || "Unknown"}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-b border-natural-border/50 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity min-h-[32px]">
                      {user.status !== "Archived" ? (
                        <>
                          <button
                            onClick={() => handleEditClick(user)}
                            className="p-1.5 text-natural-text-light hover:text-natural-text-main hover:bg-white hover:shadow-xs rounded-lg transition-all"
                            title="Edit User"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleArchiveClick(user.id, user.name || "User")
                            }
                            className="p-1.5 text-natural-text-light hover:text-red-500 hover:bg-white hover:shadow-xs rounded-lg transition-all"
                            title="Archive User"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[0.6rem] font-bold text-natural-text-light/40 uppercase tracking-widest bg-natural-bg/50 px-2 py-1 rounded">
                          Archived - Read Only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedUsers.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-natural-text-light font-serif italic">
                No users found matching your criteria
              </p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-6 border-b border-natural-border flex items-center justify-between bg-natural-bg/10">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                {editingUser ? "Edit User Profile" : "Register New User"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-natural-border shadow-xs"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">
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
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={!!editingUser}
                    className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs disabled:opacity-50"
                    placeholder="name@example.com"
                  />
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-natural-text-light" />
                </div>
              </div>

              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">
                    Account Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.password || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-natural-text-light" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">
                    User Role
                  </label>
                  <select
                    value={formData.role || "Staff"}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs cursor-pointer"
                  >
                    <option>Customer</option>
                    <option>Owner</option>
                    <option>Staff</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">
                    Status
                  </label>
                  <select
                    value={formData.status || "Active"}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs cursor-pointer"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/10 border-t border-natural-border flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white transition-all shadow-xs"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingUser ? "Update Profile" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-8 text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0",
                  confirmAction.type === "create"
                    ? "bg-blue-600 shadow-blue-200"
                    : confirmAction.type === "edit"
                      ? "bg-natural-accent shadow-natural-accent/20"
                      : "bg-red-600 shadow-red-200",
                )}
              >
                {confirmAction.type === "create" && (
                  <UserPlus className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "edit" && (
                  <Edit3 className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "archive" && (
                  <Archive className="w-8 h-8 text-white" />
                )}
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                {confirmAction.type === "create"
                  ? "Create New Account?"
                  : confirmAction.type === "edit"
                    ? "Save Changes?"
                    : "Archive Account?"}
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                {confirmAction.type === "create" ? (
                  <>
                    Are you sure you want to register{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.userName}
                    </span>{" "}
                    as a new user in the system?
                  </>
                ) : confirmAction.type === "edit" ? (
                  <>
                    You are about to update the profile details for{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.userName}
                    </span>
                    . Continue?
                  </>
                ) : (
                  <>
                    This will move{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.userName}
                    </span>{" "}
                    to the archives. They will no longer be able to access
                    active features.
                  </>
                )}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleExecuteAction}
                  className={cn(
                    "w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white transition-all shadow-md active:scale-[0.98]",
                    confirmAction.type === "create"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : confirmAction.type === "edit"
                        ? "bg-natural-accent hover:bg-natural-accent/90"
                        : "bg-red-600 hover:bg-red-700",
                  )}
                >
                  Confirm {confirmAction.type}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all active:scale-[0.98]"
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
