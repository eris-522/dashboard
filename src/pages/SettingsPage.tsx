import React, { useState, useEffect } from "react";
import {
  User,
  Shield,
  Camera,
  Save,
  Mail,
  Phone,
  X,
  Check,
  Palette,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  CheckCircle2,
  Sliders,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  AlertCircle,
  Send,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";
import { useUser } from "../context/UserContext";
import { useTheme, ACCENT_OPTIONS } from "../context/ThemeContext";
import { logAuditAction } from "../utils/auditLogger";

// Helper function to calculate edit distance between two strings for email domain typo detection
const getLevenshteinDistance = (a: string, b: string): number => {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const arr: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= a.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1),
            );
    }
  }
  return arr[b.length][a.length];
};

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.org",
  "testing.com",
  "sample.com",
  "sample.org",
  "fake.com",
  "dummy.com",
  "invalid.com",
  "localhost",
  "none.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
]);

export const validateFullName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Full name is required.";
  }
  if (trimmed.length < 2) {
    return "Full name must be at least 2 characters long.";
  }
  if (!/^[a-zA-ZÀ-ÿ\s.'-]+$/.test(trimmed) || !/[a-zA-ZÀ-ÿ]/.test(trimmed)) {
    return "Full name must only contain letters, spaces, periods, hyphens, or apostrophes.";
  }
  return "";
};

export const validateEmailFormat = (email: string): string => {
  const trimmed = email.trim();
  if (!trimmed) {
    return "Email address is required.";
  }

  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|net|org|edu|gov|ph|co|uk|us|ca|au|nz|sg|in|io|me|tv|app|dev|tech)$/i;
  if (!emailRegex.test(trimmed)) {
    return "Please enter a valid email address (e.g., name@gmail.com, name@yahoo.com).";
  }

  const [localPart, rawDomain] = trimmed.split("@");
  if (
    !localPart ||
    localPart.length < 3 ||
    !/[a-zA-Z]/.test(localPart) ||
    /^[._+-]|[._+-]$/.test(localPart) ||
    localPart.includes("..")
  ) {
    return "Username before '@' must be at least 3 characters, contain letters, and not start/end with punctuation.";
  }

  const domain = rawDomain?.toLowerCase();
  if (domain) {
    if (BLOCKED_DOMAINS.has(domain)) {
      return `Placeholder or disposable domain '@${domain}' is not allowed.`;
    }

    const exactMatches = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "ymail.com",
      "mail.com",
      "email.com",
      "live.com",
      "icloud.com",
      "yahoo.com.ph",
    ];
    const providersToCheck = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
    ];

    if (!exactMatches.includes(domain)) {
      for (const provider of providersToCheck) {
        if (getLevenshteinDistance(domain, provider) <= 2) {
          return `Did you mean @${provider}? Please check your email domain for typos.`;
        }
      }
    }
  }

  return "";
};

export const normalizePhPhoneDigits = (rawPhone: string): string => {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.startsWith("639") && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("09") && digits.length >= 11) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
};

export const validatePhPhoneFormat = (phoneDigits: string): string => {
  const digits = normalizePhPhoneDigits(phoneDigits);
  if (!digits) {
    return "Contact number is required.";
  }
  if (!digits.startsWith("9")) {
    return "Philippine mobile numbers must start with 9 (e.g., +63 917 123 4567).";
  }
  if (digits.length !== 10) {
    return "Contact number must be exactly 10 digits after +63 (e.g., 917 123 4567).";
  }
  return "";
};

export const validatePasswordStrength = (password: string): string => {
  if (!password) {
    return "New password is required.";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters long.";
  }
  return "";
};

