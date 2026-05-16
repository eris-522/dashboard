import React, { useState, useEffect } from "react";
import {
  User,
  Shield,
  Camera,
  Save,
  Mail,
  Phone,
  MapPin,
  X,
  Check,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";

import { useUser } from "../context/UserContext";
import { logAuditAction } from "../utils/auditLogger";

export function SettingsPage() {
  const { currentUser, updateUser } = useUser();
  const [activeSection, setActiveSection] = useState("profile");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    location: "Metro Manila, Philippines",
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });

  if (!currentUser) return null;

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  const navigation = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
  ];

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || "",
        phone:
          (currentUser as any).phone_number || (currentUser as any).phone || "",
        location: "Metro Manila, Philippines",
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage({ type: "", text: "" });

    try {
      if (currentUser.id === 0 || currentUser.id === "0") {
        // Update local context only for the fallback account
        updateUser(currentUser.id, {
          name: formData.name,
          phone: formData.phone,
        });
        setSaveMessage({
          type: "success",
          text: "Settings saved locally for fallback account!",
        });
        setTimeout(() => {
          setShowConfirm(false);
        }, 1500);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          phone_number: formData.phone
            ? Number(formData.phone.replace(/\D/g, ""))
            : null,
        })
        .eq("id", currentUser.id);

      if (error) throw error;

      updateUser(currentUser.id, {
        name: formData.name,
        phone: formData.phone,
      });

      await logAuditAction({
        action: "Updated Profile Settings",
        target: formData.name || currentUser.name,
        type: "Update",
        details: "Updated personal profile settings and contact information",
      });

      setSaveMessage({ type: "success", text: "Settings saved successfully!" });

      setTimeout(() => {
        setShowConfirm(false);
        setSaveMessage({ type: "", text: "" });
      }, 1500);
    } catch (err: any) {
      setSaveMessage({
        type: "error",
        text: err.message || "Failed to save changes.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            System Settings
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Configure your personalized workspace preferences
          </p>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 bg-natural-accent text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
        >
          <Save className="w-4 h-4" />
          Save All Changes
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="glass-card overflow-hidden">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all border-l-4",
                  activeSection === item.id
                    ? "bg-natural-bg/50 border-natural-accent text-natural-accent"
                    : "border-transparent text-natural-text-light hover:bg-natural-bg/30",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {activeSection === "profile" && (
            <div className="glass-card p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-6">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full bg-natural-accent/10 border-2 border-natural-border flex items-center justify-center overflow-hidden">
                    <span className="text-2xl font-serif font-bold text-natural-accent">
                      {initials}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-natural-text-main tracking-tight">
                    {currentUser.name}
                  </h3>
                  <p className="text-xs text-natural-text-light font-medium uppercase tracking-wider mb-3">
                    {currentUser.role} Account
                  </p>
                  <button className="text-[0.65rem] font-bold text-natural-accent border border-natural-accent/20 px-3 py-1 rounded hover:bg-natural-accent hover:text-white transition-all uppercase tracking-widest">
                    Change Photo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      type="email"
                      value={currentUser.email}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all opacity-60 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection !== "profile" && (
            <div className="glass-card p-20 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-natural-bg rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-natural-text-light opacity-30" />
              </div>
              <div>
                <h3 className="text-lg font-serif italic text-natural-text-main">
                  Section Configuration
                </h3>
                <p className="text-sm text-natural-text-light font-medium">
                  The{" "}
                  <span className="font-bold text-natural-accent">
                    {activeSection}
                  </span>{" "}
                  settings module is currently being finalized.
                </p>
              </div>
              <button
                onClick={() => setActiveSection("profile")}
                className="text-[0.65rem] font-bold text-natural-text-light hover:text-natural-accent uppercase tracking-widest underline decoration-2 underline-offset-4 decoration-natural-border"
              >
                Back to Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0 bg-natural-accent shadow-natural-accent/20">
                <Save className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                Save Changes?
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                You are about to update your profile settings. Are you sure you
                want to proceed?
              </p>

              {saveMessage.text && (
                <div
                  className={cn(
                    "mb-4 p-3 rounded-lg text-xs font-bold",
                    saveMessage.type === "error"
                      ? "bg-red-50 text-red-600 border border-red-200"
                      : "bg-green-50 text-green-600 border border-green-200",
                  )}
                >
                  {saveMessage.text}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white bg-natural-accent hover:bg-natural-accent/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Confirm Save"}
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setSaveMessage({ type: "", text: "" });
                  }}
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all active:scale-[0.98] disabled:opacity-50"
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
