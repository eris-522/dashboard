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
  Palette,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";
import { useUser } from "../context/UserContext";
import { useTheme, ACCENT_OPTIONS, ThemeMode, AccentColor } from "../context/ThemeContext";
import { logAuditAction } from "../utils/auditLogger";

export function SettingsPage() {
  const { currentUser, updateUser } = useUser();
  const { theme, resolvedTheme, accentColor, setTheme, setAccentColor } = useTheme();
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
    { id: "appearance", label: "Appearance", icon: Palette },
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
      if (activeSection === "appearance") {
        await logAuditAction({
          action: "Updated Appearance Preferences",
          target: `${theme} mode (${accentColor} accent)`,
          type: "Update",
          details: `Changed display theme to ${theme} (resolved: ${resolvedTheme}) with ${accentColor} accent color`,
        });

        setSaveMessage({
          type: "success",
          text: "Appearance preferences saved successfully!",
        });

        setTimeout(() => {
          setShowConfirm(false);
          setSaveMessage({ type: "", text: "" });
        }, 1500);
        return;
      }

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
          className="flex items-center gap-2 bg-natural-accent text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm cursor-pointer active:scale-95"
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
                  "w-full flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all border-l-4 cursor-pointer text-left",
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
          {/* Profile Section */}
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
                  <button className="text-[0.65rem] font-bold text-natural-accent border border-natural-accent/20 px-3 py-1 rounded hover:bg-natural-accent hover:text-white transition-all uppercase tracking-widest cursor-pointer">
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
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all text-natural-text-main"
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
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all opacity-60 cursor-not-allowed text-natural-text-main"
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
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all text-natural-text-main"
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
                      className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all text-natural-text-main"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Section */}
          {activeSection === "appearance" && (
            <div className="glass-card p-8 space-y-10 animate-in slide-in-from-bottom-2 duration-300">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-natural-accent" />
                  <h3 className="text-xl font-serif font-bold text-natural-text-main">
                    Theme & Visual Appearance
                  </h3>
                </div>
                <p className="text-natural-text-light text-xs font-medium">
                  Select your preferred interface mode, theme tone, and signature accents across the management console.
                </p>
              </div>

              {/* Theme Mode Selector Cards */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-widest flex items-center gap-2">
                  <span>Color Theme Mode</span>
                  <span className="text-[10px] lowercase text-natural-accent font-normal tracking-normal">
                    (currently active: {resolvedTheme})
                  </span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Light Mode */}
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex flex-col text-left p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group",
                      theme === "light"
                        ? "border-natural-accent bg-natural-accent/5 ring-4 ring-natural-accent/10 shadow-sm"
                        : "border-natural-border hover:border-natural-accent/40 bg-natural-bg/20",
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-4">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Sun className="w-5 h-5" />
                      </div>
                      {theme === "light" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-natural-accent bg-natural-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>

                    {/* Visual Mini Preview */}
                    <div className="w-full h-16 rounded-lg bg-[#f8f7f2] border border-[#e8e7e0] p-2 flex gap-1.5 mb-3 shadow-xs">
                      <div className="w-4 h-full bg-[#3d4035] rounded-xs" />
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="h-2 w-12 bg-[#a68a56] rounded-xs" />
                        <div className="h-full bg-white rounded-xs border border-[#e8e7e0] p-1 flex items-center justify-between">
                          <div className="h-1.5 w-6 bg-[#8a8b82]/40 rounded-xs" />
                          <div className="h-2 w-2 rounded-full bg-[#a68a56]" />
                        </div>
                      </div>
                    </div>

                    <h4 className="font-bold text-sm text-natural-text-main">
                      Light Mode
                    </h4>
                    <p className="text-[11px] text-natural-text-light mt-1 leading-relaxed">
                      Warm ivory editorial backdrop with crisp natural borders and elegant contrast.
                    </p>
                  </button>

                  {/* Dark Mode */}
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex flex-col text-left p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group",
                      theme === "dark"
                        ? "border-natural-accent bg-natural-accent/5 ring-4 ring-natural-accent/10 shadow-sm"
                        : "border-natural-border hover:border-natural-accent/40 bg-natural-bg/20",
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-4">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Moon className="w-5 h-5" />
                      </div>
                      {theme === "dark" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-natural-accent bg-natural-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>

                    {/* Visual Mini Preview */}
                    <div className="w-full h-16 rounded-lg bg-[#131411] border border-[#2e3028] p-2 flex gap-1.5 mb-3 shadow-xs">
                      <div className="w-4 h-full bg-[#191a16] rounded-xs border border-[#2e3028]" />
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="h-2 w-12 bg-[#c4a96e] rounded-xs" />
                        <div className="h-full bg-[#1c1d18] rounded-xs border border-[#2e3028] p-1 flex items-center justify-between">
                          <div className="h-1.5 w-6 bg-[#9e9f96]/40 rounded-xs" />
                          <div className="h-2 w-2 rounded-full bg-[#c4a96e]" />
                        </div>
                      </div>
                    </div>

                    <h4 className="font-bold text-sm text-natural-text-main">
                      Dark Mode
                    </h4>
                    <p className="text-[11px] text-natural-text-light mt-1 leading-relaxed">
                      Obsidian night theme designed for low-light comfort, deep contrast, and luxury styling.
                    </p>
                  </button>

                  {/* System Default */}
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={cn(
                      "flex flex-col text-left p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group",
                      theme === "system"
                        ? "border-natural-accent bg-natural-accent/5 ring-4 ring-natural-accent/10 shadow-sm"
                        : "border-natural-border hover:border-natural-accent/40 bg-natural-bg/20",
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-4">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <Monitor className="w-5 h-5" />
                      </div>
                      {theme === "system" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-natural-accent bg-natural-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Check className="w-3 h-3" /> Auto
                        </span>
                      )}
                    </div>

                    {/* Visual Mini Preview (Split) */}
                    <div className="w-full h-16 rounded-lg overflow-hidden border border-natural-border flex mb-3 shadow-xs">
                      <div className="w-1/2 h-full bg-[#f8f7f2] p-1 flex flex-col justify-center gap-1 border-r border-[#e8e7e0]">
                        <div className="h-2 w-8 bg-[#a68a56] rounded-xs" />
                        <div className="h-4 bg-white rounded-xs border border-[#e8e7e0]" />
                      </div>
                      <div className="w-1/2 h-full bg-[#131411] p-1 flex flex-col justify-center gap-1">
                        <div className="h-2 w-8 bg-[#c4a96e] rounded-xs" />
                        <div className="h-4 bg-[#1c1d18] rounded-xs border border-[#2e3028]" />
                      </div>
                    </div>

                    <h4 className="font-bold text-sm text-natural-text-main">
                      System Preference
                    </h4>
                    <p className="text-[11px] text-natural-text-light mt-1 leading-relaxed">
                      Automatically follows your operating system's light or dark schedule.
                    </p>
                  </button>
                </div>
              </div>

              {/* Accent Color Palette Customizer */}
              <div className="space-y-4 pt-4 border-t border-natural-border">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-widest flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Signature Accent Palette</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {ACCENT_OPTIONS.map((opt) => {
                    const isSelected = accentColor === opt.id;
                    const hex = resolvedTheme === "dark" ? opt.darkHex : opt.lightHex;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAccentColor(opt.id)}
                        className={cn(
                          "p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2",
                          isSelected
                            ? "border-natural-accent bg-natural-accent/10 shadow-xs"
                            : "border-natural-border hover:border-natural-accent/30 bg-natural-bg/10",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="w-5 h-5 rounded-full shadow-xs border border-white/20 flex items-center justify-center text-white"
                            style={{ backgroundColor: hex }}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-bold text-natural-accent uppercase tracking-widest">
                              Selected
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-natural-text-main">
                            {opt.label}
                          </p>
                          <p className="text-[10px] text-natural-text-light line-clamp-1 opacity-80 mt-0.5">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Panel */}
              <div className="space-y-3 pt-4 border-t border-natural-border">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-widest">
                  Live Component & Typography Preview
                </label>

                <div className="p-6 rounded-2xl border border-natural-border bg-natural-bg space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-natural-border">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-natural-accent">
                        Sample Workspace Header
                      </span>
                      <h4 className="text-lg font-serif font-bold text-natural-text-main">
                        Roxan Policarpio Events & Catering
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 uppercase tracking-wider">
                        Confirmed (Active)
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-natural-accent/10 text-natural-accent border border-natural-accent/20 uppercase tracking-wider">
                        {theme.toUpperCase()} MODE
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl glass-card space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-natural-text-light">
                        Sample Revenue
                      </p>
                      <p className="text-xl font-serif font-bold text-natural-text-main">
                        ₱240,000
                      </p>
                      <p className="text-[10px] font-bold text-natural-accent">
                        +18.4% Growth
                      </p>
                    </div>

                    <div className="p-4 rounded-xl glass-card space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-natural-text-light">
                        Pending Inquiries
                      </p>
                      <p className="text-xl font-serif font-bold text-natural-text-main">
                        12 Bookings
                      </p>
                      <p className="text-[10px] text-natural-text-light font-medium">
                        Awaiting review
                      </p>
                    </div>

                    <div className="p-4 rounded-xl glass-card flex flex-col justify-center gap-2">
                      <button className="w-full py-2 bg-natural-accent text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-xs hover:opacity-90">
                        Primary Action
                      </button>
                      <button className="w-full py-1.5 border border-natural-border rounded-lg text-[10px] font-bold text-natural-text-main hover:bg-natural-bg/50 uppercase tracking-widest">
                        Secondary Action
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback Section */}
          {activeSection !== "profile" && activeSection !== "appearance" && (
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
                className="text-[0.65rem] font-bold text-natural-text-light hover:text-natural-accent uppercase tracking-widest underline decoration-2 underline-offset-4 decoration-natural-border cursor-pointer"
              >
                Back to Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-natural-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0 bg-natural-accent shadow-natural-accent/20">
                <Save className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                Save Changes?
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                {activeSection === "appearance"
                  ? `Save current display preferences (${theme} theme with ${accentColor} accent) to your profile?`
                  : "You are about to update your profile settings. Are you sure you want to proceed?"}
              </p>

              {saveMessage.text && (
                <div
                  className={cn(
                    "mb-4 p-3 rounded-lg text-xs font-bold",
                    saveMessage.type === "error"
                      ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800",
                  )}
                >
                  {saveMessage.text}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white bg-natural-accent hover:bg-natural-accent/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Confirm Save"}
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setSaveMessage({ type: "", text: "" });
                  }}
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
