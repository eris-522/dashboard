import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Calendar,
  User,
  MapPin,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Phone,
  Mail,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  Archive,
  XCircle,
  Boxes,
  Warehouse,
  RotateCcw,
  CheckCheck,
  PackageCheck,
  Eye,
  Receipt,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { cn } from "../lib/utils";
import { EventCalendar } from "../components/EventCalendar";
import { supabase } from "../utils/supabase";
import { useUser } from "../context/UserContext";
import { useInventory } from "../context/InventoryContext";
import { logAuditAction } from "../utils/auditLogger";

type SortField =
  | "customerName"
  | "date"
  | "budget"
  | "status"
  | "created_at"
  | null;
type SortOrder = "asc" | "desc" | null;

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export interface BookingPaymentInfo {
  payment_scheme: string;
  downpayment_amount: number;
  payment_method: string;
  payment_status: string;
  receipt_url: string;
  reference_number: string;
  terms_accepted: boolean;
  final_balance_amount: number;
  final_balance_status: string;
  final_balance_method: string;
  final_balance_reference: string;
  final_balance_receipt: string;
  installment_schedule: any[] | null;
}

export const getBookingPayment = (booking: any): BookingPaymentInfo => {
  let payment_method = booking?.payment_method || "";
  let payment_scheme = booking?.payment_scheme || "";
  let downpayment_amount = Number(booking?.downpayment_amount) || 0;
  let payment_status = booking?.payment_status || "Pending Verification";
  let receipt_url = booking?.receipt_url || "";
  let reference_number = booking?.reference_number || "";
  let terms_accepted = Boolean(booking?.terms_accepted);
  let final_balance_amount = Number(booking?.final_balance_amount) || 0;
  let final_balance_status = booking?.final_balance_status || "Unpaid";
  let final_balance_method = booking?.final_balance_method || "";
  let final_balance_reference = booking?.final_balance_reference || "";
  let final_balance_receipt = booking?.final_balance_receipt || "";
  let installment_schedule = booking?.installment_schedule || null;

  if (
    typeof booking?.food_allergies === "string" &&
    booking.food_allergies.includes("__PAYMENT_METADATA__:")
  ) {
    try {
      const raw = booking.food_allergies.split("__PAYMENT_METADATA__:")[1];
      const parsed = JSON.parse(raw);
      if (!payment_method) payment_method = parsed.method || "";
      if (!payment_scheme) payment_scheme = parsed.scheme || "";
      if (!downpayment_amount) downpayment_amount = Number(parsed.downpayment) || 0;
      if (!payment_status || payment_status === "Pending Verification") payment_status = parsed.status || "Pending Verification";
      if (!receipt_url) receipt_url = parsed.receipt || "";
      if (!reference_number) reference_number = parsed.ref || "";
      if (!terms_accepted) terms_accepted = Boolean(parsed.termsAccepted);
      if (!final_balance_amount) final_balance_amount = Number(parsed.balance) || 0;
      if (!final_balance_status || final_balance_status === "Unpaid") final_balance_status = parsed.finalBalanceStatus || "Unpaid";
      if (!final_balance_method) final_balance_method = parsed.finalBalanceMethod || "";
      if (!final_balance_reference) final_balance_reference = parsed.finalBalanceRef || "";
      if (!final_balance_receipt) final_balance_receipt = parsed.finalBalanceReceipt || "";
      if (!installment_schedule) installment_schedule = parsed.installments || null;
    } catch (e) {}
  }

  return {
    payment_scheme: payment_scheme || "Standard 50%",
    downpayment_amount,
    payment_method,
    payment_status,
    receipt_url,
    reference_number,
    terms_accepted,
    final_balance_amount,
    final_balance_status,
    final_balance_method,
    final_balance_reference,
    final_balance_receipt,
    installment_schedule,
  };
};

const formatEventDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  const date = new Date(`${dateStr}T12:00:00`);
  return isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const formatEventTime = (timeStr?: string) => {
  if (!timeStr) return "N/A";
  const date = new Date(`2000-01-01T${timeStr}`);
  return isNaN(date.getTime())
    ? timeStr
    : date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
};