export function SettingsPage() {
  const { currentUser, updateUser } = useUser();
  const { theme, resolvedTheme, accentColor, setTheme, setAccentColor } = useTheme();
  const [activeSection, setActiveSection] = useState("profile");

  // Profile form state (Location field removed as requested)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Profile validation error states (validated on blur, cleared on input)
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [profileBanner, setProfileBanner] = useState<{ type: string; text: string }>({
    type: "",
    text: "",
  });

  // Email change OTP confirmation state
  const [emailOtpStep, setEmailOtpStep] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [emailOtpSentTo, setEmailOtpSentTo] = useState("");

  // Save Confirmation Modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });

  // Security / Password Change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [passwordOtpCode, setPasswordOtpCode] = useState("");
  const [passwordOtpError, setPasswordOtpError] = useState("");
  const [isSendingPasswordOtp, setIsSendingPasswordOtp] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{ type: string; text: string }>({
    type: "",
    text: "",
  });

  const isPasswordReadyForOtp = Boolean(
    newPassword.trim() &&
    newPassword.length >= 6 &&
    confirmPassword.trim() &&
    newPassword === confirmPassword
  );

  useEffect(() => {
    if (currentUser) {
      const rawPhone =
        (currentUser as any).phone_number || (currentUser as any).phone || "";
      setFormData({
        name: currentUser.name || "",
        email: currentUser.email || "",
        phone: normalizePhPhoneDigits(String(rawPhone)),
      });
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const initials = (currentUser.name || "A")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("");

  const navigation = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "security", label: "Security", icon: Shield },
  ];

  const isEmailChanged =
    formData.email.trim().toLowerCase() !==
    (currentUser.email || "").trim().toLowerCase();

  // Verify OTP for password change using Supabase 'recovery' or 'email' OTP type
  const verifyEmailOtpToken = async (targetEmail: string, token: string) => {
    const cleanTarget = targetEmail.trim().toLowerCase();
    const cleanToken = token.trim();

    const { data: recData, error: recError } = await supabase.auth.verifyOtp({
      email: cleanTarget,
      token: cleanToken,
      type: "recovery",
    });

    if (!recError && recData?.session) {
      return { success: true, session: recData.session };
    }

    const { data: emailData, error: emailOtpErr } = await supabase.auth.verifyOtp({
      email: cleanTarget,
      token: cleanToken,
      type: "email",
    });

    if (!emailOtpErr && emailData?.session) {
      return { success: true, session: emailData.session };
    }

    return {
      success: false,
      error:
        recError?.message ||
        emailOtpErr?.message ||
        "Invalid or expired OTP code. Please check your email and try again.",
    };
  };

  // Verify OTP for email change using Supabase 'email_change' OTP type
  const verifyEmailChangeOtp = async (newEmail: string, token: string) => {
    const cleanNewEmail = newEmail.trim().toLowerCase();
    const cleanToken = token.trim();

    // 1. Try verifying with new email (standard Supabase email_change template)
    const { data: newData, error: newErr } = await supabase.auth.verifyOtp({
      email: cleanNewEmail,
      token: cleanToken,
      type: "email_change",
    });

    if (!newErr) {
      return { success: true, data: newData };
    }

    // 2. Try verifying with previous email in case project has Secure Email Change enabled
    const previousEmail = (currentUser?.email || "").trim().toLowerCase();
    if (previousEmail && previousEmail !== cleanNewEmail) {
      const { data: prevData, error: prevErr } = await supabase.auth.verifyOtp({
        email: previousEmail,
        token: cleanToken,
        type: "email_change",
      });

      if (!prevErr) {
        return { success: true, data: prevData };
      }
    }

    return {
      success: false,
      error:
        newErr?.message ||
        "Invalid or expired OTP code. Please check your email and try again.",
    };
  };

  // Dispatch OTP to confirm an email change using Supabase Change Email Address template
  const handleSendEmailChangeOtp = async () => {
    const targetNewEmail = formData.email.trim().toLowerCase();
    const previousEmail = (currentUser.email || "").trim().toLowerCase();

    setIsSendingEmailOtp(true);
    setSaveMessage({ type: "", text: "" });
    setEmailOtpError("");

    try {
      // Check if the new email is already in use by another admin
      const { data: existingAdmin } = await supabase
        .from("admins")
        .select("id")
        .ilike("email", targetNewEmail)
        .neq("id", String(currentUser.id))
        .maybeSingle();

      if (existingAdmin) {
        setEmailError("This email address is already registered to another administrator.");
        setSaveMessage({
          type: "error",
          text: "This email address is already registered to another administrator.",
        });
        setShowConfirm(false);
        return;
      }

      // Ensure active Supabase session before triggering email change
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        await supabase.auth.signInWithPassword({
          email: previousEmail,
          password: "admin123",
        }).catch(() => {});
      }

      // Trigger Supabase Change Email Address template ("Confirm your new email address")
      const { error: updateErr } = await supabase.auth.updateUser({
        email: targetNewEmail,
      });

      if (updateErr) {
        const lower = updateErr.message.toLowerCase();
        if (lower.includes("already registered") || lower.includes("already in use")) {
          setEmailError("This email address is already in use by another account.");
          setSaveMessage({
            type: "error",
            text: "This email address is already in use by another account.",
          });
          setShowConfirm(false);
          return;
        }

        // If an email change was already initiated, resend using email_change type
        const { error: resendErr } = await supabase.auth.resend({
          type: "email_change",
          email: targetNewEmail,
        });

        if (resendErr) {
          throw new Error(updateErr.message || resendErr.message);
        }
      }

      setEmailOtpSentTo(targetNewEmail);
      setEmailOtpStep(true);
      setSaveMessage({
        type: "success",
        text: `Confirmation OTP sent to ${targetNewEmail} ("Confirm your new email address"). Enter the code below to confirm your new email.`,
      });
    } catch (err: any) {
      setSaveMessage({
        type: "error",
        text: err?.message || "Failed to send email change verification OTP.",
      });
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  // Validate profile inputs and open confirmation dialog
  const handleInitiateSaveClick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setProfileBanner({ type: "", text: "" });
    setSaveMessage({ type: "", text: "" });

    if (activeSection === "profile") {
      const nErr = validateFullName(formData.name);
      const eErr = validateEmailFormat(formData.email);
      const pErr = validatePhPhoneFormat(formData.phone);

      setNameError(nErr);
      setEmailError(eErr);
      setPhoneError(pErr);

      if (nErr || eErr || pErr) {
        setProfileBanner({
          type: "error",
          text: nErr || eErr || pErr,
        });
        return;
      }
    }

    setEmailOtpStep(false);
    setEmailOtpCode("");
    setEmailOtpError("");
    setShowConfirm(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage({ type: "", text: "" });
    setEmailOtpError("");

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

      const cleanName = formData.name.trim();
      const cleanEmail = formData.email.trim().toLowerCase();
      const cleanPhoneDigits = normalizePhPhoneDigits(formData.phone);
      const formattedAdminPhone = `0${cleanPhoneDigits}`; // e.g., 09467158519

      const nErr = validateFullName(cleanName);
      const eErr = validateEmailFormat(cleanEmail);
      const pErr = validatePhPhoneFormat(cleanPhoneDigits);

      if (nErr || eErr || pErr) {
        setNameError(nErr);
        setEmailError(eErr);
        setPhoneError(pErr);
        setSaveMessage({
          type: "error",
          text: nErr || eErr || pErr,
        });
        return;
      }

      // If email is changing, require confirmation OTP sent via Supabase Change Email template
      if (isEmailChanged) {
        if (!emailOtpStep) {
          await handleSendEmailChangeOtp();
          return;
        }

        const cleanOtp = emailOtpCode.replace(/\D/g, "").trim();
        if (!cleanOtp || cleanOtp.length < 6) {
          setEmailOtpError("Please enter the 6-digit confirmation code.");
          setSaveMessage({
            type: "error",
            text: "Please enter the 6-digit confirmation code.",
          });
          return;
        }

        const otpResult = await verifyEmailChangeOtp(cleanEmail, cleanOtp);
        if (!otpResult.success) {
          setEmailOtpError(otpResult.error || "Invalid confirmation code.");
          setSaveMessage({
            type: "error",
            text: otpResult.error || "Invalid confirmation code.",
          });
          return;
        }
      }

      if (currentUser.id === 0 || currentUser.id === "0") {
        updateUser(currentUser.id, {
          name: cleanName,
          email: cleanEmail,
          phone: formattedAdminPhone,
        });
        setSaveMessage({
          type: "success",
          text: "Settings saved locally for fallback account!",
        });
        setTimeout(() => {
          setShowConfirm(false);
          setEmailOtpStep(false);
          setEmailOtpCode("");
        }, 1500);
        return;
      }

      // Atomically update auth.users, auth.identities, public.admins, and public.profiles
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "update_admin_profile_data",
        {
          p_admin_id: currentUser.id,
          p_name: cleanName,
          p_email: cleanEmail,
          p_phone: formattedAdminPhone,
        },
      );

      if (rpcError) {
        throw rpcError;
      }

      if (rpcResult && rpcResult.success === false) {
        throw new Error(rpcResult.error || "Failed to update administrator profile.");
      }

      updateUser(currentUser.id, {
        name: cleanName,
        email: cleanEmail,
        phone: formattedAdminPhone,
      });

      await logAuditAction({
        action: isEmailChanged
          ? "Updated Profile & Email Address (OTP Verified)"
          : "Updated Profile Settings",
        target: cleanName,
        type: "Update",
        details: isEmailChanged
          ? `Updated profile and verified email change OTP to update email from ${currentUser.email} to ${cleanEmail}`
          : `Updated personal profile name (${cleanName}) and contact number (+63 ${cleanPhoneDigits})`,
      });

      setSaveMessage({
        type: "success",
        text: isEmailChanged
          ? "OTP verified! Your email address and profile settings have been updated."
          : "Profile settings saved successfully!",
      });
      setProfileBanner({
        type: "success",
        text: isEmailChanged
          ? `Profile and email address updated to ${cleanEmail}.`
          : "Profile settings saved successfully!",
      });

      setTimeout(() => {
        setShowConfirm(false);
        setEmailOtpStep(false);
        setEmailOtpCode("");
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

  // Security Section: Send OTP to current admin email before confirming password change
  const handleSendPasswordOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSecurityMessage({ type: "", text: "" });
    setPasswordOtpError("");

    if (!newPassword.trim()) {
      const err = "Please enter your new password first before requesting an OTP.";
      setNewPasswordError(err);
      setSecurityMessage({ type: "error", text: err });
      return;
    }

    const pwErr = validatePasswordStrength(newPassword);
    const confirmErr =
      !confirmPassword
        ? "Please confirm your new password."
        : confirmPassword !== newPassword
          ? "Passwords do not match."
          : "";

    setNewPasswordError(pwErr);
    setConfirmPasswordError(confirmErr);

    if (pwErr || confirmErr) {
      setSecurityMessage({
        type: "error",
        text: pwErr || confirmErr,
      });
      return;
    }

    const adminEmail = (currentUser.email || "").trim().toLowerCase();
    if (!adminEmail) {
      setSecurityMessage({
        type: "error",
        text: "No email address found for your administrator account.",
      });
      return;
    }

    setIsSendingPasswordOtp(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(adminEmail);
      if (error) {
        setSecurityMessage({
          type: "error",
          text: `Failed to send OTP to ${adminEmail}: ${error.message}`,
        });
        return;
      }

      setPasswordOtpSent(true);
      setSecurityMessage({
        type: "success",
        text: `Verification OTP sent to ${adminEmail}. Please enter the code below to confirm your password change.`,
      });
    } catch (err: any) {
      setSecurityMessage({
        type: "error",
        text: err?.message || "Failed to send OTP email.",
      });
    } finally {
      setIsSendingPasswordOtp(false);
    }
  };

  // Security Section: Verify OTP and update password
  const handleConfirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMessage({ type: "", text: "" });
    setPasswordOtpError("");

    const pwErr = validatePasswordStrength(newPassword);
    const confirmErr =
      !confirmPassword
        ? "Please confirm your new password."
        : confirmPassword !== newPassword
          ? "Passwords do not match."
          : "";

    setNewPasswordError(pwErr);
    setConfirmPasswordError(confirmErr);

    if (pwErr || confirmErr) {
      setSecurityMessage({
        type: "error",
        text: pwErr || confirmErr,
      });
      return;
    }

    if (!passwordOtpSent) {
      await handleSendPasswordOtp();
      return;
    }

    const cleanOtp = passwordOtpCode.replace(/\D/g, "").trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      const msg = "Please enter the 6-digit OTP code sent to your email.";
      setPasswordOtpError(msg);
      setSecurityMessage({ type: "error", text: msg });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const adminEmail = (currentUser.email || "").trim().toLowerCase();
      const otpVerification = await verifyEmailOtpToken(adminEmail, cleanOtp);

      if (!otpVerification.success) {
        const errMsg =
          otpVerification.error ||
          "Invalid or expired OTP code. Please check your email and try again.";
        setPasswordOtpError(errMsg);
        setSecurityMessage({ type: "error", text: errMsg });
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        throw updateErr;
      }

      await logAuditAction({
        action: "Changed Administrator Password",
        target: currentUser.email,
        type: "Update",
        details: `Administrator ${currentUser.name} (${currentUser.email}) verified email OTP and updated their account password.`,
      });

      setNewPassword("");
      setConfirmPassword("");
      setPasswordOtpCode("");
      setPasswordOtpSent(false);
      setNewPasswordError("");
      setConfirmPasswordError("");
      setPasswordOtpError("");
      setSecurityMessage({
        type: "success",
        text: "Your password has been updated successfully!",
      });
    } catch (err: any) {
      setSecurityMessage({
        type: "error",
        text: err?.message || "Failed to update password. Please try again.",
      });
    } finally {
      setIsUpdatingPassword(false);
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

        {activeSection !== "security" && (
          <button
            type="button"
            onClick={() => handleInitiateSaveClick()}
            className="flex items-center gap-2 bg-natural-accent text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            Save All Changes
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="glass-card overflow-hidden" aria-label="Settings sections">
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setProfileBanner({ type: "", text: "" });
                  setSecurityMessage({ type: "", text: "" });
                }}
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
            <form
              onSubmit={handleInitiateSaveClick}
              noValidate
              className="glass-card p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300"
            >
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
                  <h3 className="text-lg font-bold text-natural-text-main tracking-wide">
                    {currentUser.name}
                  </h3>
                  <p className="text-xs text-natural-text-light font-medium uppercase tracking-wider mb-1">
                    {currentUser.role} Account
                  </p>
                  <p className="text-xs text-natural-text-light">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <div aria-live="polite">
                {profileBanner.text && (
                  <div
                    className={cn(
                      "p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border",
                      profileBanner.type === "error"
                        ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                        : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
                    )}
                  >
                    {profileBanner.type === "error" ? (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    <span>{profileBanner.text}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-profile-name"
                    className="block text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest"
                  >
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      id="admin-profile-name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      value={formData.name}
                      aria-describedby="admin-name-hint admin-name-error"
                      aria-invalid={!!nameError}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, name: val });
                        if (nameError) {
                          setNameError(validateFullName(val));
                        }
                      }}
                      onBlur={(e) => {
                        setNameError(validateFullName(e.target.value));
                      }}
                      className={cn(
                        "w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all text-natural-text-main",
                        nameError
                          ? "border-red-500 focus:ring-red-500/20"
                          : "border-natural-border focus:ring-natural-accent/10",
                      )}
                    />
                  </div>
                  {nameError && (
                    <p
                      id="admin-name-error"
                      className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {nameError}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-profile-email"
                    className="block text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      id="admin-profile-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={formData.email}
                      aria-describedby="admin-email-hint admin-email-error"
                      aria-invalid={!!emailError}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, email: val });
                        if (emailError) {
                          setEmailError(validateEmailFormat(val));
                        }
                      }}
                      onBlur={(e) => {
                        setEmailError(validateEmailFormat(e.target.value));
                      }}
                      className={cn(
                        "w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all text-natural-text-main",
                        emailError
                          ? "border-red-500 focus:ring-red-500/20"
                          : "border-natural-border focus:ring-natural-accent/10",
                      )}
                    />
                  </div>
                  {emailError && (
                    <p
                      id="admin-email-error"
                      className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {emailError}
                    </p>
                  )}
                  {isEmailChanged && !emailError && (
                    <p className="text-[11px] font-semibold text-natural-accent flex items-center gap-1 mt-1">
                      <KeyRound className="w-3.5 h-3.5 shrink-0" />
                      A confirmation OTP will be sent to verify this email change when you save.
                    </p>
                  )}
                </div>

                {/* Contact Number (PH Mobile Format) */}
                <div className="space-y-1.5 md:col-span-2">
                  <label
                    htmlFor="admin-profile-phone"
                    className="block text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest"
                  >
                    Contact Number (PH) <span className="text-red-500">*</span>
                  </label>
                  <p
                    id="admin-phone-hint"
                    className="text-[11px] text-natural-text-light"
                  >
                    Philippine mobile format: 10 digits starting with 9 after +63 (e.g., 917 123 4567).
                  </p>
                  <div className="relative max-w-md">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <Phone className="w-3.5 h-3.5 text-natural-text-light opacity-50" />
                      <span role="img" aria-label="Philippines" className="text-xs">
                        🇵🇭
                      </span>
                      <span className="text-xs font-bold text-natural-text-light">
                        +63
                      </span>
                    </div>
                    <input
                      id="admin-profile-phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      required
                      autoComplete="tel-national"
                      placeholder="917 123 4567"
                      value={formData.phone}
                      aria-describedby="admin-phone-hint admin-phone-error"
                      aria-invalid={!!phoneError}
                      onChange={(e) => {
                        const normalized = normalizePhPhoneDigits(e.target.value);
                        setFormData({ ...formData, phone: normalized });
                        if (phoneError) {
                          setPhoneError(validatePhPhoneFormat(normalized));
                        }
                      }}
                      onBlur={(e) => {
                        const normalized = normalizePhPhoneDigits(e.target.value);
                        setPhoneError(validatePhPhoneFormat(normalized));
                      }}
                      className={cn(
                        "w-full pl-22 pr-4 py-2.5 bg-natural-bg/30 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all text-natural-text-main",
                        phoneError
                          ? "border-red-500 focus:ring-red-500/20"
                          : "border-natural-border focus:ring-natural-accent/10",
                      )}
                    />
                  </div>
                  {phoneError && (
                    <p
                      id="admin-phone-error"
                      className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {phoneError}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-natural-border flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-natural-accent text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  {isEmailChanged
                    ? "Send OTP & Save Profile"
                    : "Save Profile Changes"}
                </button>
              </div>
            </form>
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
                      <button
                        type="button"
                        className="w-full py-2 bg-natural-accent text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-xs hover:opacity-90"
                      >
                        Primary Action
                      </button>
                      <button
                        type="button"
                        className="w-full py-1.5 border border-natural-border rounded-lg text-[10px] font-bold text-natural-text-main hover:bg-natural-bg/50 uppercase tracking-widest"
                      >
                        Secondary Action
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Section */}
          {activeSection === "security" && (
            <form
              onSubmit={handleConfirmPasswordChange}
              noValidate
              className="glass-card p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-5 h-5 text-natural-accent" />
                  <h3 className="text-xl font-serif font-bold text-natural-text-main">
                    Security & Password Management
                  </h3>
                </div>
                <p className="text-natural-text-light text-xs font-medium">
                  Update your administrator password. To protect your account, a verification OTP will be sent to{" "}
                  <strong className="text-natural-text-main">{currentUser.email}</strong> before confirming the password change.
                </p>
              </div>

              <div aria-live="polite">
                {securityMessage.text && (
                  <div
                    className={cn(
                      "p-4 rounded-xl text-xs font-bold flex items-start gap-2.5 border",
                      securityMessage.type === "error"
                        ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                        : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
                    )}
                  >
                    {securityMessage.type === "error" ? (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{securityMessage.text}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* New Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-new-password"
                    className="block text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest"
                  >
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <p
                    id="admin-password-rules"
                    className="text-[11px] text-natural-text-light"
                  >
                    Must be at least 6 characters long.
                  </p>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      id="admin-new-password"
                      name="new_password"
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      value={newPassword}
                      aria-describedby="admin-password-rules admin-new-password-error"
                      aria-invalid={!!newPasswordError}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewPassword(val);
                        if (newPasswordError) {
                          setNewPasswordError(validatePasswordStrength(val));
                        }
                        if (confirmPassword && confirmPasswordError) {
                          setConfirmPasswordError(
                            val === confirmPassword ? "" : "Passwords do not match.",
                          );
                        }
                      }}
                      onBlur={(e) => {
                        setNewPasswordError(validatePasswordStrength(e.target.value));
                      }}
                      className={cn(
                        "w-full pl-10 pr-10 py-2.5 bg-natural-bg/30 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all text-natural-text-main",
                        newPasswordError
                          ? "border-red-500 focus:ring-red-500/20"
                          : "border-natural-border focus:ring-natural-accent/10",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-natural-text-light hover:text-natural-accent transition-colors cursor-pointer p-0.5"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      title={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {newPasswordError && (
                    <p
                      id="admin-new-password-error"
                      className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {newPasswordError}
                    </p>
                  )}
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-confirm-password"
                    className="block text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest"
                  >
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <p
                    id="admin-confirm-password-hint"
                    className="text-[11px] text-natural-text-light"
                  >
                    Re-enter your new password to confirm.
                  </p>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                    <input
                      id="admin-confirm-password"
                      name="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      aria-describedby="admin-confirm-password-hint admin-confirm-password-error"
                      aria-invalid={!!confirmPasswordError}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmPassword(val);
                        if (confirmPasswordError) {
                          setConfirmPasswordError(
                            !val
                              ? "Please confirm your new password."
                              : val !== newPassword
                                ? "Passwords do not match."
                                : "",
                          );
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        setConfirmPasswordError(
                          !val
                            ? "Please confirm your new password."
                            : val !== newPassword
                              ? "Passwords do not match."
                              : "",
                        );
                      }}
                      className={cn(
                        "w-full pl-10 pr-10 py-2.5 bg-natural-bg/30 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all text-natural-text-main",
                        confirmPasswordError
                          ? "border-red-500 focus:ring-red-500/20"
                          : "border-natural-border focus:ring-natural-accent/10",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-natural-text-light hover:text-natural-accent transition-colors cursor-pointer p-0.5"
                      aria-label={
                        showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                      }
                      title={
                        showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPasswordError && (
                    <p
                      id="admin-confirm-password-error"
                      className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {confirmPasswordError}
                    </p>
                  )}
                </div>
              </div>

              {/* Email OTP Verification Box for Password Change */}
              <div className="p-6 rounded-2xl border border-natural-border bg-natural-bg/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-natural-text-main flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-natural-accent" />
                      Email OTP Verification
                    </h4>
                    <p className="text-xs text-natural-text-light mt-0.5">
                      Send a one-time passcode to <strong className="text-natural-text-main">{currentUser.email}</strong> and enter it below to authorize this password change.
                    </p>
                    {!isPasswordReadyForOtp && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {!newPassword.trim()
                          ? "Enter a new password above to enable sending OTP."
                          : newPassword.length < 6
                            ? "Password must be at least 6 characters long to enable sending OTP."
                            : !confirmPassword.trim()
                              ? "Confirm your new password to enable sending OTP."
                              : "Passwords do not match."}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendPasswordOtp()}
                    disabled={isSendingPasswordOtp || !isPasswordReadyForOtp}
                    title={
                      !newPassword.trim()
                        ? "Please enter a new password first"
                        : newPassword.length < 6
                          ? "Password must be at least 6 characters"
                          : !confirmPassword.trim()
                            ? "Please confirm your new password"
                            : newPassword !== confirmPassword
                              ? "Passwords do not match"
                              : undefined
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border border-natural-accent text-natural-accent hover:bg-natural-accent hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-natural-accent shrink-0"
                  >
                    {isSendingPasswordOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        {passwordOtpSent ? "Resend OTP to Email" : "Send OTP to Email"}
                      </>
                    )}
                  </button>
                </div>

                {passwordOtpSent && (
                  <div className="pt-3 border-t border-natural-border space-y-2 max-w-sm animate-in fade-in duration-200">
                    <label
                      htmlFor="admin-password-otp"
                      className="block text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest"
                    >
                      Verification OTP Code <span className="text-red-500">*</span>
                    </label>
                    <p
                      id="admin-password-otp-hint"
                      className="text-[11px] text-natural-text-light"
                    >
                      Enter the 6-digit code sent to {currentUser.email}.
                    </p>
                    <input
                      id="admin-password-otp"
                      name="password_otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      pattern="\d{6,8}"
                      maxLength={8}
                      placeholder="123456"
                      value={passwordOtpCode}
                      aria-describedby="admin-password-otp-hint admin-password-otp-error"
                      aria-invalid={!!passwordOtpError}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setPasswordOtpCode(digits);
                        if (passwordOtpError && digits.length >= 6) {
                          setPasswordOtpError("");
                        }
                      }}
                      onBlur={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        if (digits && digits.length < 6) {
                          setPasswordOtpError("OTP code must be at least 6 digits.");
                        }
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 bg-natural-card border rounded-lg font-mono text-base tracking-[0.35em] focus:outline-none focus:ring-2 transition-all text-natural-text-main",
                        passwordOtpError
                          ? "border-red-500 focus:ring-red-500/20"
                          : "border-natural-border focus:ring-natural-accent/20",
                      )}
                    />
                    {passwordOtpError && (
                      <p
                        id="admin-password-otp-error"
                        className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {passwordOtpError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-natural-border flex justify-end">
                <button
                  type="submit"
                  disabled={
                    isUpdatingPassword ||
                    isSendingPasswordOtp ||
                    (!passwordOtpSent && !isPasswordReadyForOtp) ||
                    (passwordOtpSent && (!passwordOtpCode || passwordOtpCode.length < 6))
                  }
                  title={
                    !passwordOtpSent && !isPasswordReadyForOtp
                      ? "Enter and confirm your new password first"
                      : undefined
                  }
                  className="flex items-center gap-2 bg-natural-accent text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-natural-accent"
                >
                  <Lock className="w-4 h-4" />
                  {isUpdatingPassword
                    ? "Verifying & Updating..."
                    : passwordOtpSent
                      ? "Verify OTP & Change Password"
                      : "Send OTP to Confirm Password Change"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Save Confirmation & Email Change OTP Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-natural-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0 bg-natural-accent shadow-natural-accent/20">
                {activeSection === "profile" && isEmailChanged ? (
                  <KeyRound className="w-8 h-8 text-white" />
                ) : (
                  <Save className="w-8 h-8 text-white" />
                )}
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                {activeSection === "profile" && isEmailChanged
                  ? emailOtpStep
                    ? "Enter Email Change OTP"
                    : "Confirm Email Address Change"
                  : "Save Changes?"}
              </h3>

              <p className="text-sm text-natural-text-light mb-6 leading-relaxed">
                {activeSection === "appearance" ? (
                  `Save current display preferences (${theme} theme with ${accentColor} accent) to your profile?`
                ) : isEmailChanged ? (
                  emailOtpStep ? (
                    <>
                      Enter the 6-digit confirmation code sent to{" "}
                      <strong className="text-natural-accent">
                        {emailOtpSentTo || formData.email.trim().toLowerCase()}
                      </strong>{" "}
                      to confirm changing your email to{" "}
                      <strong className="text-natural-accent">
                        {formData.email.trim().toLowerCase()}
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      You are changing your email from{" "}
                      <strong className="text-natural-text-main">{currentUser.email}</strong> to{" "}
                      <strong className="text-natural-accent">
                        {formData.email.trim().toLowerCase()}
                      </strong>
                      . A confirmation OTP will be sent to verify your new email address.
                    </>
                  )
                ) : (
                  "You are about to update your profile settings. Are you sure you want to proceed?"
                )}
              </p>

              {/* OTP Input inside modal when confirming an email change */}
              {activeSection === "profile" && isEmailChanged && emailOtpStep && (
                <div className="mb-6 text-left space-y-2">
                  <label
                    htmlFor="modal-email-change-otp"
                    className="block text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest"
                  >
                    Verification OTP Code <span className="text-red-500">*</span>
                  </label>
                  <p
                    id="modal-email-otp-hint"
                    className="text-[11px] text-natural-text-light"
                  >
                    Check the inbox of {emailOtpSentTo || formData.email.trim().toLowerCase()} for the 6-digit code.
                  </p>
                  <input
                    id="modal-email-change-otp"
                    name="email_change_otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    pattern="\d{6,8}"
                    maxLength={8}
                    placeholder="123456"
                    value={emailOtpCode}
                    aria-describedby="modal-email-otp-hint modal-email-otp-error"
                    aria-invalid={!!emailOtpError}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setEmailOtpCode(digits);
                      if (emailOtpError && digits.length >= 6) {
                        setEmailOtpError("");
                      }
                    }}
                    className={cn(
                      "w-full px-4 py-3 bg-natural-bg/50 border rounded-xl font-mono text-center text-lg tracking-[0.4em] focus:outline-none focus:ring-2 transition-all text-natural-text-main",
                      emailOtpError
                        ? "border-red-500 focus:ring-red-500/20"
                        : "border-natural-border focus:ring-natural-accent/20",
                    )}
                  />
                  <div className="flex items-center justify-between pt-1">
                    {emailOtpError ? (
                      <p
                        id="modal-email-otp-error"
                        className="text-[11px] font-semibold text-red-600 dark:text-red-400"
                      >
                        {emailOtpError}
                      </p>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={handleSendEmailChangeOtp}
                      disabled={isSendingEmailOtp || isSaving}
                      className="text-[11px] font-bold text-natural-accent hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {isSendingEmailOtp ? "Resending..." : "Resend OTP"}
                    </button>
                  </div>
                </div>
              )}

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
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isSendingEmailOtp}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white bg-natural-accent hover:bg-natural-accent/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isSaving || isSendingEmailOtp
                    ? "Processing..."
                    : activeSection === "profile" && isEmailChanged
                      ? emailOtpStep
                        ? "Verify OTP & Update Email"
                        : "Send Email Change OTP"
                      : "Confirm Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    setEmailOtpStep(false);
                    setEmailOtpCode("");
                    setEmailOtpError("");
                    setSaveMessage({ type: "", text: "" });
                  }}
                  disabled={isSaving || isSendingEmailOtp}
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