export function BookingPage() {
  const { currentUser } = useUser();
  const {
    deductBookingInventory,
    restoreBookingInventory,
    calculatePackageEquipment,
    checkInventoryAvailability,
    completeBookingAndReturnInventory,
    reconcileCompletedEvents,
    isBookingDeducted,
  } = useInventory();
  const [bookings, setBookings] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [additionalServices, setAdditionalServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    order: null,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<{
    url: string;
    bookingName: string;
    ref?: string;
    method?: string;
    amount?: number;
    title?: string;
  } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | boolean>(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState<string | boolean>(
    false,
  );
  const [confirmAction, setConfirmAction] = useState<{
    type: "confirm" | "cancel" | "archive" | "create" | "complete";
    bookingId?: string;
    bookingName: string;
  } | null>(null);

  const [newBooking, setNewBooking] = useState({
    user_id: "",
    event_type: "Wedding Reception",
    package_id: "",
    date: "",
    time: "",
    guest_count: 50,
    additional_pax: 0,
    venueName: "",
    venueAddress: "",
    selected_menu_items: [] as string[],
    selected_add_ons: [] as string[],
  });

  useEffect(() => {
    setConfirmPassword("");
    setPasswordError(false);
    setCancelReason("");
    setCancelReasonError(false);
  }, [confirmAction]);

  useEffect(() => {
    // Fetch initial data
    fetchAllData();

    const intervalId = setInterval(() => {
      supabase
        .from("menu_items")
        .select("*")
        .neq("status", "Archived")
        .then(({ data }) => {
          if (data) setMenuItems(data);
        });
    }, 10000);

    // Subscribe to real-time changes on the bookings table
    const channel = supabase
      .channel("bookings-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          console.log("Booking change detected:", payload);
          fetchAllData(); // Refresh data when any booking changes
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          supabase
            .from("menu_items")
            .select("*")
            .neq("status", "Archived")
            .then(({ data }) => {
              if (data) setMenuItems(data);
            });
        },
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      clearInterval(intervalId);
      channel.unsubscribe();
    };
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);

      const { data: bData, error: bError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          profiles (*),
          packages (*)
        `,
        )
        .order("created_at", { ascending: false });

      if (bError) {
        const errorMsg = `Error fetching bookings: ${bError.message}`;
        setFetchError(errorMsg);
        console.error(errorMsg);
        setBookings([]);
      } else {
        setBookings(bData || []);
        setFetchError(null);
        if (bData && bData.length > 0) {
          reconcileCompletedEvents(bData);
        }
      }

      const [pRes, pkgRes, menuRes, incRes] = await Promise.all([
        supabase.from("profiles").select("*").neq("status", "Archived"),
        supabase.from("packages").select("*").neq("status", "Archived"),
        supabase.from("menu_items").select("*").neq("status", "Archived"),
        supabase.from("inclusions").select("*"),
      ]);

      if (pRes.error)
        console.error("Error fetching profiles:", pRes.error.message);
      else if (pRes.data) setCustomers(pRes.data);

      if (pkgRes.error)
        console.error("Error fetching packages:", pkgRes.error.message);
      else if (pkgRes.data) setPackages(pkgRes.data);

      if (menuRes.error)
        console.error("Error fetching menu items:", menuRes.error.message);
      else if (menuRes.data) setMenuItems(menuRes.data);

      if (incRes.error) {
        console.error("Error fetching inclusions:", incRes.error.message);
      } else if (incRes.data) {
        const validServices = incRes.data
          .filter((row: any) => row.items && row.items !== "-" && row.items.trim() !== "")
          .map((row: any) => ({
            id: row.id,
            name: row.items,
            category: row.category,
            price: 0,
          }));
        setAdditionalServices(validServices);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setFetchError(errorMsg);
      console.error("Unexpected error in fetchAllData:", error);
    } finally {
      setIsLoading(false);
    }
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

  const calculateBudget = (booking: any) => {
    let basePrice = 0;
    let additionalPaxTotal = 0;

    const pkg =
      booking.packages || packages.find((p) => p.id === booking.package_id);

    if (pkg && pkg.price) {
      basePrice = parseFloat(String(pkg.price).replace(/[^\d.-]/g, "")) || 0;
    }

    if (pkg && pkg.additional_pax_price && booking.additional_pax) {
      const addPrice =
        parseFloat(String(pkg.additional_pax_price).replace(/[^\d.-]/g, "")) ||
        0;
      additionalPaxTotal = addPrice * booking.additional_pax;
    }

    const servicesPrice = (booking.selected_add_ons || []).reduce(
      (acc: number, name: string) => {
        const service = additionalServices.find((s) => s.name === name);
        return (
          acc +
          (service
            ? parseFloat(String(service.price).replace(/[^\d.-]/g, "")) || 0
            : 0)
        );
      },
      0,
    );

    return basePrice + additionalPaxTotal + servicesPrice;
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const customerName =
        booking.profiles?.name || booking.profiles?.full_name || "Unknown User";
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        customerName.toLowerCase().includes(query) ||
        (booking.event_type || "").toLowerCase().includes(query) ||
        (booking.event_location || "").toLowerCase().includes(query);

      const currentStatus = booking.status || "Pending";
      let matchesStatus = false;
      if (statusFilter === "All Status") {
        matchesStatus = currentStatus !== "Archived" && currentStatus !== "Cancelled";
      } else if (statusFilter === "15-Day Billing Due") {
        if (currentStatus === "Cancelled" || currentStatus === "Archived") {
          matchesStatus = false;
        } else {
          const eventDateStr = booking.date || booking.event_date;
          const eventDate = new Date(eventDateStr);
          if (!isNaN(eventDate.getTime())) {
            const diffDays = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const payment = getBookingPayment(booking);
            // Booking occurring within next 30 days whose balance is not yet verified
            matchesStatus = diffDays >= 0 && diffDays <= 30 && payment.final_balance_status !== "Verified";
          }
        }
      } else {
        matchesStatus = currentStatus === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, bookings]);

  const sortedBookings = useMemo(() => {
    if (!sortConfig.field || !sortConfig.order) return filteredBookings;

    return [...filteredBookings].sort((a, b) => {
      const { field, order } = sortConfig;
      let valA: any =
        field === "customerName"
          ? a.profiles?.name || a.profiles?.full_name
          : field
            ? a[field]
            : "";
      let valB: any =
        field === "customerName"
          ? b.profiles?.name || b.profiles?.full_name
          : field
            ? b[field]
            : "";

      if (field === "budget") {
        valA = calculateBudget(a);
        valB = calculateBudget(b);
      } else if (field === "date") {
        valA = new Date(a.event_date || 0).getTime();
        valB = new Date(b.event_date || 0).getTime();
      } else if (field === "created_at") {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      } else if (field === "status") {
        const statusOrder: Record<string, number> = {
          Confirmed: 1,
          Pending: 2,
          Cancelled: 3,
          Archived: 4,
        };
        valA = statusOrder[a.status || "Pending"] || 5;
        valB = statusOrder[b.status || "Pending"] || 5;
      }

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredBookings, sortConfig, packages, additionalServices]);

  const handleCreateBooking = () => {
    setIsModalOpen(false);
    const selectedCustomer = customers.find((c) => c.id === newBooking.user_id);
    setConfirmAction({
      type: "create",
      bookingName: selectedCustomer?.name || "New Client",
    });
  };

  const resetNewBooking = () => {
    setNewBooking({
      user_id: "",
      event_type: "Wedding Reception",
      package_id: "",
      date: "",
      time: "",
      guest_count: 50,
      additional_pax: 0,
      venueName: "",
      venueAddress: "",
      selected_menu_items: [],
      selected_add_ons: [],
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, bookingId } = confirmAction;

    if (type === "cancel" && !cancelReason.trim()) {
      setCancelReasonError("Please provide a reason for cancellation.");
      return;
    }

    if (["confirm", "cancel", "archive"].includes(type)) {
      if (!confirmPassword) {
        setPasswordError("Password is required to proceed.");
        return;
      }

      let isPasswordValid = false;
      if (currentUser?.id === 0 || currentUser?.id === "0") {
        isPasswordValid = confirmPassword === "admin123";
      } else if (currentUser?.email) {
        const { error } = await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password: confirmPassword,
        });
        isPasswordValid = !error;
      }

      if (!isPasswordValid) {
        setPasswordError("Incorrect admin password.");
        return;
      }
    }

    if (type === "confirm" && bookingId) {
      const targetBooking = bookings.find((b) => b.id === bookingId);
      const pkgName = targetBooking?.packages?.name || (packages.find(p => p.id === targetBooking?.package_id)?.name) || targetBooking?.package || packages[0]?.name || "Event Package";
      const totalPax = (Number(targetBooking?.guest_count) || 50) + (Number(targetBooking?.additional_pax) || 0);

      // Attempt to update with payment_status: "Verified"
      let { error: updateErr } = await supabase
        .from("bookings")
        .update({ status: "Confirmed", payment_status: "Verified" })
        .eq("id", bookingId);

      if (updateErr) {
        // Fallback if payment_status column does not exist yet
        const { error: fallbackErr } = await supabase
          .from("bookings")
          .update({ status: "Confirmed" })
          .eq("id", bookingId);
        updateErr = fallbackErr;

        // Also update fallback metadata in food_allergies if present
        if (!fallbackErr && targetBooking?.food_allergies?.includes("__PAYMENT_METADATA__:")) {
          try {
            const parts = targetBooking.food_allergies.split("__PAYMENT_METADATA__:");
            const meta = JSON.parse(parts[1]);
            meta.status = "Verified";
            const updatedAllergies = `${parts[0]}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
            await supabase.from("bookings").update({ food_allergies: updatedAllergies }).eq("id", bookingId);
          } catch (e) {}
        }
      }

      if (updateErr) {
        console.error("Error confirming booking:", updateErr.message);
        setFetchError(`Failed to confirm booking: ${updateErr.message}`);
        setConfirmAction(null);
        return;
      }

      // Automatically deduct package equipment supplies from inventory
      await deductBookingInventory(bookingId, confirmAction.bookingName, pkgName, totalPax, targetBooking?.packages?.inclusions || targetBooking?.inclusions);

      window.dispatchEvent(
        new CustomEvent("markAdminNotifRead", {
          detail: { id: bookingId, status: "Confirmed" },
        }),
      );
      await logAuditAction({
        action: "Confirmed Booking",
        target: confirmAction.bookingName,
        type: "Update",
        details: `Approved booking for ${confirmAction.bookingName} and deducted ${totalPax} Pax equipment from inventory (${pkgName})`,
      });
    } else if (type === "cancel" && bookingId) {
      const targetBooking = bookings.find((b) => b.id === bookingId);
      const payment = targetBooking ? getBookingPayment(targetBooking) : null;
      const totalBudget = targetBooking ? calculateBudget(targetBooking) : 0;
      const downpaymentAmount =
        payment?.downpayment_amount ||
        (payment?.receipt_url
          ? Math.round(totalBudget * (payment?.payment_scheme === "Standard 50%" ? 0.5 : 0.2))
          : 0);

      const { error: cancelErr } = await supabase
        .from("bookings")
        .update({
          status: "Cancelled",
          cancellation_reason: cancelReason.trim(),
          cancelled_by: "Admin",
        })
        .eq("id", bookingId);

      if (cancelErr) {
        console.error("Error cancelling booking:", cancelErr.message);
        setFetchError(`Failed to cancel booking: ${cancelErr.message}`);
        setConfirmAction(null);
        return;
      }

      // Automatically restore package equipment back to inventory
      await restoreBookingInventory(bookingId, confirmAction.bookingName);

      window.dispatchEvent(
        new CustomEvent("markAdminNotifRead", {
          detail: { id: bookingId, status: "Cancelled" },
        }),
      );
      await logAuditAction({
        action: "Cancelled Booking",
        target: confirmAction.bookingName,
        type: "Update",
        details: `Cancelled booking for ${confirmAction.bookingName} and restored reserved inventory supplies. Reason: ${cancelReason.trim()}`,
      });

      // Automatically record retained/forfeited funds per Catering Contract Clauses 1 & 16
      if (downpaymentAmount > 0) {
        await logAuditAction({
          action: "Forfeited Funds Accounting (Retained Revenue)",
          target: confirmAction.bookingName,
          type: "System",
          details: `Booking #${bookingId} cancelled. Retained non-refundable downpayment/deposit of ₱${downpaymentAmount.toLocaleString()} as Forfeited Revenue per Catering Contract Clauses 1 & 16.`,
        });
      }
    } else if (type === "complete" && bookingId) {
      const { error: completeErr } = await supabase
        .from("bookings")
        .update({ status: "Completed" })
        .eq("id", bookingId);

      if (completeErr) {
        console.error("Error completing booking:", completeErr.message);
        setFetchError(`Failed to complete booking: ${completeErr.message}`);
        setConfirmAction(null);
        return;
      }

      // Automatically restore package equipment back to inventory
      await restoreBookingInventory(
        bookingId,
        confirmAction.bookingName,
        `Event Completed - All supplies returned to warehouse inventory (Booking #${bookingId})`
      );

      await logAuditAction({
        action: "Completed Booking",
        target: confirmAction.bookingName,
        type: "Update",
        details: `Marked event as Completed for ${confirmAction.bookingName} and returned all allocated supplies to warehouse inventory`,
      });
    } else if (type === "archive" && bookingId) {
      const { error: archiveErr } = await supabase
        .from("bookings")
        .update({ status: "Archived" })
        .eq("id", bookingId);

      if (archiveErr) {
        console.error("Error archiving booking:", archiveErr.message);
        setFetchError(`Failed to archive booking: ${archiveErr.message}`);
        setConfirmAction(null);
        return;
      }

      // If it was confirmed and deducted, restore inventory
      await restoreBookingInventory(bookingId, confirmAction.bookingName);

      await logAuditAction({
        action: "Archived Booking",
        target: confirmAction.bookingName,
        type: "Delete",
        details: `Moved booking for ${confirmAction.bookingName} to archives`,
      });
    } else if (type === "create") {
      const locationString = `${newBooking.event_type || "Event"} - ${newBooking.venueName || "Venue"}, ${newBooking.venueAddress || "Address"}`;
      const { data, error: insertErr } = await supabase
        .from("bookings")
        .insert([
          {
            user_id: newBooking.user_id,
            package_id: newBooking.package_id,
            event_date: newBooking.date,
            event_time: newBooking.time || "08:00:00",
            event_location: locationString,
            guest_count: Number(newBooking.guest_count) || 50,
            additional_pax: Number(newBooking.additional_pax) || 0,
            selected_menu_items: newBooking.selected_menu_items || [],
            food_allergies: "",
            status: "Confirmed",
          },
        ])
        .select();

      if (insertErr) {
        console.error("Error creating booking:", insertErr.message);
        setFetchError(`Failed to create booking: ${insertErr.message}`);
        setConfirmAction(null);
        return;
      }

      if (data && data.length > 0) {
        const selectedPkg = packages.find((p) => p.id === newBooking.package_id);
        const pkgName = selectedPkg?.name || packages[0]?.name || "Event Package";
        const totalPax = Number(newBooking.guest_count || 50) + Number(newBooking.additional_pax || 0);
        // Auto-deduct inventory
        await deductBookingInventory(data[0].id, confirmAction.bookingName, pkgName, totalPax, selectedPkg?.inclusions);

        window.dispatchEvent(
          new CustomEvent("markAdminNotifRead", {
            detail: { id: data[0].id, status: "Confirmed" },
          }),
        );
      }
      await logAuditAction({
        action: "Created Booking",
        target: confirmAction.bookingName,
        type: "Create",
        details: `Manually created and confirmed a booking for ${confirmAction.bookingName}, automatically allocating warehouse inventory`,
      });
      resetNewBooking();
    }

    await fetchAllData();
    setConfirmAction(null);
    setSelectedBooking(null);
  };

  const handleVerifyFinalBalance = async (bookingId: number | string) => {
    const targetBooking = bookings.find((b) => String(b.id) === String(bookingId));
    if (!targetBooking) return;
    const clientName = targetBooking.profiles?.name || targetBooking.profiles?.full_name || "Client";

    let { error } = await supabase
      .from("bookings")
      .update({ final_balance_status: "Verified" })
      .eq("id", bookingId);

    if (error && error.message.toLowerCase().includes("column")) {
      console.warn("Direct column not present, using fallback metadata update", error.message);
      if (targetBooking.food_allergies?.includes("__PAYMENT_METADATA__:")) {
        try {
          const parts = targetBooking.food_allergies.split("__PAYMENT_METADATA__:");
          const meta = JSON.parse(parts[1]);
          meta.finalBalanceStatus = "Verified";
          const updated = `${parts[0].trim() ? parts[0].trim() + "\n" : ""}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
          const fb = await supabase.from("bookings").update({ food_allergies: updated }).eq("id", bookingId);
          error = fb.error;
        } catch (e) {}
      }
    }

    if (error) {
      console.error("Error verifying final balance:", error.message);
      setFetchError(`Failed to verify final balance: ${error.message}`);
      return;
    }

    await logAuditAction({
      action: "Verified Final Balance Payment",
      target: clientName,
      type: "Update",
      details: `Admin confirmed and verified 15-day final balance settlement for ${clientName} (Booking #${bookingId})`,
    });

    if (selectedBooking && String(selectedBooking.id) === String(bookingId)) {
      setSelectedBooking({
        ...selectedBooking,
        final_balance_status: "Verified",
      });
    }

    await fetchAllData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Booking Management
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Track and coordinate your catering events
          </p>
        </div>

        {/* Hidden for now:
          <button
            onClick={() => {
              resetNewBooking();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create New Booking
          </button>
        */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Bookings",
            value: bookings
              .filter((b) => (b.status || "Pending") !== "Archived")
              .length.toString(),
            sub: "Overall",
          },
          {
            label: "Confirmed",
            value: bookings
              .filter((b) => (b.status || "Pending") === "Confirmed")
              .length.toString(),
            sub: "Paid/Ready",
          },
          {
            label: "Pending",
            value: bookings
              .filter((b) => (b.status || "Pending") === "Pending")
              .length.toString(),
            sub: "Needs Review",
          },
          {
            label: "Est. Revenue",
            value: `₱${(
              bookings
                .filter(
                  (b) =>
                    (b.status || "Pending") !== "Archived" &&
                    (b.status || "Pending") !== "Cancelled",
                )
                .reduce((acc, b) => acc + calculateBudget(b), 0) / 1000
            ).toFixed(0)}k`,
            sub: "Projected",
          },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 bg-white">
            <p className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest mb-1">
              {s.label}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-natural-text-main font-serif tracking-tight">
                {s.value}
              </span>
              <span className="text-[0.6rem] text-natural-text-light font-medium">
                {s.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card bg-white overflow-hidden">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by venue or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider"
            >
              <option>All Status</option>
              <option>Confirmed</option>
              <option>Completed</option>
              <option>Pending</option>
              <option value="15-Day Billing Due">15-Day Billing Due</option>
              <option>Cancelled</option>
              <option>Archived</option>
            </select>
            <div className="h-6 w-px bg-natural-border mx-1" />
            <div className="flex gap-1 bg-natural-bg/50 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1 text-[0.65rem] font-bold uppercase rounded transition-all",
                  viewMode === "list"
                    ? "bg-white shadow-xs text-natural-accent border border-natural-border"
                    : "text-natural-text-light hover:text-natural-text-main",
                )}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={cn(
                  "px-3 py-1 text-[0.65rem] font-bold uppercase rounded transition-all",
                  viewMode === "calendar"
                    ? "bg-white shadow-xs text-natural-accent border border-natural-border"
                    : "text-natural-text-light hover:text-natural-text-main",
                )}
              >
                Calendar
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {viewMode === "list" ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-natural-bg/30">
                  <th
                    className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("customerName")}
                  >
                    <div className="flex items-center gap-1.5">
                      Customer
                      {sortConfig.field === "customerName" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                    Event Details
                  </th>
                  <th
                    className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1.5">
                      Schedule
                      {sortConfig.field === "date" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center gap-1.5">
                      Applied On
                      {sortConfig.field === "created_at" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("budget")}
                  >
                    <div className="flex items-center gap-1.5">
                      Budget
                      {sortConfig.field === "budget" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                    Downpayment
                  </th>
                  <th
                    className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1.5">
                      Status
                      {sortConfig.field === "status" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className={cn(
                      "transition-colors group",
                      booking.status === "Archived"
                        ? "bg-natural-bg/40 opacity-60 grayscale-[0.5]"
                        : "hover:bg-natural-bg/20",
                    )}
                  >
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <div>
                        <p className="text-sm font-bold text-natural-text-main tracking-tight leading-tight">
                          {booking.profiles?.name ||
                            booking.profiles?.full_name ||
                            "Unknown User"}
                        </p>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <p className="text-[10px] text-natural-text-light flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5" />{" "}
                            {booking.profiles?.email || "N/A"}
                          </p>
                          <p className="text-[10px] text-natural-text-light flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />{" "}
                            {booking.profiles?.phone_number ||
                              booking.profiles?.phone ||
                              "N/A"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <div>
                        <p className="text-xs font-bold text-natural-text-main">
                          {booking.event_type || "Event"}
                        </p>
                        <p className="text-[10px] text-natural-accent font-bold uppercase tracking-wider mt-0.5">
                          {booking.packages?.name || "Custom"} Package
                        </p>
                        <p className="text-[10px] text-natural-text-light mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{" "}
                          {(booking.event_location || "").split(" - ")[0]}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-natural-text-main font-medium flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-natural-accent opacity-60" />{" "}
                          {formatEventDate(booking.event_date)}
                        </p>
                        <p className="text-[10px] text-natural-text-light flex items-center gap-2">
                          <Clock className="w-3 h-3" />{" "}
                          {formatEventTime(booking.event_time)}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-natural-text-main font-medium">
                          {booking.created_at
                            ? new Date(booking.created_at).toLocaleDateString(
                                undefined,
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )
                            : "N/A"}
                        </p>
                        <p className="text-[10px] text-natural-text-light">
                          {booking.created_at
                            ? new Date(booking.created_at).toLocaleTimeString(
                                undefined,
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <p className="text-xs font-bold text-natural-text-main">
                        ₱{calculateBudget(booking).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-natural-text-light uppercase font-bold">
                        {booking.guest_count} Pax
                        {booking.additional_pax > 0 &&
                          ` (+${booking.additional_pax})`}
                      </p>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      {(() => {
                        const payment = getBookingPayment(booking);
                        const estBudget = calculateBudget(booking);
                        const is50Plan = payment.payment_scheme === "Standard 50%";
                        const downpaymentDue =
                          payment.downpayment_amount > 0
                            ? payment.downpayment_amount
                            : Math.round(estBudget * (is50Plan ? 0.5 : 0.2));
                        const isVerified =
                          payment.payment_status === "Verified" ||
                          (booking.status || "Pending") === "Confirmed";

                        return (
                          <div className="flex flex-col gap-1.5 min-w-[130px]">
                            {/* Downpayment info & Scheme Badge */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-natural-text-main">
                                ₱{downpaymentDue.toLocaleString()}
                              </p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-natural-bg font-bold text-natural-accent border border-natural-border/60">
                                {is50Plan ? "50% Plan" : "20% Deposit"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                  isVerified
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : payment.receipt_url
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-gray-50 text-gray-500 border-gray-200",
                                )}
                              >
                                {isVerified
                                  ? "Deposit Verified"
                                  : payment.receipt_url
                                    ? "Review Deposit"
                                    : "Unpaid"}
                              </span>
                            </div>

                            {payment.receipt_url && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingReceipt({
                                    url: payment.receipt_url,
                                    bookingName:
                                      booking.profiles?.name ||
                                      booking.profiles?.full_name ||
                                      "Client",
                                    ref: payment.reference_number,
                                    method: payment.payment_method,
                                    amount: downpaymentDue,
                                    title: "Initial Security Deposit",
                                  });
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-natural-accent hover:underline cursor-pointer"
                              >
                                <Receipt className="w-3 h-3" />
                                View Deposit Slip
                              </button>
                            )}

                            {/* 15-Day Final Balance Settlement Row */}
                            {payment.final_balance_amount > 0 && (
                              <div className="pt-1.5 mt-0.5 border-t border-natural-border/50 flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-1 text-[10px]">
                                  <span className="text-natural-text-light font-medium">15-Day Balance:</span>
                                  <span className="font-bold text-natural-text-main font-serif">
                                    ₱{payment.final_balance_amount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span
                                    className={cn(
                                      "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                      payment.final_balance_status === "Verified"
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : payment.final_balance_status === "Pending Verification"
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-gray-100 text-gray-600 border-gray-200",
                                    )}
                                  >
                                    {payment.final_balance_status === "Verified"
                                      ? "Balance Paid"
                                      : payment.final_balance_status === "Pending Verification"
                                        ? "Verify Balance"
                                        : "Balance Due"}
                                  </span>
                                </div>
                                {payment.final_balance_receipt && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingReceipt({
                                        url: payment.final_balance_receipt,
                                        bookingName:
                                          booking.profiles?.name ||
                                          booking.profiles?.full_name ||
                                          "Client",
                                        ref: payment.final_balance_reference,
                                        method: payment.final_balance_method,
                                        amount: payment.final_balance_amount,
                                        title: "15-Day Final Balance Settlement",
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-natural-accent hover:underline cursor-pointer"
                                  >
                                    <Receipt className="w-3 h-3" />
                                    View Balance Slip
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <span
                        className={cn(
                          "text-[0.6rem] font-bold uppercase tracking-widest px-2 py-1 rounded border",
                          (booking.status || "Pending") === "Confirmed"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : (booking.status || "Pending") === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : (booking.status || "Pending") === "Pending"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : (booking.status || "Pending") === "Cancelled"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : (booking.status || "Pending") === "Archived"
                                    ? "bg-gray-100 text-gray-600 border-gray-300"
                                    : "bg-gray-50 text-gray-700 border-gray-200",
                        )}
                      >
                        {booking.status || "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <div className="flex items-center gap-2">
                        {(booking.status || "Pending") !== "Archived" && (
                          <>
                            {((booking.status || "Pending") === "Inquiry" ||
                              (booking.status || "Pending") === "Pending") && (
                              <>
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "confirm",
                                      bookingId: booking.id,
                                      bookingName:
                                        booking.profiles?.name ||
                                        booking.profiles?.full_name ||
                                        "Unknown User",
                                    })
                                  }
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                  title="Confirm Booking"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "cancel",
                                      bookingId: booking.id,
                                      bookingName:
                                        booking.profiles?.name ||
                                        booking.profiles?.full_name ||
                                        "Unknown User",
                                    })
                                  }
                                  className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                  title="Cancel Booking"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {(booking.status || "Pending") === "Confirmed" && (
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    type: "complete",
                                    bookingId: booking.id,
                                    bookingName:
                                      booking.profiles?.name ||
                                      booking.profiles?.full_name ||
                                      "Unknown User",
                                  })
                                }
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Mark Event Completed & Return Equipment to Inventory"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="p-1.5 text-natural-text-light hover:text-natural-accent hover:bg-natural-accent/5 rounded-lg transition-all"
                              title="View Details"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  type: "archive",
                                  bookingId: booking.id,
                                  bookingName:
                                    booking.profiles?.name ||
                                    booking.profiles?.full_name ||
                                    "Unknown User",
                                })
                              }
                              className="p-1.5 text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50 rounded-lg transition-all"
                              title="Archive Booking"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(booking.status || "Pending") === "Archived" && (
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="p-1.5 text-natural-text-light/50 hover:text-natural-text-main hover:bg-natural-bg/50 rounded-lg transition-all"
                            title="View Archived Details"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6">
              <EventCalendar
                bookings={filteredBookings.map((b) => ({
                  id: b.id,
                  customerName:
                    b.profiles?.name || b.profiles?.full_name || "Unknown User",
                  email: b.profiles?.email || "",
                  phone: b.profiles?.phone_number || b.profiles?.phone || "",
                  eventType: b.event_type || "",
                  package: b.packages?.name || "",
                  date: b.event_date || "",
                  time: formatEventTime(b.event_time),
                  guestCount: b.guest_count || 0,
                  additionalPax: b.additional_pax || 0,
                  venueName: (b.event_location || "").split(" - ")[0] || "",
                  venueAddress: (b.event_location || "").split(" - ")[1] || "",
                  menu: b.selected_menu_items || [],
                  additionalServices: b.selected_add_ons || [],
                  budget: calculateBudget(b),
                  status: b.status || "Pending",
                }))}
                detailedView={true}
              />
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between bg-natural-bg/20 shrink-0">
              <div>
                <h3 className="text-xl font-serif font-bold text-natural-text-main">
                  Create New Booking
                </h3>
                <p className="text-xs text-natural-text-light font-medium uppercase tracking-wider mt-1">
                  Select client and configure event details
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-natural-bg rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-natural-text-light" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <section className="space-y-4">
                <h4 className="text-[0.7rem] font-bold text-natural-accent uppercase tracking-[0.2em] border-b border-natural-accent/20 pb-2">
                  Registered Customer Link
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Select Client
                    </label>
                    <select
                      value={newBooking.user_id}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          user_id: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    >
                      <option value="">-- Choose registered client --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 opacity-50">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Email (Auto-filled)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        customers.find((c) => c.id === newBooking.user_id)
                          ?.email || ""
                      }
                      className="w-full px-4 py-2.5 bg-gray-100 border border-natural-border rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1 opacity-50">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Phone (Auto-filled)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        customers.find((c) => c.id === newBooking.user_id)
                          ?.phone || ""
                      }
                      className="w-full px-4 py-2.5 bg-gray-100 border border-natural-border rounded-xl text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-[0.7rem] font-bold text-natural-accent uppercase tracking-[0.2em] border-b border-natural-accent/20 pb-2">
                  Event & Package Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Event Type
                    </label>
                    <input
                      type="text"
                      value={newBooking.event_type}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          event_type: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                      placeholder="e.g. Wedding Reception"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Package Selected
                    </label>
                    <select
                      value={newBooking.package_id}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          package_id: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all font-medium"
                    >
                      <option value="">Select a package...</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.price})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Guest Count (Pax)
                    </label>
                    <input
                      type="number"
                      value={newBooking.guest_count}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          guest_count: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Additional Pax
                    </label>
                    <input
                      type="number"
                      value={newBooking.additional_pax || 0}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          additional_pax: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Event Date
                    </label>
                    <input
                      type="date"
                      value={newBooking.date}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, date: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Event Time
                    </label>
                    <input
                      type="time"
                      value={newBooking.time}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, time: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                      Venue Name
                    </label>
                    <input
                      type="text"
                      value={newBooking.venueName}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          venueName: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                      placeholder="e.g. Manila Hotel - MacArthur Suite"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Venue Full Address
                  </label>
                  <input
                    type="text"
                    value={newBooking.venueAddress}
                    onChange={(e) =>
                      setNewBooking({
                        ...newBooking,
                        venueAddress: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    placeholder="Full detailed address..."
                  />
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <section className="space-y-4">
                  <h4 className="text-[0.7rem] font-bold text-natural-accent uppercase tracking-[0.2em] border-b border-natural-accent/20 pb-2">
                    Menu Selection
                  </h4>
                  <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
                    {menuItems.map((item) => {
                      const isUnavailable = item.status === "Not Available";
                      return (
                        <label
                          key={item.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg transition-colors group",
                            isUnavailable
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-natural-bg/50 cursor-pointer",
                          )}
                        >
                          <input
                            type="checkbox"
                            disabled={isUnavailable}
                            className="w-3.5 h-3.5 rounded border-natural-border text-natural-accent focus:ring-natural-accent/20"
                            checked={newBooking.selected_menu_items.includes(
                              item.name,
                            )}
                            onChange={(e) => {
                              if (isUnavailable) return;
                              const current = newBooking.selected_menu_items;
                              const updated = e.target.checked
                                ? [...current, item.name]
                                : current.filter((n) => n !== item.name);
                              setNewBooking({
                                ...newBooking,
                                selected_menu_items: updated,
                              });
                            }}
                          />
                          <div className="flex flex-1 justify-between items-center">
                            <span className="text-xs font-medium text-natural-text-main group-hover:text-natural-accent transition-colors">
                              {item.name}{" "}
                              <span className="text-[9px] text-gray-400">
                                ({item.category}
                                {item.sub_category
                                  ? ` - ${item.sub_category}`
                                  : ""}
                                )
                              </span>
                            </span>
                            {isUnavailable && (
                              <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded uppercase tracking-widest">
                                Not Available
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-[0.7rem] font-bold text-natural-accent uppercase tracking-[0.2em] border-b border-natural-accent/20 pb-2">
                    Additional Services
                  </h4>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
                    {additionalServices.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-3 p-3 bg-natural-bg/30 border border-natural-border rounded-xl cursor-pointer hover:bg-natural-bg/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-natural-border text-natural-accent focus:ring-natural-accent/20"
                          checked={newBooking.selected_add_ons.includes(
                            service.name,
                          )}
                          onChange={(e) => {
                            const current = newBooking.selected_add_ons;
                            if (e.target.checked) {
                              setNewBooking({
                                ...newBooking,
                                selected_add_ons: [...current, service.name],
                              });
                            } else {
                              setNewBooking({
                                ...newBooking,
                                selected_add_ons: current.filter(
                                  (s) => s !== service.name,
                                ),
                              });
                            }
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-natural-text-main">
                            {service.name}
                          </p>
                          <p className="text-[10px] text-natural-text-light/70 uppercase tracking-tighter">
                            + ₱
                            {parseFloat(String(service.price)).toLocaleString()}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex items-center justify-end gap-4 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-xs font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-text-main transition-colors"
              >
                Cancel Information
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={
                  !newBooking.user_id ||
                  !newBooking.package_id ||
                  !newBooking.date
                }
                className="bg-natural-accent text-white px-10 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save & Create Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between shrink-0">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                Booking Overview
              </h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 hover:bg-natural-bg rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-natural-text-light" />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-2xl font-serif font-bold text-natural-text-main">
                    {selectedBooking.profiles?.name ||
                      selectedBooking.profiles?.full_name ||
                      "Unknown User"}
                  </h4>
                  <p className="text-sm font-medium text-natural-text-light">
                    {selectedBooking.event_type} •{" "}
                    {selectedBooking.packages?.name} Package
                    <br />
                    <span className="text-[10px] uppercase tracking-widest mt-1 block opacity-70">
                      Applied On:{" "}
                      {selectedBooking.created_at
                        ? new Date(selectedBooking.created_at).toLocaleString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "N/A"}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      "text-[0.6rem] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border",
                      (selectedBooking.status || "Pending") === "Confirmed"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : (selectedBooking.status || "Pending") === "Cancelled"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : (selectedBooking.status || "Pending") === "Archived"
                            ? "bg-gray-100 text-gray-600 border-gray-300"
                            : "bg-orange-50 text-orange-700 border-orange-200",
                    )}
                  >
                    {selectedBooking.status || "Pending"}
                  </span>
                  {((selectedBooking.status || "Pending") === "Confirmed" ||
                    (selectedBooking.status || "Pending") === "Cancelled") && (
                    <span className="text-[9px] font-bold text-natural-text-light uppercase tracking-widest">
                      {selectedBooking.status === "Confirmed"
                        ? "Confirmed on"
                        : "Cancelled on"}
                      :{" "}
                      {selectedBooking.updated_at
                        ? new Date(selectedBooking.updated_at).toLocaleString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : selectedBooking.created_at
                          ? new Date(selectedBooking.created_at).toLocaleString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : "N/A"}
                    </span>
                  )}
                </div>
              </div>

              {(selectedBooking.status || "Pending") === "Cancelled" && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">
                    Reason for Cancellation
                  </p>
                  <p className="text-sm text-red-900 italic">
                    "
                    {selectedBooking.cancellation_reason &&
                    selectedBooking.cancellation_reason.trim() !== ""
                      ? selectedBooking.cancellation_reason
                      : "No reason provided"}
                    "
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 py-6 border-y border-natural-border/50">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-natural-accent" />
                    <div>
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mb-0.5">
                        Date & Time
                      </p>
                      <p className="text-sm font-semibold text-natural-text-main">
                        {formatEventDate(selectedBooking.event_date)} at{" "}
                        {formatEventTime(selectedBooking.event_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-natural-accent" />
                    <div>
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mb-0.5">
                        Location
                      </p>
                      <p className="text-sm font-semibold text-natural-text-main">
                        {(selectedBooking.event_location || "").split(" - ")[0]}
                      </p>
                      <p className="text-xs text-natural-text-light mt-0.5">
                        {(selectedBooking.event_location || "").split(" - ")[1]}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-natural-accent shrink-0 mt-0.5" />
                    <div className="w-full pr-4">
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mb-3">
                        Budget Breakdown
                      </p>
                      {(() => {
                        const pkg =
                          selectedBooking.packages ||
                          packages.find(
                            (p) => p.id === selectedBooking.package_id,
                          );
                        const basePrice =
                          pkg && pkg.price
                            ? parseFloat(
                                String(pkg.price).replace(/[^\d.-]/g, ""),
                              ) || 0
                            : 0;
                        const addPrice =
                          pkg && pkg.additional_pax_price
                            ? parseFloat(
                                String(pkg.additional_pax_price).replace(
                                  /[^\d.-]/g,
                                  "",
                                ),
                              ) || 0
                            : 0;
                        const additionalPaxTotal =
                          selectedBooking.additional_pax
                            ? addPrice * selectedBooking.additional_pax
                            : 0;
                        const servicesPrice = (
                          selectedBooking.selected_add_ons || []
                        ).reduce((acc: number, name: string) => {
                          const service = additionalServices.find(
                            (s) => s.name === name,
                          );
                          return (
                            acc +
                            (service
                              ? parseFloat(
                                  String(service.price).replace(/[^\d.-]/g, ""),
                                ) || 0
                              : 0)
                          );
                        }, 0);
                        const totalBudget =
                          basePrice + additionalPaxTotal + servicesPrice;

                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between text-[0.7rem] text-natural-text-main font-medium">
                              <span>
                                Base Package ({selectedBooking.guest_count} Pax)
                              </span>
                              <span>₱{basePrice.toLocaleString()}</span>
                            </div>
                            {selectedBooking.additional_pax > 0 && (
                              <div className="flex justify-between text-[0.7rem] text-natural-text-main font-medium">
                                <span>
                                  Extra Pax ({selectedBooking.additional_pax} @
                                  ₱{addPrice.toLocaleString()})
                                </span>
                                <span>
                                  ₱{additionalPaxTotal.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {servicesPrice > 0 && (
                              <div className="flex justify-between text-[0.7rem] text-natural-text-main font-medium">
                                <span>Add-on Services</span>
                                <span>₱{servicesPrice.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-3 mt-3 border-t border-natural-border/50">
                              <span className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                                Total Estimated
                              </span>
                              <span className="text-lg font-bold text-natural-accent font-serif italic leading-none">
                                ₱{totalBudget.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-natural-accent" />
                    <div>
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mb-0.5">
                        Contact
                      </p>
                      <p className="text-sm font-semibold text-natural-text-main">
                        {selectedBooking.profiles?.phone_number ||
                          selectedBooking.profiles?.phone ||
                          "N/A"}
                      </p>
                      <p className="text-xs text-natural-text-light mt-0.5">
                        {selectedBooking.profiles?.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Scheme & Installment Ledger Section (Catering Contract Clause 1 & Clause 16) */}
              {(() => {
                const payment = getBookingPayment(selectedBooking);
                const totalBudget = calculateBudget(selectedBooking);
                const is50Percent = payment.payment_scheme === "Standard 50%";

                const downpaymentDue =
                  payment.downpayment_amount > 0
                    ? payment.downpayment_amount
                    : Math.round(totalBudget * (is50Percent ? 0.5 : 0.2));

                const balanceDue = Math.max(0, totalBudget - downpaymentDue);
                const finalBalanceAmount =
                  payment.final_balance_amount > 0
                    ? payment.final_balance_amount
                    : balanceDue;

                const isDepositVerified =
                  payment.payment_status === "Verified" ||
                  (selectedBooking.status || "Pending") === "Confirmed";

                const isFinalVerified = payment.final_balance_status === "Verified";
                const hasFinalReceipt = Boolean(payment.final_balance_receipt);

                // 15-Day Balance Settlement Deadline Calculation
                let deadlineStr = "N/A";
                let daysRemaining: number | null = null;
                if (selectedBooking.event_date) {
                  const evDate = new Date(selectedBooking.event_date);
                  const dl = new Date(evDate);
                  dl.setDate(dl.getDate() - 15);
                  deadlineStr = dl.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  daysRemaining = Math.ceil((dl.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                }

                return (
                  <div className="p-5 bg-gradient-to-br from-natural-bg/70 via-natural-bg/30 to-amber-50/40 border border-natural-border rounded-2xl space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-natural-accent/10 flex items-center justify-center text-natural-accent shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-natural-text-main uppercase tracking-wider">
                              Payment Scheme & Ledger
                            </h5>
                            <span
                              className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                                is50Percent
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              )}
                            >
                              {payment.payment_scheme}
                            </span>
                          </div>
                          <p className="text-[10px] text-natural-text-light">
                            Catering Agreement Clauses 1 & 16 Billing Schedule
                          </p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border flex items-center gap-1 self-start sm:self-auto",
                          isDepositVerified
                            ? "bg-green-50 text-green-700 border-green-200"
                            : payment.receipt_url
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                        )}
                      >
                        {isDepositVerified ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Deposit Confirmed
                          </>
                        ) : payment.receipt_url ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            Slip Uploaded (Needs Review)
                          </>
                        ) : (
                          "No Deposit Slip"
                        )}
                      </span>
                    </div>

                    {/* Cost Overview Grid */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-natural-border/60 text-center">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-natural-text-light">
                          Total Event Cost
                        </p>
                        <p className="text-sm font-bold text-natural-text-main font-serif">
                          ₱{totalBudget.toLocaleString()}
                        </p>
                      </div>
                      <div className="border-x border-natural-border/40 px-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-natural-accent">
                          {is50Percent ? "50% Downpayment" : "20% Deposit"}
                        </p>
                        <p className="text-sm font-bold text-natural-accent font-serif">
                          ₱{downpaymentDue.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-natural-text-light">
                          {is50Percent ? "50% Final Balance" : "Remaining Balance"}
                        </p>
                        <p className="text-sm font-bold text-natural-text-main font-serif">
                          ₱{balanceDue.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Section 1: Initial Deposit Details & Slip */}
                    <div className="space-y-2 bg-white/70 p-3.5 rounded-xl border border-natural-border/50">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-natural-text-main flex items-center gap-1.5 uppercase tracking-wider">
                          <CreditCard className="w-3.5 h-3.5 text-natural-accent" />
                          Stage 1: Date Lock Deposit ({is50Percent ? "50%" : "20%"})
                        </p>
                        <span
                          className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border",
                            isDepositVerified
                              ? "bg-green-50 text-green-700 border-green-200"
                              : payment.receipt_url
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                          )}
                        >
                          {isDepositVerified
                            ? "Deposit Verified"
                            : payment.receipt_url
                              ? "Pending Review"
                              : "Unpaid"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-natural-text-light">Method:</span>
                            <span className="font-semibold text-natural-text-main">
                              {payment.payment_method || "Not selected"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-natural-text-light">Reference:</span>
                            <span className="font-mono font-bold text-natural-accent">
                              {payment.reference_number || "None provided"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-natural-text-light">Contract Terms:</span>
                            <span className="font-semibold text-green-700">
                              {payment.terms_accepted
                                ? "✓ Signed (Clauses 1 & 16 Agreed)"
                                : "Agreed upon Submission"}
                            </span>
                          </div>
                        </div>

                        <div>
                          {payment.receipt_url ? (
                            <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-natural-border shadow-2xs justify-between">
                              <div className="flex items-center gap-2">
                                <img
                                  src={payment.receipt_url}
                                  alt="Deposit Slip"
                                  className="w-10 h-10 object-cover rounded-md border border-natural-border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() =>
                                    setViewingReceipt({
                                      url: payment.receipt_url,
                                      bookingName:
                                        selectedBooking.profiles?.name ||
                                        selectedBooking.profiles?.full_name ||
                                        "Client",
                                      ref: payment.reference_number,
                                      method: payment.payment_method,
                                      amount: downpaymentDue,
                                      title: `${is50Percent ? "50%" : "20%"} Reservation Deposit Slip`,
                                    })
                                  }
                                />
                                <div>
                                  <p className="text-[10px] font-bold text-natural-text-main">
                                    Deposit Receipt Slip
                                  </p>
                                  <p className="text-[9px] text-natural-text-light">
                                    ₱{downpaymentDue.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingReceipt({
                                    url: payment.receipt_url,
                                    bookingName:
                                      selectedBooking.profiles?.name ||
                                      selectedBooking.profiles?.full_name ||
                                      "Client",
                                    ref: payment.reference_number,
                                    method: payment.payment_method,
                                    amount: downpaymentDue,
                                    title: `${is50Percent ? "50%" : "20%"} Reservation Deposit Slip`,
                                  })
                                }
                                className="px-2.5 py-1 bg-natural-accent text-white text-[10px] font-bold uppercase tracking-wider rounded-md hover:bg-natural-accent/90 transition-all flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                              >
                                <Eye className="w-3 h-3" /> Inspect
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-200/50 text-center">
                              <p className="text-[10px] text-amber-700 italic">
                                No deposit slip uploaded yet.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Installment Milestones (If 20% Installment Scheme) */}
                    {!is50Percent && (
                      <div className="space-y-2 bg-white/70 p-3.5 rounded-xl border border-purple-100">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5 uppercase tracking-wider">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            Stage 2: Installment Breakdown Schedule
                          </p>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                            Monthly Plan
                          </span>
                        </div>

                        {payment.installment_schedule &&
                        payment.installment_schedule.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            {payment.installment_schedule.map((milestone: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs p-2 bg-white rounded-lg border border-purple-100/70"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-natural-text-main text-[11px]">
                                      {milestone.milestone}
                                    </p>
                                    <p className="text-[9px] text-natural-text-light">
                                      Due: {milestone.dueDate}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-natural-text-main font-serif text-xs">
                                    ₱{Number(milestone.amount).toLocaleString()}
                                  </p>
                                  <span
                                    className={cn(
                                      "text-[8px] font-bold px-1.5 py-0.2 rounded uppercase",
                                      milestone.status === "Due Now"
                                        ? "bg-amber-100 text-amber-800"
                                        : milestone.status === "Paid"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-gray-100 text-gray-600"
                                    )}
                                  >
                                    {milestone.status || "Scheduled"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2.5 bg-purple-50/40 rounded-lg text-xs text-purple-800 space-y-1">
                            <p className="text-[11px] font-medium">
                              Client opted for monthly installment distribution leading up to the 15-day final balance.
                            </p>
                            <p className="text-[10px] text-purple-600">
                              Remaining balance of ₱{balanceDue.toLocaleString()} is settled in monthly milestones, concluding strictly 15 days before the event.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 3: 15-Day Final Balance Settlement Tracker & Verification */}
                    <div className="space-y-3 bg-white/70 p-3.5 rounded-xl border border-natural-border/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <p className="text-[11px] font-bold text-natural-text-main flex items-center gap-1.5 uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5 text-natural-accent" />
                            {is50Percent ? "Stage 2" : "Stage 3"}: 15-Day Final Balance Settlement
                          </p>
                          <p className="text-[10px] text-natural-text-light">
                            Strictly due 15 days prior to event date ({deadlineStr})
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isFinalVerified ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-green-600" /> Settled & Verified
                            </span>
                          ) : daysRemaining !== null && daysRemaining < 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-red-600" /> Overdue by {Math.abs(daysRemaining)}d
                            </span>
                          ) : daysRemaining !== null && daysRemaining <= 15 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" /> Due in {daysRemaining}d
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                              {daysRemaining !== null ? `Due in ${daysRemaining}d` : "Upcoming"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-natural-text-light">Final Balance Amount:</span>
                            <span className="font-bold text-natural-accent font-serif text-sm">
                              ₱{finalBalanceAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-natural-text-light">Payment Method:</span>
                            <span className="font-semibold text-natural-text-main">
                              {payment.final_balance_method || "Pending submission"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-natural-text-light">Reference Number:</span>
                            <span className="font-mono font-semibold text-natural-text-main">
                              {payment.final_balance_reference || "N/A"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {hasFinalReceipt ? (
                            <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-natural-border shadow-2xs justify-between">
                              <div className="flex items-center gap-2">
                                <img
                                  src={payment.final_balance_receipt}
                                  alt="Final Balance Slip"
                                  className="w-10 h-10 object-cover rounded-md border border-natural-border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() =>
                                    setViewingReceipt({
                                      url: payment.final_balance_receipt,
                                      bookingName:
                                        selectedBooking.profiles?.name ||
                                        selectedBooking.profiles?.full_name ||
                                        "Client",
                                      ref: payment.final_balance_reference,
                                      method: payment.final_balance_method,
                                      amount: finalBalanceAmount,
                                      title: "15-Day Final Balance Slip",
                                    })
                                  }
                                />
                                <div>
                                  <p className="text-[10px] font-bold text-natural-text-main">
                                    Final Balance Slip
                                  </p>
                                  <p className="text-[9px] text-natural-text-light">
                                    ₱{finalBalanceAmount.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingReceipt({
                                    url: payment.final_balance_receipt,
                                    bookingName:
                                      selectedBooking.profiles?.name ||
                                      selectedBooking.profiles?.full_name ||
                                      "Client",
                                    ref: payment.final_balance_reference,
                                    method: payment.final_balance_method,
                                    amount: finalBalanceAmount,
                                    title: "15-Day Final Balance Slip",
                                  })
                                }
                                className="px-2.5 py-1 bg-natural-accent text-white text-[10px] font-bold uppercase tracking-wider rounded-md hover:bg-natural-accent/90 transition-all flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                              >
                                <Eye className="w-3 h-3" /> Inspect
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-center">
                              <p className="text-[10px] text-gray-500 italic">
                                No final balance slip uploaded yet.
                              </p>
                            </div>
                          )}

                          {/* Admin Verification Action */}
                          {hasFinalReceipt && !isFinalVerified && (
                            <button
                              type="button"
                              onClick={() => handleVerifyFinalBalance(selectedBooking.id)}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              Verify Final Balance Payment
                            </button>
                          )}
                          {isFinalVerified && (
                            <div className="w-full py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              Final Balance Fully Settled & Confirmed
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const cleanAllergies =
                  typeof selectedBooking.food_allergies === "string" &&
                  selectedBooking.food_allergies.includes(
                    "__PAYMENT_METADATA__:",
                  )
                    ? selectedBooking.food_allergies
                        .split("__PAYMENT_METADATA__:")[0]
                        .trim()
                    : (selectedBooking.food_allergies || "").trim();

                if (!cleanAllergies) return null;

                return (
                  <div className="p-4 bg-orange-50/80 border border-orange-200/60 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-orange-800 uppercase tracking-widest mb-1">
                        Food Allergies & Dietary Restrictions
                      </p>
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        {cleanAllergies}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-4">
                <h5 className="text-[0.65rem] font-bold text-natural-accent uppercase tracking-widest">
                  Menu Selection
                </h5>
                <div className="space-y-3">
                  {selectedBooking.selected_menu_items &&
                  selectedBooking.selected_menu_items.length > 0 ? (
                    (() => {
                      const groupedMenu: Record<string, string[]> = {};
                      const uncategorized: string[] = [];

                      selectedBooking.selected_menu_items.forEach(
                        (m: string) => {
                          const itemDef = menuItems.find((mi) => mi.name === m);
                          if (itemDef && itemDef.category) {
                            const cat = itemDef.category;
                            if (!groupedMenu[cat]) groupedMenu[cat] = [];
                            groupedMenu[cat].push(m);
                          } else {
                            uncategorized.push(m);
                          }
                        },
                      );

                      const renderGroups: React.ReactNode[] = [];
                      Object.entries(groupedMenu).forEach(([cat, items]) => {
                        renderGroups.push(
                          <div key={cat} className="space-y-1.5">
                            <p className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest border-b border-natural-border/50 pb-1">
                              {cat}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {items.map((m) => (
                                <span
                                  key={m}
                                  className="px-2 py-1 bg-natural-bg border border-natural-border rounded text-[9px] font-bold text-natural-text-main uppercase tracking-tighter"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>,
                        );
                      });

                      if (uncategorized.length > 0) {
                        renderGroups.push(
                          <div key="Other" className="space-y-1.5">
                            <p className="text-[0.6rem] font-bold text-natural-text-light uppercase tracking-widest border-b border-natural-border/50 pb-1">
                              Other
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {uncategorized.map((m) => (
                                <span
                                  key={m}
                                  className="px-2 py-1 bg-natural-bg border border-natural-border rounded text-[9px] font-bold text-natural-text-main uppercase tracking-tighter"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>,
                        );
                      }

                      return renderGroups;
                    })()
                  ) : (
                    <span className="text-xs text-natural-text-light italic">
                      No menu items selected
                    </span>
                  )}
                </div>
              </div>

              {selectedBooking.selected_add_ons &&
                selectedBooking.selected_add_ons.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[0.65rem] font-bold text-natural-accent uppercase tracking-widest">
                      Additional Services
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedBooking.selected_add_ons.map((s: string) => (
                        <span
                          key={s}
                          className="px-2 py-1 bg-natural-bg border border-natural-border rounded text-[9px] font-bold text-natural-text-main uppercase tracking-tighter"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Allocated Inventory & Equipment Section */}
              <div className="space-y-3 pt-4 border-t border-natural-border/50">
                <div className="flex items-center justify-between">
                  <h5 className="text-[0.65rem] font-bold text-natural-accent uppercase tracking-widest flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5" />
                    Allocated Event Equipment & Supplies
                  </h5>
                  <span
                    className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border",
                      isBookingDeducted(selectedBooking.id) || (selectedBooking.status || "Pending") === "Confirmed"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-orange-50 text-orange-700 border-orange-200",
                    )}
                  >
                    {isBookingDeducted(selectedBooking.id) || (selectedBooking.status || "Pending") === "Confirmed"
                      ? "✓ Stock Deducted & Allocated"
                      : "Pending Confirmation"}
                  </span>
                </div>
                {(() => {
                  const pkgName =
                    selectedBooking.packages?.name ||
                    packages.find((p) => p.id === selectedBooking.package_id)?.name ||
                    selectedBooking.package ||
                    packages[0]?.name ||
                    "Event Package";
                  const totalPax =
                    (Number(selectedBooking.guest_count) || 50) +
                    (Number(selectedBooking.additional_pax) || 0);
                  const equipList = calculatePackageEquipment(
                    pkgName,
                    totalPax,
                    selectedBooking.packages?.inclusions || selectedBooking.inclusions,
                  );

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {equipList.map((eq, i) => (
                        <div
                          key={i}
                          className="p-2 bg-natural-bg/40 border border-natural-border rounded-lg flex justify-between items-center text-[10px]"
                        >
                          <span className="font-medium text-natural-text-main truncate mr-1">
                            {eq.itemName}
                          </span>
                          <span className="font-bold text-natural-accent shrink-0">
                            {eq.quantity} {eq.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3 shrink-0">
              {(selectedBooking.status || "Pending") === "Pending" && (
                <>
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: "confirm",
                        bookingId: selectedBooking.id,
                        bookingName:
                          selectedBooking.profiles?.name ||
                          selectedBooking.profiles?.full_name ||
                          "Unknown User",
                      })
                    }
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-sm"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: "cancel",
                        bookingId: selectedBooking.id,
                        bookingName:
                          selectedBooking.profiles?.name ||
                          selectedBooking.profiles?.full_name ||
                          "Unknown User",
                      })
                    }
                    className="flex-1 border border-orange-200 text-orange-600 bg-orange-50/50 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-50 transition-all"
                  >
                    Cancel
                  </button>
                </>
              )}
              {(selectedBooking.status || "Pending") === "Confirmed" && (
                <>
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: "complete",
                        bookingId: selectedBooking.id,
                        bookingName:
                          selectedBooking.profiles?.name ||
                          selectedBooking.profiles?.full_name ||
                          "Unknown User",
                      })
                    }
                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Mark Event Done & Return Equipment
                  </button>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="px-6 border border-natural-border text-natural-text-light hover:text-natural-text-main bg-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Close
                  </button>
                </>
              )}
              {(selectedBooking.status || "Pending") !== "Pending" &&
                (selectedBooking.status || "Pending") !== "Confirmed" && (
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="flex-1 bg-natural-accent text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm"
                  >
                    Close View
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                  confirmAction.type === "confirm"
                    ? "bg-green-100"
                    : confirmAction.type === "complete"
                      ? "bg-emerald-100"
                      : confirmAction.type === "cancel"
                        ? "bg-orange-100"
                        : confirmAction.type === "archive"
                          ? "bg-gray-100"
                          : "bg-blue-100",
                )}
              >
                {confirmAction.type === "confirm" && (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                )}
                {confirmAction.type === "complete" && (
                  <RotateCcw className="w-8 h-8 text-emerald-600" />
                )}
                {confirmAction.type === "cancel" && (
                  <XCircle className="w-8 h-8 text-orange-600" />
                )}
                {confirmAction.type === "archive" && (
                  <Archive className="w-8 h-8 text-gray-600" />
                )}
                {confirmAction.type === "create" && (
                  <Plus className="w-8 h-8 text-blue-600" />
                )}
              </div>
              <h3 className="text-lg font-serif font-bold text-natural-text-main mb-2 capitalize">
                {confirmAction.type === "complete" ? "Complete Event?" : `${confirmAction.type} Booking?`}
              </h3>
              <p className="text-sm text-natural-text-light mb-4">
                {confirmAction.type === "create"
                  ? `Are you sure you want to create a new booking for ${confirmAction.bookingName}?`
                  : confirmAction.type === "complete"
                    ? `Are you sure the event for ${confirmAction.bookingName} is finished? This will return all allocated supplies to warehouse inventory.`
                    : `Are you sure you want to ${confirmAction.type} the booking for ${confirmAction.bookingName}?`}
              </p>

              {confirmAction.type === "complete" && (
                <div className="mb-5 p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-xl text-left space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Automatic Equipment Return</span>
                  </div>
                  <p className="text-[11px] text-emerald-950/80 leading-relaxed">
                    Marking this event as Completed will automatically return all reserved tableware, equipment, and supplies back to the warehouse physical inventory.
                  </p>
                </div>
              )}

              {confirmAction.type === "confirm" && (() => {
                const targetBooking = bookings.find((b) => b.id === confirmAction.bookingId);
                const payment = targetBooking ? getBookingPayment(targetBooking) : null;
                const totalBudget = targetBooking ? calculateBudget(targetBooking) : 0;
                const downpaymentDue = payment?.downpayment_amount || Math.round(totalBudget * 0.2);

                const pkgName =
                  targetBooking?.packages?.name ||
                  packages.find((p) => p.id === targetBooking?.package_id)?.name ||
                  targetBooking?.package ||
                  packages[0]?.name ||
                  "Event Package";
                const totalPax =
                  (Number(targetBooking?.guest_count) || 50) +
                  (Number(targetBooking?.additional_pax) || 0);
                const check = checkInventoryAvailability(pkgName, totalPax, targetBooking?.packages?.inclusions || targetBooking?.inclusions);

                return (
                  <div className="space-y-3 mb-5">
                    <div className="p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-xl text-left space-y-1.5">
                      <div className="flex items-center justify-between text-blue-900 font-bold text-xs">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          <span>20% Downpayment Verification</span>
                        </div>
                        <span className="font-mono text-blue-700 font-bold">
                          ₱{downpaymentDue.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-950/80 leading-relaxed">
                        {payment?.receipt_url ? (
                          <>
                            Client submitted proof slip via{" "}
                            <span className="font-semibold">
                              {payment.payment_method || "Online"}
                            </span>{" "}
                            (Ref:{" "}
                            <span className="font-mono font-semibold">
                              {payment.reference_number || "N/A"}
                            </span>
                            ). Confirming marks payment as{" "}
                            <span className="font-semibold text-green-700">
                              Verified
                            </span>
                            .
                          </>
                        ) : (
                          <>
                            Confirming will verify the 20% downpayment requirement
                            and lock in the event date for the client.
                          </>
                        )}
                      </p>
                    </div>

                    <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-left space-y-2">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                        <Boxes className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Automatic Stock Deduction</span>
                      </div>
                      <p className="text-[11px] text-amber-950/80 leading-relaxed">
                        Confirming will deduct equipment for{" "}
                        <span className="font-bold">{totalPax} Guests</span> (
                        {pkgName}) from warehouse inventory.
                      </p>
                      {!check.isAvailable && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-700 font-semibold leading-tight">
                          ⚠️ Low stock warning:{" "}
                          {check.requirements
                            .filter((r) => !r.isAvailable)
                            .map(
                              (r) =>
                                `${r.itemName} (Deficit: ${r.deficit} ${r.unit})`,
                            )
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {["confirm", "cancel", "archive"].includes(
                confirmAction.type,
              ) && (
                <div className="mb-6 space-y-4 text-left animate-in slide-in-from-bottom-2 duration-300">
                  {confirmAction.type === "cancel" && (
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">
                        Reason for Cancellation{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => {
                          setCancelReason(e.target.value);
                          setCancelReasonError(false);
                        }}
                        placeholder="Enter the reason for cancelling..."
                        className={cn(
                          "w-full px-4 py-2.5 bg-natural-bg/50 border rounded-xl text-sm transition-all focus:outline-none focus:bg-white focus:ring-2 resize-none min-h-[80px]",
                          cancelReasonError
                            ? "border-red-300 focus:ring-red-100"
                            : "border-natural-border focus:ring-natural-accent/10",
                        )}
                      />
                      {cancelReasonError && (
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-tighter pl-1">
                          {typeof cancelReasonError === "string"
                            ? cancelReasonError
                            : "Reason is required."}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">
                      Security Verification
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError(false);
                      }}
                      placeholder="Enter admin password to proceed"
                      className={cn(
                        "w-full px-4 py-2.5 bg-natural-bg/50 border rounded-xl text-sm transition-all focus:outline-none focus:bg-white focus:ring-2",
                        passwordError
                          ? "border-red-300 focus:ring-red-100"
                          : "border-natural-border focus:ring-natural-accent/10",
                      )}
                    />
                    {passwordError && (
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-tighter pl-1">
                        {typeof passwordError === "string"
                            ? passwordError
                            : "Password is required to proceed."}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConfirmAction}
                  className={cn(
                    "w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white transition-all shadow-sm",
                    confirmAction.type === "confirm"
                      ? "bg-green-600 hover:bg-green-700"
                      : confirmAction.type === "complete"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : confirmAction.type === "cancel"
                          ? "bg-orange-600 hover:bg-orange-700"
                          : confirmAction.type === "archive"
                            ? "bg-gray-600 hover:bg-gray-700"
                            : "bg-blue-600 hover:bg-blue-700",
                  )}
                >
                  Yes,{" "}
                  {confirmAction.type === "create"
                    ? "Create"
                    : confirmAction.type === "complete"
                      ? "Complete & Return Supplies"
                      : confirmAction.type}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proof of Payment Full Inspection Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-70 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-natural-border flex items-center justify-between bg-natural-bg/30">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-natural-accent" />
                <div>
                  <h4 className="text-sm font-bold text-natural-text-main">
                    {viewingReceipt.title || "Proof of Payment Receipt"}
                  </h4>
                  <p className="text-[10px] text-natural-text-light">
                    Submitted by {viewingReceipt.bookingName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingReceipt(null)}
                className="p-1 hover:bg-natural-bg rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>

            <div className="p-4 bg-natural-bg/10 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[300px]">
              <img
                src={viewingReceipt.url}
                alt="Proof of Payment"
                className="max-h-[55vh] w-auto max-w-full rounded-lg shadow-md object-contain border border-natural-border bg-white"
              />
            </div>

            <div className="p-4 bg-white border-t border-natural-border flex items-center justify-between gap-3">
              <div className="text-left">
                {typeof viewingReceipt.amount === "number" && (
                  <p className="text-xs font-bold text-natural-accent">
                    ₱{viewingReceipt.amount.toLocaleString()} {viewingReceipt.title ? `(${viewingReceipt.title})` : ""}
                  </p>
                )}
                <p className="text-[10px] text-natural-text-light">
                  Method:{" "}
                  <span className="font-semibold text-natural-text-main">
                    {viewingReceipt.method || "N/A"}
                  </span>
                  {viewingReceipt.ref && (
                    <>
                      {" "}
                      • Ref:{" "}
                      <span className="font-mono font-semibold text-natural-text-main">
                        {viewingReceipt.ref}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="px-5 py-2 bg-natural-accent text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-natural-accent/90 cursor-pointer shrink-0"
              >
                Close Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
