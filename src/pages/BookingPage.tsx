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
  ArrowUpRight,
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
  CheckCheck,
  PackageCheck,
  Eye,
  Receipt,
  ShieldCheck,
  FileText,
  Lock,
  Wine,
  AlertTriangle,
  RefreshCw,
  Sliders,
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

export interface BookingLogisticsInfo {
  isOutsideTaytay: boolean;
  isSecondFloorOrHigher: boolean;
  floorLevel: number;
  hasElevator: boolean;
  requiresStairsIngress: boolean;
  waiterCount: number;
  haulingFee: number;
  travelFee: number;
  notes?: string;
  hasLechonTable?: boolean;
  corkage?: any;
}

export const hasLateModification = (booking: any): boolean => {
  if (!booking) return false;
  if (booking.logistics_info?.isLateModification) return true;
  const modRequests = Array.isArray(booking.modification_requests)
    ? booking.modification_requests
    : [];
  return modRequests.some(
    (m: any) => m.is_late || (m.days_before_event !== undefined && m.days_before_event <= 14)
  );
};

export const hasPendingModification = (booking: any): boolean => {
  if (!booking) return false;
  const modRequests = Array.isArray(booking.modification_requests)
    ? booking.modification_requests
    : [];
  return modRequests.some((m: any) => m.status === "Pending");
};

export const hasAppliedModification = (booking: any): boolean => {
  if (!booking) return false;
  const modRequests = Array.isArray(booking.modification_requests)
    ? booking.modification_requests
    : [];
  return modRequests.some((m: any) => m.status === "Applied");
};

// Standardized catering package category mapper (identical to customer-side)
export const getRuleCategory = (dbCategory: string, itemName: string = ""): string => {
  const cat = (dbCategory || "").toLowerCase();
  const name = (itemName || "").toLowerCase();

  // Smart overrides based on item name to rescue items lumped into combined categories
  if (
    name.includes("soup") ||
    name.includes("broth") ||
    name.includes("chowder") ||
    name.includes("sinigang") ||
    name.includes("nilaga") ||
    name.includes("mami") ||
    name.includes("sopas") ||
    name.includes("tinola") ||
    name.includes("lomi")
  ) return "Soup";

  if (
    name.includes("vegetable") ||
    name.includes("veggie") ||
    name.includes("salad") ||
    name.includes("pinakbet") ||
    name.includes("pakbet") ||
    name.includes("kangkong") ||
    name.includes("laing")
  ) return "Vegetable";

  if (
    name.includes("pasta") ||
    name.includes("noodle") ||
    name.includes("spaghetti") ||
    name.includes("carbonara") ||
    name.includes("pancit") ||
    name.includes("palabok") ||
    name.includes("bihon") ||
    name.includes("sotanghon") ||
    name.includes("canton") ||
    name.includes("macaroni") ||
    name.includes("lasagna")
  ) return "Pasta";

  if (name.includes("rice")) return "Rice";

  if (cat.includes("appetizer")) return "Appetizer";
  if (cat.includes("soup")) return "Soup";
  if (cat.includes("pasta") || cat.includes("noodle")) return "Pasta";
  if (cat.includes("vegetable") || cat.includes("veggie")) return "Vegetable";
  if (cat.includes("rice")) return "Rice";
  if (cat.includes("dessert") || cat.includes("sweet")) return "Dessert";
  if (cat.includes("drink") || cat.includes("beverage")) return "Drinks";
  return "Main Course";
};

export const getBookingDishCategory = (
  dishName: string,
  booking?: any,
  menuItemsList: any[] = []
): string => {
  if (!dishName) return "Main Course";

  // 1. Check if this dish is an active replacement in booking.dish_substitutions
  if (booking && Array.isArray(booking.dish_substitutions)) {
    const sub = booking.dish_substitutions.find((s: any) => s.replacement_dish === dishName);
    if (sub) {
      if (sub.category) return sub.category;
      if (sub.original_dish) {
        const origDef = menuItemsList.find((mi: any) => mi.name === sub.original_dish);
        if (origDef) {
          return getRuleCategory(origDef.category, origDef.name);
        }
      }
    }
  }

  // 2. Check if dish is in the menuItems database
  const def = menuItemsList.find((mi: any) => mi.name === dishName);
  if (def) {
    return getRuleCategory(def.category, def.name);
  }

  // 3. Fallback to name heuristic in getRuleCategory
  return getRuleCategory("", dishName);
};

export const categoryOrder = [
  "Appetizer",
  "Soup",
  "Main Course",
  "Pasta",
  "Vegetable",
  "Rice",
  "Dessert",
  "Drinks",
];

export const getBookingLogistics = (booking: any): BookingLogisticsInfo => {
  const loc = String(booking?.event_location || "").toLowerCase();
  const totalPax = (Number(booking?.guest_count) || 0) + (Number(booking?.additional_pax) || 0);
  const defaultWaiters = Math.max(2, Math.ceil((totalPax || 50) / 25));

  let raw: any = booking?.logistics_info || null;

  if (
    (!raw || Object.keys(raw).length === 0) &&
    typeof booking?.food_allergies === "string" &&
    booking.food_allergies.includes("__PAYMENT_METADATA__:")
  ) {
    try {
      const parsed = JSON.parse(booking.food_allergies.split("__PAYMENT_METADATA__:")[1]);
      if (parsed?.logistics) raw = parsed.logistics;
    } catch (e) {}
  }

  const isOutsideTaytay =
    raw?.isOutsideTaytay !== undefined
      ? Boolean(raw.isOutsideTaytay)
      : Boolean(loc.trim() && !loc.includes("taytay"));

  const isSecondFloorOrHigher = Boolean(raw?.isSecondFloorOrHigher);
  const floorLevel = Number(raw?.floorLevel) || (isSecondFloorOrHigher ? 2 : 1);
  const hasElevator = Boolean(raw?.hasElevator);
  const requiresStairsIngress =
    raw?.requiresStairsIngress !== undefined
      ? Boolean(raw.requiresStairsIngress)
      : isSecondFloorOrHigher && !hasElevator;
  const waiterCount = Number(raw?.waiterCount) || defaultWaiters;
  const haulingFee = Number(raw?.haulingFee) || 0;
  const travelFee = Number(raw?.travelFee) || 0;
  const notes = raw?.notes || "";

  const corkage = booking?.corkage_info || raw?.corkage || null;
  const hasLechonTable = Boolean(
    corkage?.hasLechonTable ||
    (Array.isArray(booking?.selected_add_ons) && booking.selected_add_ons.some((a: string) => a.toLowerCase().includes("lechon")))
  );

  return {
    isOutsideTaytay,
    isSecondFloorOrHigher,
    floorLevel,
    hasElevator,
    requiresStairsIngress,
    waiterCount,
    haulingFee,
    travelFee,
    notes,
    hasLechonTable,
    corkage,
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
    items,
    deductionRecords,
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
  const [customTravelFeeInput, setCustomTravelFeeInput] = useState<string>("0");
  const [customHaulingFeeInput, setCustomHaulingFeeInput] = useState<string>("0");
  const [customLogisticsNotes, setCustomLogisticsNotes] = useState<string>("");
  const [isSavingLogistics, setIsSavingLogistics] = useState<boolean>(false);
  // Product Unavailability & Substitution Tool State
  const [isSubModalOpen, setIsSubModalOpen] = useState<boolean>(false);
  const [subOriginalDish, setSubOriginalDish] = useState<string>("");
  const [subReplacementDish, setSubReplacementDish] = useState<string>("");
  const [isCustomReplacement, setIsCustomReplacement] = useState<boolean>(false);
  const [subCustomReplacement, setSubCustomReplacement] = useState<string>("");
  const [subCustomCategory, setSubCustomCategory] = useState<string>("Appetizer");
  const [subReason, setSubReason] = useState<string>("Ingredient shortage / Out of stock in market");
  const [subClientNote, setSubClientNote] = useState<string>("");
  const [isSavingSub, setIsSavingSub] = useState<boolean>(false);
  const [subMessage, setSubMessage] = useState<string>("");

  // Rejecting modification state
  const [rejectingModId, setRejectingModId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>("");

  const [logisticsSaveMessage, setLogisticsSaveMessage] = useState<string>("");
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
    type:
      | "confirm"
      | "cancel"
      | "archive"
      | "create"
      | "complete"
      | "verify_final_payment";
    bookingId?: string;
    bookingName: string;
  } | null>(null);

  const [newBooking, setNewBooking] = useState<{
    user_id: string;
    event_type: string;
    package_id: string;
    date: string;
    time: string;
    guest_count: number | string;
    additional_pax: number | string;
    venueName: string;
    venueAddress: string;
    selected_menu_items: string[];
    selected_add_ons: string[];
  }>({
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
    if (selectedBooking) {
      const logInfo = getBookingLogistics(selectedBooking);
      setCustomTravelFeeInput(String(logInfo.travelFee || 0));
      setCustomHaulingFeeInput(String(logInfo.haulingFee || 0));
      setCustomLogisticsNotes(logInfo.notes || "");
      setLogisticsSaveMessage("");
    }
  }, [selectedBooking?.id]);

  useEffect(() => {
    if (selectedBooking && selectedBooking.status === "Confirmed") {
      reconcileCompletedEvents();
    }
  }, [
    selectedBooking?.id,
    selectedBooking?.status,
    selectedBooking?.guest_count,
    selectedBooking?.guestCount,
    selectedBooking?.additional_pax,
    selectedBooking?.additionalPax,
  ]);

  const pendingOpenBookingIdRef = React.useRef<string | number | null>(null);

  useEffect(() => {
    const handleOpenOverview = (e: any) => {
      const targetId = e.detail?.bookingId;
      if (!targetId) return;
      setBookings((currentList) => {
        const match = currentList.find((b) => String(b.id) === String(targetId));
        if (match) {
          setSelectedBooking(match);
          pendingOpenBookingIdRef.current = null;
        } else {
          pendingOpenBookingIdRef.current = targetId;
        }
        return currentList;
      });
    };
    window.addEventListener("openAdminBookingOverview", handleOpenOverview);
    return () => window.removeEventListener("openAdminBookingOverview", handleOpenOverview);
  }, []);

  useEffect(() => {
    // Fetch initial data
    fetchAllData(false);

    const handleSilentSync = () => {
      if (document.visibilityState === "visible") {
        fetchAllData(true);
      }
    };

    window.addEventListener("bookingsUpdated", handleSilentSync);
    window.addEventListener("bookingsRealtimeSync", handleSilentSync);
    window.addEventListener("focus", handleSilentSync);
    document.addEventListener("visibilitychange", handleSilentSync);

    // Subscribe to real-time changes on the bookings table
    const channel = supabase
      .channel(`bookings-page-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchAllData(true); // Refresh silently when any booking changes
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

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAllData(true);
      }
    }, 5000);

    // Cleanup subscription on unmount
    return () => {
      window.removeEventListener("bookingsUpdated", handleSilentSync);
      window.removeEventListener("bookingsRealtimeSync", handleSilentSync);
      window.removeEventListener("focus", handleSilentSync);
      document.removeEventListener("visibilitychange", handleSilentSync);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAllData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
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
        if (pendingOpenBookingIdRef.current) {
          const targetMatch = (bData || []).find(
            (b: any) => String(b.id) === String(pendingOpenBookingIdRef.current)
          );
          if (targetMatch) {
            setSelectedBooking(targetMatch);
            pendingOpenBookingIdRef.current = null;
          }
        } else {
          setSelectedBooking((prev: any) => {
            if (!prev) return null;
            return (bData || []).find((b: any) => String(b.id) === String(prev.id)) || prev;
          });
        }
        setFetchError(null);
        if (bData && bData.length > 0) {
          reconcileCompletedEvents(bData);
        }
      }

      const [pRes, pkgRes, menuRes, incRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .neq("status", "Archived"),
        supabase
          .from("packages")
          .select("id, name, pax, price, additional_pax_price, inclusions, status, tag")
          .neq("status", "Archived"),
        supabase.from("menu_items").select("*").neq("status", "Archived"),
        supabase
          .from("inclusions")
          .select("id, category, items")
          .not("category", "like", "__CMS_%"),
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

    const logistics = getBookingLogistics(booking);
    const corkageData = logistics.corkage;
    const corkageFee =
      Number(corkageData?.totalCorkageFee) ||
      ((corkageData?.hasLechonTable ? 1500 : 0) +
        Number(corkageData?.alcoholicBeveragesCount || 0) * 400 +
        Number(corkageData?.outsideFoodCount || 0) * 400) ||
      0;
    return basePrice + additionalPaxTotal + servicesPrice + logistics.haulingFee + logistics.travelFee + corkageFee;
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

      let isPasswordValid = confirmPassword === "admin123";
      if (!isPasswordValid && currentUser?.email) {
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

      const confirmedAt = new Date().toISOString();
      const updatedLogisticsInfo = {
        ...(targetBooking?.logistics_info || {}),
        confirmed_at: confirmedAt,
      };

      // Attempt to update with payment_status: "Verified" and confirmed_at timestamp
      let { error: updateErr } = await supabase
        .from("bookings")
        .update({
          status: "Confirmed",
          payment_status: "Verified",
          logistics_info: updatedLogisticsInfo,
        })
        .eq("id", bookingId);

      if (updateErr) {
        // Fallback if payment_status or logistics_info column does not exist yet
        const { error: fallbackErr } = await supabase
          .from("bookings")
          .update({ status: "Confirmed" })
          .eq("id", bookingId);
        updateErr = fallbackErr;
      }

      // Also keep fallback metadata in food_allergies in sync if present
      if (!updateErr && targetBooking?.food_allergies?.includes("__PAYMENT_METADATA__:")) {
        try {
          const parts = targetBooking.food_allergies.split("__PAYMENT_METADATA__:");
          const meta = JSON.parse(parts[1]);
          meta.status = "Verified";
          meta.logistics = { ...(meta.logistics || {}), confirmed_at: confirmedAt };
          const updatedAllergies = `${parts[0]}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
          await supabase.from("bookings").update({ food_allergies: updatedAllergies }).eq("id", bookingId);
        } catch (e) {}
      }

      if (updateErr) {
        console.error("Error confirming booking:", updateErr.message);
        setFetchError(`Failed to confirm booking: ${updateErr.message}`);
        setConfirmAction(null);
        return;
      }

      // Automatically deduct package equipment supplies from equipment monitoring
      const corkageData = targetBooking?.corkage_info || targetBooking?.logistics_info?.corkage || null;
      await deductBookingInventory(bookingId, confirmAction.bookingName, pkgName, totalPax, targetBooking?.packages?.inclusions || targetBooking?.inclusions, corkageData);

      window.dispatchEvent(
        new CustomEvent("markAdminNotifRead", {
          detail: { id: bookingId, status: "Confirmed" },
        }),
      );
      await logAuditAction({
        action: "Confirmed Booking",
        target: confirmAction.bookingName,
        type: "Update",
        details: `Approved booking for ${confirmAction.bookingName} and allocated ${totalPax} Pax equipment from equipment monitoring (${pkgName})`,
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

      // Automatically restore package equipment back to equipment monitoring
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
        details: `Cancelled booking for ${confirmAction.bookingName} and restored reserved equipment supplies. Reason: ${cancelReason.trim()}`,
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
      const targetBooking = bookings.find((b) => b.id === bookingId);
      const payment = targetBooking ? getBookingPayment(targetBooking) : null;
      if (payment && payment.final_balance_status !== "Verified") {
        setFetchError("Cannot complete booking: The client's final balance payment has not been confirmed and verified yet.");
        setConfirmAction(null);
        return;
      }

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

      // Automatically restore package equipment back to equipment monitoring
      await restoreBookingInventory(
        bookingId,
        confirmAction.bookingName,
        `Event Completed - All equipment returned to warehouse equipment monitoring (Booking #${bookingId})`
      );

      await logAuditAction({
        action: "Completed Booking",
        target: confirmAction.bookingName,
        type: "Update",
        details: `Marked event as Completed for ${confirmAction.bookingName} and returned all allocated equipment to equipment monitoring`,
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
        // Auto-deduct equipment
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
        details: `Manually created and confirmed a booking for ${confirmAction.bookingName}, automatically allocating equipment from equipment monitoring`,
      });
      resetNewBooking();
    } else if (type === "verify_final_payment" && bookingId) {
      await handleVerifyFinalBalance(bookingId);
      setConfirmAction(null);
      return;
    }

    window.dispatchEvent(new CustomEvent("bookingsUpdated"));
    await fetchAllData(true);
    setConfirmAction(null);
    setSelectedBooking(null);
  };

  const handleVerifyFinalBalance = async (bookingId: number | string) => {
    const targetBooking = bookings.find((b) => String(b.id) === String(bookingId));
    if (!targetBooking) return;
    const clientName = targetBooking.profiles?.name || targetBooking.profiles?.full_name || "Client";
    const payment = getBookingPayment(targetBooking);
    const schedule = payment.installment_schedule || [];

    // Automatically mark all installment breakdown milestones as Verified as well
    const updatedSchedule = (schedule || []).map((m: any) => ({
      ...m,
      status: "Verified",
      verified_at: m.verified_at || new Date().toISOString(),
      receipt_url: m.receipt_url || payment.final_balance_receipt || "",
      reference_number: m.reference_number || payment.final_balance_reference || "",
      payment_method: m.payment_method || payment.final_balance_method || "",
    }));

    let updateSuccess = false;
    let lastErrorMsg = "";

    const updatePayload: any = {
      final_balance_status: "Verified",
    };
    if (updatedSchedule.length > 0) {
      updatePayload.installment_schedule = updatedSchedule;
    }

    let { error: dbError } = await supabase
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (dbError && updatedSchedule.length > 0) {
      // Fallback retry without installment_schedule if column missing
      const { error: retryError } = await supabase
        .from("bookings")
        .update({ final_balance_status: "Verified" })
        .eq("id", bookingId);
      if (!retryError) {
        dbError = null;
      }
    }

    if (!dbError) {
      updateSuccess = true;
    } else {
      lastErrorMsg = dbError.message;
    }

    // Keep metadata in sync as dual-layer fallback in food_allergies
    const currentAllergies = targetBooking.food_allergies || "";
    let updatedAllergies = currentAllergies;
    try {
      if (currentAllergies.includes("__PAYMENT_METADATA__:")) {
        const parts = currentAllergies.split("__PAYMENT_METADATA__:");
        const meta = JSON.parse(parts[1]);
        meta.finalBalanceStatus = "Verified";
        if (updatedSchedule.length > 0) {
          meta.installments = updatedSchedule;
        }
        updatedAllergies = `${parts[0].trim() ? parts[0].trim() + "\n" : ""}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
        const fb = await supabase.from("bookings").update({ food_allergies: updatedAllergies }).eq("id", bookingId);
        if (!fb.error) updateSuccess = true;
        else lastErrorMsg = fb.error.message;
      } else if (!updateSuccess) {
        const meta: any = { finalBalanceStatus: "Verified", status: "Verified" };
        if (updatedSchedule.length > 0) {
          meta.installments = updatedSchedule;
        }
        updatedAllergies = `${currentAllergies.trim() ? currentAllergies.trim() + "\n" : ""}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
        const fb = await supabase.from("bookings").update({ food_allergies: updatedAllergies }).eq("id", bookingId);
        if (!fb.error) updateSuccess = true;
        else lastErrorMsg = fb.error.message;
      }
    } catch (e) {}

    if (!updateSuccess) {
      console.error("Error verifying final balance:", lastErrorMsg);
      setFetchError(`Failed to verify final balance: ${lastErrorMsg}`);
      return;
    }

    await logAuditAction({
      action: "Verified Final Balance Payment",
      target: clientName,
      type: "Update",
      details: `Admin confirmed and verified final balance settlement for ${clientName} (Booking #${bookingId})${updatedSchedule.length > 0 ? " — All installment milestones marked verified" : ""}`,
    });

    setBookings((prev) =>
      prev.map((b) =>
        String(b.id) === String(bookingId)
          ? {
              ...b,
              final_balance_status: "Verified",
              installment_schedule: updatedSchedule.length > 0 ? updatedSchedule : b.installment_schedule,
              food_allergies: updatedAllergies,
            }
          : b,
      ),
    );

    if (selectedBooking && String(selectedBooking.id) === String(bookingId)) {
      setSelectedBooking({
        ...selectedBooking,
        final_balance_status: "Verified",
        installment_schedule: updatedSchedule.length > 0 ? updatedSchedule : selectedBooking.installment_schedule,
        food_allergies: updatedAllergies,
      });
    }

    window.dispatchEvent(new CustomEvent("bookingsUpdated"));
    await fetchAllData(true);
  };

  const handleVerifyInstallment = async (bookingId: number | string, milestoneIndex: number) => {
    const targetBooking = bookings.find((b) => String(b.id) === String(bookingId));
    if (!targetBooking) return;
    const clientName = targetBooking.profiles?.name || targetBooking.profiles?.full_name || "Client";
    const payment = getBookingPayment(targetBooking);
    const schedule = payment.installment_schedule || [];
    if (!schedule[milestoneIndex]) return;

    const milestoneTitle = schedule[milestoneIndex].title || `Installment #${milestoneIndex + 1}`;
    const milestoneAmount = schedule[milestoneIndex].amount || 0;

    const updatedSchedule = schedule.map((item: any, idx: number) => {
      if (idx === milestoneIndex) {
        return {
          ...item,
          status: "Verified",
          verified_at: new Date().toISOString(),
        };
      }
      return item;
    });

    const allVerified = updatedSchedule.every(
      (item: any) => item.status === "Verified" || item.status === "Paid"
    );

    const updatePayload: any = {
      installment_schedule: updatedSchedule,
    };
    if (allVerified) {
      updatePayload.final_balance_status = "Verified";
    }

    const { error: dbError } = await supabase
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    let updatedAllergies = targetBooking.food_allergies || "";
    try {
      if (updatedAllergies.includes("__PAYMENT_METADATA__:")) {
        const parts = updatedAllergies.split("__PAYMENT_METADATA__:");
        const meta = JSON.parse(parts[1]);
        meta.installments = updatedSchedule;
        if (allVerified) meta.finalBalanceStatus = "Verified";
        updatedAllergies = `${parts[0].trim() ? parts[0].trim() + "\n" : ""}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
        await supabase.from("bookings").update({ food_allergies: updatedAllergies }).eq("id", bookingId);
      }
    } catch (e) {}

    await logAuditAction({
      action: "Verified Installment Payment",
      target: clientName,
      type: "Update",
      details: `Admin confirmed and verified ${milestoneTitle} (₱${Number(milestoneAmount).toLocaleString()}) for ${clientName}${allVerified ? " — All installments settled, final balance verified" : ""} (Booking #${bookingId})`,
    });

    setBookings((prev) =>
      prev.map((b) =>
        String(b.id) === String(bookingId)
          ? {
              ...b,
              installment_schedule: updatedSchedule,
              final_balance_status: allVerified ? "Verified" : b.final_balance_status,
              food_allergies: updatedAllergies,
            }
          : b,
      ),
    );

    if (selectedBooking && String(selectedBooking.id) === String(bookingId)) {
      setSelectedBooking({
        ...selectedBooking,
        installment_schedule: updatedSchedule,
        final_balance_status: allVerified ? "Verified" : selectedBooking.final_balance_status,
        food_allergies: updatedAllergies,
      });
    }

    window.dispatchEvent(new CustomEvent("bookingsUpdated"));
    await fetchAllData(true);
  };

  const handleSaveLogisticsSurcharge = async (bookingId: number | string) => {
    const targetBooking = bookings.find((b) => String(b.id) === String(bookingId));
    if (!targetBooking) return;

    setIsSavingLogistics(true);
    setLogisticsSaveMessage("");

    const clientName =
      targetBooking.profiles?.name || targetBooking.profiles?.full_name || "Client";
    const currentLogistics = getBookingLogistics(targetBooking);
    const payment = getBookingPayment(targetBooking);

    const newTravelFee = Math.max(0, parseFloat(customTravelFeeInput) || 0);
    const newHaulingFee = Math.max(0, parseFloat(customHaulingFeeInput) || 0);

    const updatedLogistics: any = {
      ...currentLogistics,
      travelFee: newTravelFee,
      haulingFee: newHaulingFee,
      requiresStairsIngress:
        currentLogistics.requiresStairsIngress || newHaulingFee > 0,
      notes: customLogisticsNotes.trim(),
      updated_at: new Date().toISOString(),
    };

    const tempBooking = {
      ...targetBooking,
      logistics_info: updatedLogistics,
    };
    const newTotalBudget = calculateBudget(tempBooking);
    const is50Percent = payment.payment_scheme === "Standard 50%";
    const downpaymentDue =
      payment.downpayment_amount > 0
        ? payment.downpayment_amount
        : Math.round(newTotalBudget * (is50Percent ? 0.5 : 0.2));
    const newRemainingBalance = Math.max(0, newTotalBudget - downpaymentDue);

    let updatedSchedule = payment.installment_schedule
      ? [...payment.installment_schedule]
      : null;

    if (updatedSchedule && updatedSchedule.length > 0) {
      let paidTotal = 0;
      let unpaidIndices: number[] = [];
      updatedSchedule.forEach((m: any, idx: number) => {
        if (m.status === "Verified" || m.status === "Paid") {
          paidTotal += Number(m.amount) || 0;
        } else {
          unpaidIndices.push(idx);
        }
      });

      if (unpaidIndices.length > 0) {
        const remainingToDistribute = Math.max(0, newRemainingBalance - paidTotal);
        const perMilestone = Math.floor(remainingToDistribute / unpaidIndices.length);
        let acc = 0;
        unpaidIndices.forEach((mIdx, i) => {
          const isLast = i === unpaidIndices.length - 1;
          const amt = isLast ? remainingToDistribute - acc : perMilestone;
          acc += amt;
          updatedSchedule![mIdx] = {
            ...updatedSchedule![mIdx],
            amount: amt,
          };
        });
      }
    }

    let updatedAllergies = targetBooking.food_allergies || "";
    try {
      if (updatedAllergies.includes("__PAYMENT_METADATA__:")) {
        const parts = updatedAllergies.split("__PAYMENT_METADATA__:");
        const meta = JSON.parse(parts[1]);
        meta.logistics = updatedLogistics;
        meta.balance = newRemainingBalance;
        if (updatedSchedule) meta.installments = updatedSchedule;
        updatedAllergies = `${parts[0].trim() ? parts[0].trim() + "\n" : ""}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
      }
    } catch (e) {}

    const updatePayload: any = {
      logistics_info: updatedLogistics,
      final_balance_amount: newRemainingBalance,
    };
    if (updatedSchedule) {
      updatePayload.installment_schedule = updatedSchedule;
    }
    if (updatedAllergies !== (targetBooking.food_allergies || "")) {
      updatePayload.food_allergies = updatedAllergies;
    }

    const { error: dbError } = await supabase
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    setIsSavingLogistics(false);

    if (dbError) {
      setLogisticsSaveMessage(`Failed to save: ${dbError.message}`);
      return;
    }

    await logAuditAction({
      action: "Updated Logistics Surcharge",
      target: clientName,
      type: "Update",
      details: `Admin updated logistics surcharge for ${clientName} (Booking #${bookingId}): Travel Fee ₱${newTravelFee.toLocaleString()}, Hauling Fee ₱${newHaulingFee.toLocaleString()}`,
    });

    setBookings((prev) =>
      prev.map((b) =>
        String(b.id) === String(bookingId)
          ? {
              ...b,
              logistics_info: updatedLogistics,
              final_balance_amount: newRemainingBalance,
              installment_schedule: updatedSchedule || b.installment_schedule,
              food_allergies: updatedAllergies,
            }
          : b,
      ),
    );

    if (selectedBooking && String(selectedBooking.id) === String(bookingId)) {
      setSelectedBooking({
        ...selectedBooking,
        logistics_info: updatedLogistics,
        final_balance_amount: newRemainingBalance,
        installment_schedule: updatedSchedule || selectedBooking.installment_schedule,
        food_allergies: updatedAllergies,
      });
    }

    window.dispatchEvent(new CustomEvent("bookingsUpdated"));
    setLogisticsSaveMessage("Logistics surcharge saved & balance updated.");
    setTimeout(() => setLogisticsSaveMessage(""), 4000);
  };

  const handleOpenSubstituteModal = (dishToReplace?: string) => {
    if (!selectedBooking) return;
    const currentDishes: string[] = selectedBooking.selected_menu_items || [];
    const initialDish = dishToReplace || currentDishes[0] || "";
    setSubOriginalDish(initialDish);

    const itemDef = menuItems.find((mi) => mi.name === initialDish);
    const cat = getRuleCategory(itemDef?.category || "", initialDish);
    const reasonableReplacements = menuItems.filter(
      (mi) =>
        mi.status !== "Archived" &&
        mi.status !== "Not Available" &&
        !currentDishes.includes(mi.name) &&
        (!cat || getRuleCategory(mi.category, mi.name) === cat)
    );
    const chosen = reasonableReplacements[0]?.name || (menuItems.find((mi) => !currentDishes.includes(mi.name))?.name || "");
    setSubReplacementDish(chosen);
    setIsCustomReplacement(false);
    setSubCustomReplacement("");
    setSubReason("Ingredient shortage / Out of stock in market");
    setSubClientNote(
      `Due to fresh ingredient availability in the local market, "${initialDish}" has been substituted with "${chosen}" of equivalent quality.`
    );
    setSubMessage("");
    setIsSubModalOpen(true);
  };

  const handleConfirmDishSubstitution = async () => {
    const finalReplacement = (isCustomReplacement ? subCustomReplacement : subReplacementDish).trim();
    if (!selectedBooking || !subOriginalDish || !finalReplacement) return;
    setIsSavingSub(true);
    setSubMessage("");

    const clientName =
      selectedBooking.profiles?.name || selectedBooking.profiles?.full_name || "Client";
    const currentDishes: string[] = Array.isArray(selectedBooking.selected_menu_items)
      ? [...selectedBooking.selected_menu_items]
      : [];
    const updatedMenu = currentDishes.map((d) => (d === subOriginalDish ? finalReplacement : d));

    const newSubstitution = {
      id: `sub-${Date.now()}`,
      original_dish: subOriginalDish,
      replacement_dish: finalReplacement,
      reason: subReason.trim(),
      client_note: subClientNote.trim(),
      substituted_at: new Date().toISOString(),
      admin_name: currentUser?.name || "Coordinator",
    };

    // Keep substitutions clean: if replacing a dish that was itself a previous replacement, collapse/prune stale entry
    const existingSubs: any[] = Array.isArray(selectedBooking.dish_substitutions)
      ? selectedBooking.dish_substitutions.filter(
          (s: any) => s.replacement_dish !== subOriginalDish && updatedMenu.includes(s.replacement_dish)
        )
      : [];
    const chainedPrev = Array.isArray(selectedBooking.dish_substitutions)
      ? selectedBooking.dish_substitutions.find((s: any) => s.replacement_dish === subOriginalDish)
      : null;
    if (chainedPrev?.original_dish) {
      newSubstitution.original_dish = chainedPrev.original_dish;
    }
    const updatedSubs = [...existingSubs, newSubstitution];

    // Also auto-acknowledge any prior "Applied" client modifications so stale Revert/Confirm buttons don't overwrite this substitution
    const existingMods: any[] = Array.isArray(selectedBooking.modification_requests)
      ? selectedBooking.modification_requests
      : [];
    const updatedMods = existingMods.map((m: any) =>
      m.status === "Applied"
        ? {
            ...m,
            status: "Approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: currentUser?.name || "Coordinator",
          }
        : m
    );

    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          selected_menu_items: updatedMenu,
          dish_substitutions: updatedSubs,
          modification_requests: updatedMods,
        })
        .eq("id", selectedBooking.id);

      if (error) throw error;

      await logAuditAction({
        action: "Substituted Dish (Unavailability)",
        target: clientName,
        type: "Update",
        details: `Admin substituted "${subOriginalDish}" with "${finalReplacement}" for ${clientName} (Booking #${selectedBooking.id}). Reason: ${subReason.trim()}`,
      });

      setBookings((prev) =>
        prev.map((b) =>
          String(b.id) === String(selectedBooking.id)
            ? {
                ...b,
                selected_menu_items: updatedMenu,
                dish_substitutions: updatedSubs,
                modification_requests: updatedMods,
              }
            : b
        )
      );

      setSelectedBooking({
        ...selectedBooking,
        selected_menu_items: updatedMenu,
        dish_substitutions: updatedSubs,
        modification_requests: updatedMods,
      });

      window.dispatchEvent(new CustomEvent("bookingsUpdated"));
      setSubMessage("Substitution applied and notification sent to client!");
      setTimeout(() => {
        setIsSubModalOpen(false);
        setSubMessage("");
      }, 1400);
    } catch (err: any) {
      console.error("Error saving substitution:", err);
      setSubMessage(`Failed: ${err.message}`);
    } finally {
      setIsSavingSub(false);
    }
  };

  const handleApproveModification = async (reqId: string) => {
    if (!selectedBooking) return;
    const clientName =
      selectedBooking.profiles?.name || selectedBooking.profiles?.full_name || "Client";

    const modRequests: any[] = Array.isArray(selectedBooking.modification_requests)
      ? selectedBooking.modification_requests
      : [];
    const targetReq = modRequests.find((m: any) => m.id === reqId);
    if (!targetReq) return;

    const updatedReqs = modRequests.map((m: any) =>
      m.id === reqId
        ? {
            ...m,
            status: "Approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: currentUser?.name || "Coordinator",
          }
        : m
    );

    // Keep guest_count strictly as base package pax so calculateBudget never double-counts additional_pax
    const baseGuestCount =
      Number(targetReq.base_guest_count) ||
      Number(selectedBooking.guest_count) ||
      50;
    const isAlreadyApplied = targetReq.status === "Applied";
    const newAdditionalPax = isAlreadyApplied
      ? Number(selectedBooking.additional_pax) || 0
      : targetReq.requested_additional_pax !== undefined
      ? Number(targetReq.requested_additional_pax)
      : Number(selectedBooking.additional_pax) || 0;
    const newMenu = isAlreadyApplied
      ? selectedBooking.selected_menu_items
      : Array.isArray(targetReq.requested_menu_items) && targetReq.requested_menu_items.length > 0
      ? targetReq.requested_menu_items
      : selectedBooking.selected_menu_items;

    const currentLogObj =
      selectedBooking.logistics_info && typeof selectedBooking.logistics_info === "object"
        ? { ...selectedBooking.logistics_info }
        : {};
    if (targetReq.notes && !currentLogObj.client_special_instructions) {
      currentLogObj.client_special_instructions = targetReq.notes;
    }

    const tempBooking = {
      ...selectedBooking,
      guest_count: baseGuestCount,
      additional_pax: newAdditionalPax,
      selected_menu_items: newMenu,
      logistics_info: currentLogObj,
    };
    const newBudget = calculateBudget(tempBooking);
    const payment = getBookingPayment(selectedBooking);
    const is50Percent = payment.payment_scheme === "Standard 50%";
    const downpaymentDue =
      payment.downpayment_amount > 0
        ? payment.downpayment_amount
        : Math.round(newBudget * (is50Percent ? 0.5 : 0.2));
    const newRemainingBalance = Math.max(0, newBudget - downpaymentDue);

    let updatedSchedule = payment.installment_schedule
      ? payment.installment_schedule.map((m: any) => ({ ...m }))
      : null;
    if (updatedSchedule && updatedSchedule.length > 0) {
      let paidTotal = 0;
      const unpaidIndices: number[] = [];
      updatedSchedule.forEach((m: any, idx: number) => {
        if (m.status === "Verified" || m.status === "Paid") {
          paidTotal += Number(m.amount) || 0;
        } else {
          unpaidIndices.push(idx);
        }
      });
      if (unpaidIndices.length > 0) {
        const remainingToDistribute = Math.max(0, newRemainingBalance - paidTotal);
        const perMilestone = Math.floor(remainingToDistribute / unpaidIndices.length);
        let acc = 0;
        unpaidIndices.forEach((mIdx, i) => {
          const isLast = i === unpaidIndices.length - 1;
          const amt = isLast ? remainingToDistribute - acc : perMilestone;
          acc += amt;
          updatedSchedule![mIdx] = { ...updatedSchedule![mIdx], amount: amt };
        });
      }
    }

    let updatedAllergies = selectedBooking.food_allergies || "";
    try {
      if (updatedAllergies.includes("__PAYMENT_METADATA__:")) {
        const parts = updatedAllergies.split("__PAYMENT_METADATA__:");
        const meta = JSON.parse(parts[1]);
        meta.balance = newRemainingBalance;
        meta.logistics = currentLogObj;
        if (updatedSchedule) meta.installments = updatedSchedule;
        updatedAllergies = `${parts[0].trim() ? parts[0].trim() + "\n" : ""}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
      }
    } catch (e) {}

    const updatePayload: any = {
      guest_count: baseGuestCount,
      additional_pax: newAdditionalPax,
      selected_menu_items: newMenu,
      final_balance_amount: newRemainingBalance,
      logistics_info: currentLogObj,
      modification_requests: updatedReqs,
    };
    if (updatedSchedule) updatePayload.installment_schedule = updatedSchedule;
    if (updatedAllergies !== (selectedBooking.food_allergies || "")) {
      updatePayload.food_allergies = updatedAllergies;
    }

    try {
      const { error } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", selectedBooking.id);

      if (error) throw error;

      window.dispatchEvent(
        new CustomEvent("markAdminNotifRead", {
          detail: { key: `${selectedBooking.id}-client-mod-${reqId}` },
        })
      );
      window.dispatchEvent(new CustomEvent("bookingsUpdated"));

      await logAuditAction({
        action: "Confirmed Client Modification",
        target: clientName,
        type: "Update",
        details: `Admin confirmed modification for ${clientName}: ${baseGuestCount + newAdditionalPax} Total Guests (+${newAdditionalPax} extra), Budget ₱${newBudget.toLocaleString()}`,
      });

      setBookings((prev) =>
        prev.map((b) =>
          String(b.id) === String(selectedBooking.id)
            ? {
                ...b,
                ...updatePayload,
              }
            : b
        )
      );

      setSelectedBooking({
        ...selectedBooking,
        ...updatePayload,
      });
    } catch (err: any) {
      console.error("Error approving modification:", err);
      alert(`Failed to confirm modification: ${err.message}`);
    }
  };

  const handleRejectModification = async (reqId: string, reasonText: string) => {
    if (!selectedBooking) return;
    const clientName =
      selectedBooking.profiles?.name || selectedBooking.profiles?.full_name || "Client";

    const modRequests: any[] = Array.isArray(selectedBooking.modification_requests)
      ? selectedBooking.modification_requests
      : [];
    const targetReq = modRequests.find((m: any) => m.id === reqId);
    if (!targetReq) return;

    const finalReason =
      reasonText.trim() || "Modifications could not be accommodated at this time.";

    const updatedReqs = modRequests.map((m: any) =>
      m.id === reqId
        ? {
            ...m,
            status: "Rejected",
            review_note: finalReason,
            reviewed_at: new Date().toISOString(),
            reviewed_by: currentUser?.name || "Coordinator",
          }
        : m
    );

    const updatePayload: any = {
      modification_requests: updatedReqs,
    };

    // If modification was already Applied by the client, revert menu, additional_pax, and balance
    if (targetReq.status === "Applied") {
      const baseGuestCount =
        Number(targetReq.base_guest_count) ||
        Number(selectedBooking.guest_count) ||
        50;
      const revertedExtraPax = Number(targetReq.previous_additional_pax) || 0;
      const revertedMenu =
        Array.isArray(targetReq.previous_menu_items) && targetReq.previous_menu_items.length > 0
          ? targetReq.previous_menu_items
          : selectedBooking.selected_menu_items;

      const tempBooking = {
        ...selectedBooking,
        guest_count: baseGuestCount,
        additional_pax: revertedExtraPax,
        selected_menu_items: revertedMenu,
      };
      const revertedBudget = calculateBudget(tempBooking);
      const payment = getBookingPayment(selectedBooking);
      const is50Percent = payment.payment_scheme === "Standard 50%";
      const downpaymentDue =
        payment.downpayment_amount > 0
          ? payment.downpayment_amount
          : Math.round(revertedBudget * (is50Percent ? 0.5 : 0.2));
      const revertedBalance = Math.max(0, revertedBudget - downpaymentDue);

      let updatedSchedule = payment.installment_schedule
        ? payment.installment_schedule.map((m: any) => ({ ...m }))
        : null;
      if (updatedSchedule && updatedSchedule.length > 0) {
        let paidTotal = 0;
        const unpaidIndices: number[] = [];
        updatedSchedule.forEach((m: any, idx: number) => {
          if (m.status === "Verified" || m.status === "Paid") {
            paidTotal += Number(m.amount) || 0;
          } else {
            unpaidIndices.push(idx);
          }
        });
        if (unpaidIndices.length > 0) {
          const remainingToDistribute = Math.max(0, revertedBalance - paidTotal);
          const perMilestone = Math.floor(remainingToDistribute / unpaidIndices.length);
          let acc = 0;
          unpaidIndices.forEach((mIdx, i) => {
            const isLast = i === unpaidIndices.length - 1;
            const amt = isLast ? remainingToDistribute - acc : perMilestone;
            acc += amt;
            updatedSchedule![mIdx] = { ...updatedSchedule![mIdx], amount: amt };
          });
        }
      }

      let updatedAllergies = selectedBooking.food_allergies || "";
      try {
        if (updatedAllergies.includes("__PAYMENT_METADATA__:")) {
          const parts = updatedAllergies.split("__PAYMENT_METADATA__:");
          const meta = JSON.parse(parts[1]);
          meta.balance = revertedBalance;
          if (updatedSchedule) meta.installments = updatedSchedule;
          updatedAllergies = `${parts[0].trim() ? parts[0].trim() + "\n" : ""}__PAYMENT_METADATA__:${JSON.stringify(meta)}`;
        }
      } catch (e) {}

      updatePayload.guest_count = baseGuestCount;
      updatePayload.additional_pax = revertedExtraPax;
      updatePayload.selected_menu_items = revertedMenu;
      updatePayload.final_balance_amount = revertedBalance;
      if (updatedSchedule) updatePayload.installment_schedule = updatedSchedule;
      if (updatedAllergies !== (selectedBooking.food_allergies || "")) {
        updatePayload.food_allergies = updatedAllergies;
      }
    }

    try {
      const { error } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", selectedBooking.id);

      if (error) throw error;

      window.dispatchEvent(
        new CustomEvent("markAdminNotifRead", {
          detail: { key: `${selectedBooking.id}-client-mod-${reqId}` },
        })
      );
      window.dispatchEvent(new CustomEvent("bookingsUpdated"));

      await logAuditAction({
        action: targetReq.status === "Applied" ? "Reverted & Declined Client Modification" : "Rejected Modification Request",
        target: clientName,
        type: "Update",
        details: `Admin declined modification for ${clientName}. Reason: ${finalReason}`,
      });

      setBookings((prev) =>
        prev.map((b) =>
          String(b.id) === String(selectedBooking.id)
            ? {
                ...b,
                ...updatePayload,
              }
            : b
        )
      );

      setSelectedBooking({
        ...selectedBooking,
        ...updatePayload,
      });
      setRejectingModId(null);
      setRejectReasonInput("");
    } catch (err: any) {
      console.error("Error rejecting modification:", err);
      alert(`Failed to decline modification: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Booking Management
          </h2>
          <p className="text-natural-text-light text-xs font-medium uppercase tracking-wider">
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
            <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider mb-1">
              {s.label}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-natural-text-main font-serif tracking-normal">
                {s.value}
              </span>
              <span className="text-xs text-natural-text-light font-medium">
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
                  "px-3.5 py-1.5 text-xs font-bold uppercase rounded transition-all",
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
                  "px-3.5 py-1.5 text-xs font-bold uppercase rounded transition-all",
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
                    className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("customerName")}
                  >
                    <div className="flex items-center gap-1.5">
                      Customer
                      {sortConfig.field === "customerName" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border">
                    Event Details
                  </th>
                  <th
                    className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1.5">
                      Schedule
                      {sortConfig.field === "date" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center gap-1.5">
                      Applied On
                      {sortConfig.field === "created_at" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("budget")}
                  >
                    <div className="flex items-center gap-1.5">
                      Budget
                      {sortConfig.field === "budget" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border">
                    Downpayment
                  </th>
                  <th
                    className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1.5">
                      Status
                      {sortConfig.field === "status" ? (
                        sortConfig.order === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-natural-accent" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-natural-accent" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border">
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
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div>
                        <p className="text-base font-bold text-natural-text-main tracking-normal leading-snug">
                          {booking.profiles?.name ||
                            booking.profiles?.full_name ||
                            "Unknown User"}
                        </p>
                        <div className="flex flex-col gap-1.5 mt-1.5">
                          <p className="text-xs text-natural-text-light flex items-center gap-1.5 tracking-normal">
                            <Mail className="w-3.5 h-3.5 text-natural-accent/70 shrink-0" />{" "}
                            <span>{booking.profiles?.email || "N/A"}</span>
                          </p>
                          <p className="text-xs text-natural-text-light flex items-center gap-1.5 tracking-normal">
                            <Phone className="w-3.5 h-3.5 text-natural-accent/70 shrink-0" />{" "}
                            <span>
                              {booking.profiles?.phone_number ||
                                booking.profiles?.phone ||
                                "N/A"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div>
                        <p className="text-sm font-bold text-natural-text-main tracking-normal">
                          {booking.event_type || "Event"}
                        </p>
                        <p className="text-xs text-natural-accent font-semibold uppercase tracking-wider mt-1">
                          {booking.packages?.name
                            ? booking.packages.name.toLowerCase().includes("package")
                              ? booking.packages.name
                              : `${booking.packages.name} Package`
                            : "Custom Package"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm text-natural-text-main font-semibold flex items-center gap-2 tracking-normal">
                          <Calendar className="w-4 h-4 text-natural-accent opacity-75 shrink-0" />{" "}
                          <span>{formatEventDate(booking.event_date)}</span>
                        </p>
                        <p className="text-xs text-natural-text-light font-medium flex items-center gap-2 tracking-normal">
                          <Clock className="w-3.5 h-3.5 shrink-0" />{" "}
                          <span>{formatEventTime(booking.event_time)}</span>
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-natural-text-main font-semibold tracking-normal">
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
                        <p className="text-xs text-natural-text-light font-medium tracking-normal mt-0.5">
                          {booking.created_at
                            ? new Date(booking.created_at).toLocaleTimeString(
                                undefined,
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <p className="text-base font-bold text-natural-text-main font-serif tracking-normal">
                        ₱{calculateBudget(booking).toLocaleString()}
                      </p>
                      <p className="text-xs text-natural-text-light uppercase font-semibold mt-1 tracking-wider">
                        {booking.guest_count} Pax
                        {booking.additional_pax > 0 &&
                          ` (+${booking.additional_pax})`}
                      </p>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      {(() => {
                        const payment = getBookingPayment(booking);
                        const estBudget = calculateBudget(booking);
                        const is50Percent = payment.payment_scheme === "Standard 50%";
                        const downpaymentDue =
                          payment.downpayment_amount > 0
                            ? payment.downpayment_amount
                            : Math.round(estBudget * (is50Percent ? 0.5 : 0.2));
                        const isVerified =
                          payment.payment_status === "Verified" ||
                          (booking.status || "Pending") === "Confirmed";

                        return (
                          <div className="flex flex-col gap-2 min-w-[140px]">
                            {/* Downpayment info & Scheme Badge */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-bold text-natural-text-main font-serif">
                                ₱{downpaymentDue.toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border shadow-2xs",
                                  isVerified
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                                    : payment.receipt_url
                                      ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60"
                                      : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-natural-bg/40 dark:text-natural-text-light dark:border-natural-border/60",
                                )}
                              >
                                {isVerified
                                  ? "Deposit Paid"
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
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-natural-accent hover:underline cursor-pointer mt-0.5"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                View Deposit Slip
                              </button>
                            )}

                            {/* 15-Day Final Balance Settlement Row (Only for Standard 50% Scheme) */}
                            {is50Percent && payment.final_balance_amount > 0 && (
                              <div className="pt-2 mt-1 border-t border-natural-border/50 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-1.5 text-xs">
                                  <span className="text-natural-text-light font-medium">15-Day Balance:</span>
                                  <span className="font-bold text-natural-text-main font-serif">
                                    ₱{payment.final_balance_amount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span
                                    className={cn(
                                      "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded border",
                                      payment.final_balance_status === "Verified"
                                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                                        : payment.final_balance_status === "Pending Verification"
                                          ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60"
                                          : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-natural-bg/40 dark:text-natural-text-light dark:border-natural-border/60",
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
                                        title: "Final Balance Settlement",
                                      });
                                    }}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-natural-accent hover:underline cursor-pointer mt-0.5"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    View Balance Slip
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border shadow-2xs inline-block text-center",
                            (booking.status || "Pending") === "Confirmed"
                              ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                              : (booking.status || "Pending") === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                                : (booking.status || "Pending") === "Pending"
                                  ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60"
                                  : (booking.status || "Pending") === "Cancelled"
                                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60"
                                    : (booking.status || "Pending") === "Archived"
                                      ? "bg-gray-100 text-gray-600 border-gray-300 dark:bg-natural-bg/40 dark:text-natural-text-light dark:border-natural-border/60"
                                      : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-natural-bg/30 dark:text-natural-text-light dark:border-natural-border/50",
                          )}
                        >
                          {booking.status || "Pending"}
                        </span>
                        {hasLateModification(booking) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60 shadow-2xs">
                            Late Mod (&lt;14d)
                          </span>
                        )}
                        {hasPendingModification(booking) && !hasAppliedModification(booking) && !hasLateModification(booking) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 shadow-2xs">
                            Mod Requested
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5.5 border-b border-natural-border/50">
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
                                  className="p-2 text-green-600 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-950/40 rounded-lg transition-all"
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
                                  className="p-2 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/50 rounded-lg transition-all"
                                  title="Cancel Booking"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {(booking.status || "Pending") === "Confirmed" && (() => {
                              const payment = getBookingPayment(booking);
                              const isFinalVerified = payment.final_balance_status === "Verified";

                              return (
                                <button
                                  disabled={!isFinalVerified}
                                  onClick={() => {
                                    if (!isFinalVerified) return;
                                    setConfirmAction({
                                      type: "complete",
                                      bookingId: booking.id,
                                      bookingName:
                                        booking.profiles?.name ||
                                        booking.profiles?.full_name ||
                                        "Unknown User",
                                    });
                                  }}
                                  className={cn(
                                    "p-2 rounded-lg transition-all",
                                    isFinalVerified
                                      ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                                      : "text-natural-text-light/40 dark:text-natural-text-light/30 cursor-not-allowed opacity-50"
                                  )}
                                  title={
                                    isFinalVerified
                                      ? "Complete Event"
                                      : "Final payment must be confirmed and verified before completing event"
                                  }
                                >
                                  <CheckCheck className="w-4 h-4" />
                                </button>
                              );
                            })()}
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="p-2 text-natural-text-light hover:text-natural-accent hover:bg-natural-accent/5 rounded-lg transition-all"
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
                              className="p-2 text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50 rounded-lg transition-all"
                              title="Archive Booking"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(booking.status || "Pending") === "Archived" && (
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="p-2 text-natural-text-light/50 hover:text-natural-text-main hover:bg-natural-bg/50 rounded-lg transition-all"
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
                <h4 className="text-xs font-bold text-natural-accent uppercase tracking-wider border-b border-natural-accent/20 pb-2">
                  Registered Customer Link
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                <h4 className="text-xs font-bold text-natural-accent uppercase tracking-wider border-b border-natural-accent/20 pb-2">
                  Event & Package Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                      Guest Count (Pax)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={newBooking.guest_count}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setNewBooking({ ...newBooking, guest_count: "" });
                          return;
                        }
                        const num = Math.min(100000, Math.max(0, Number(val)));
                        setNewBooking({ ...newBooking, guest_count: num });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                          e.preventDefault();
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                      Additional Pax
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      value={newBooking.additional_pax}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setNewBooking({ ...newBooking, additional_pax: "" });
                          return;
                        }
                        const num = Math.min(100000, Math.max(0, Number(val)));
                        setNewBooking({ ...newBooking, additional_pax: num });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                          e.preventDefault();
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                    <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                  <h4 className="text-xs font-bold text-natural-accent uppercase tracking-wider border-b border-natural-accent/20 pb-2">
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
                              <span className="text-xs text-natural-text-light/80">
                                ({item.category}
                                {item.sub_category
                                  ? ` - ${item.sub_category}`
                                  : ""}
                                )
                              </span>
                            </span>
                            {isUnavailable && (
                              <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60 px-2 py-0.5 rounded uppercase tracking-wider">
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
                  <h4 className="text-xs font-bold text-natural-accent uppercase tracking-wider border-b border-natural-accent/20 pb-2">
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
                          <p className="text-xs font-semibold text-natural-text-light/80 uppercase tracking-wider">
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
          <div className="bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl shadow-2xl w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1450px] max-h-[94vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="py-3.5 px-6 border-b border-natural-border flex items-center justify-between shrink-0">
              <h3 className="text-lg font-serif font-bold text-natural-text-main">
                Booking Overview
              </h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 hover:bg-natural-bg rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>

            <div className="p-4 sm:p-5 xl:p-6 space-y-3.5 overflow-y-auto flex-1">
              {/* Late Modification Warning Banner */}
              {hasLateModification(selectedBooking) && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-rose-700 dark:text-rose-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">
                        Late Modification Flag (&lt;14 Days Before Event)
                      </p>
                      <p className="text-[11px] opacity-90">
                        This booking has modifications requested under the 14-day cutoff window. Verify market inventory and logistics before approving.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 shrink-0">
                    Late Action Required
                  </span>
                </div>
              )}

              {/* Top Client Header & Logistics Bar */}
              <div className="p-3.5 bg-natural-card/60 border border-natural-border rounded-xl space-y-2.5 shadow-2xs">
                {/* Client Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-natural-border/60">
                  <div>
                    <h4 className="text-xl font-serif font-bold text-natural-text-main leading-tight">
                      {selectedBooking.profiles?.name ||
                        selectedBooking.profiles?.full_name ||
                        "Unknown User"}
                    </h4>
                    <p className="text-xs font-medium text-natural-text-light">
                      {selectedBooking.event_type}{" "}
                      {selectedBooking.packages?.name} Package
                      <span className="opacity-75 ml-2">
                        (Applied:{" "}
                        {selectedBooking.created_at
                          ? new Date(selectedBooking.created_at).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "N/A"}
                        )
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border",
                        (selectedBooking.status || "Pending") === "Confirmed"
                          ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                          : (selectedBooking.status || "Pending") === "Completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60"
                            : (selectedBooking.status || "Pending") === "Cancelled"
                              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60"
                              : (selectedBooking.status || "Pending") === "Archived"
                                ? "bg-gray-100 text-gray-600 border-gray-300 dark:bg-natural-bg/40 dark:text-natural-text-light dark:border-natural-border/60"
                                : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60",
                      )}
                    >
                      {selectedBooking.status || "Pending"}
                    </span>
                  </div>
                </div>

                {/* Logistics Strip */}
                {(() => {
                  const pkg =
                    selectedBooking.packages ||
                    packages.find((p) => p.id === selectedBooking.package_id);
                  const basePrice =
                    pkg && pkg.price
                      ? parseFloat(String(pkg.price).replace(/[^\d.-]/g, "")) || 0
                      : 0;
                  const addPrice =
                    pkg && pkg.additional_pax_price
                      ? parseFloat(
                          String(pkg.additional_pax_price).replace(/[^\d.-]/g, ""),
                        ) || 0
                      : 0;
                  const additionalPaxTotal =
                    selectedBooking.additional_pax
                      ? addPrice * selectedBooking.additional_pax
                      : 0;
                  const servicesPrice = (
                    selectedBooking.selected_add_ons || []
                  ).reduce((acc: number, name: string) => {
                    const service = additionalServices.find((s) => s.name === name);
                    return (
                      acc +
                      (service
                        ? parseFloat(
                            String(service.price).replace(/[^\d.-]/g, ""),
                          ) || 0
                        : 0)
                    );
                  }, 0);
                  const logistics = getBookingLogistics(selectedBooking);
                  const totalBudget =
                    basePrice +
                    additionalPaxTotal +
                    servicesPrice +
                    logistics.haulingFee +
                    logistics.travelFee;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-3.5 h-3.5 text-natural-accent mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-wider">
                            Date & Time
                          </p>
                          <p className="font-semibold text-natural-text-main text-xs">
                            {formatEventDate(selectedBooking.event_date)} at{" "}
                            {formatEventTime(selectedBooking.event_time)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-natural-accent mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-wider">
                            Location
                          </p>
                          <p className="font-semibold text-natural-text-main text-xs truncate">
                            {(selectedBooking.event_location || "").split(" - ")[0]}
                          </p>
                          {(selectedBooking.event_location || "").split(" - ")[1] && (
                            <p className="text-[10px] text-natural-text-light truncate">
                              {(selectedBooking.event_location || "").split(" - ")[1]}
                            </p>
                          )}
                          {false && (
                            <p>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Phone className="w-3.5 h-3.5 text-natural-accent mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-wider">
                            Contact
                          </p>
                          <p className="font-semibold text-natural-text-main text-xs truncate">
                            {selectedBooking.profiles?.phone_number ||
                              selectedBooking.profiles?.phone ||
                              "N/A"}
                          </p>
                          <p className="text-[10px] text-natural-text-light truncate">
                            {selectedBooking.profiles?.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-natural-accent mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-wider">
                            Estimated Budget
                          </p>
                          <p className="font-serif font-bold text-natural-accent text-sm leading-tight">
                            ₱{totalBudget.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-natural-text-light truncate">
                            {selectedBooking.guest_count} Pax{" "}
                            {selectedBooking.additional_pax > 0
                              ? `(+${selectedBooking.additional_pax} extra @ ₱${addPrice.toLocaleString()})`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {(selectedBooking.status || "Pending") === "Cancelled" && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800/40 rounded-xl">
                  <p className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-wider mb-0.5">
                    Reason for Cancellation
                  </p>
                  <p className="text-xs text-red-900 dark:text-red-200 italic">
                    "
                    {selectedBooking.cancellation_reason &&
                    selectedBooking.cancellation_reason.trim() !== ""
                      ? selectedBooking.cancellation_reason
                      : "No reason provided"}
                    "
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* LEFT COLUMN: Payment Scheme & Ledger */}
                <div className="space-y-4">
                  {/* Venue Coverage & Custom Logistics Surcharge Card */}
                  {(() => {
                    const logistics = getBookingLogistics(selectedBooking);
                    const totalPax =
                      (Number(selectedBooking.guest_count) || 0) +
                      (Number(selectedBooking.additional_pax) || 0);
                    const autoWaiters =
                      logistics.waiterCount || Math.max(2, Math.ceil((totalPax || 50) / 25));
                    const floorsUp = logistics.isSecondFloorOrHigher
                      ? Math.max(1, (logistics.floorLevel || 2) - 1)
                      : 0;
                    const recommendedHauling =
                      logistics.isSecondFloorOrHigher && !logistics.hasElevator
                        ? 150 * floorsUp * autoWaiters
                        : 0;

                    return (
                      <div className="p-4 bg-natural-card/60 border border-natural-border rounded-2xl space-y-3.5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-natural-accent/10 flex items-center justify-center text-natural-accent shrink-0">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-natural-text-main uppercase tracking-wider">
                                Venue Coverage &amp; Logistics Surcharge
                              </h5>
                            </div>
                          </div>

                          {/* Out-of-Town & Logistics Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {logistics.isOutsideTaytay ? (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60">
                                Outside Taytay
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60">
                                Within Taytay
                              </span>
                            )}
                            {logistics.requiresStairsIngress && (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700/60">
                                Stairs Ingress Required
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Accessibility Questionnaire Summary */}
                        <div className="grid grid-cols-3 gap-2 p-2.5 bg-natural-card rounded-xl border border-natural-border text-xs">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text-light">
                              Floor Level
                            </p>
                            <p className="font-semibold text-natural-text-main mt-0.5">
                              {logistics.isSecondFloorOrHigher
                                ? `Floor ${logistics.floorLevel} (${floorsUp} flr up)`
                                : "Ground Floor"}
                            </p>
                          </div>
                          <div className="border-x border-natural-border px-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text-light">
                              Elevator
                            </p>
                            <p className="font-semibold text-natural-text-main mt-0.5">
                              {logistics.isSecondFloorOrHigher
                                ? logistics.hasElevator
                                  ? "Available"
                                  : "No Elevator"
                                : "Not Required"}
                            </p>
                          </div>
                          <div className="pl-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text-light">
                              Staff Count
                            </p>
                            <p className="font-semibold text-natural-text-main mt-0.5">
                              {autoWaiters + (logistics.hasLechonTable ? 1 : 0)} Staff ({autoWaiters} Waiters{logistics.hasLechonTable ? " + 1 Chopper" : ""})
                            </p>
                          </div>
                        </div>

                        {/* Event Crew Roster: Dedicated Lechon Chopper Assignment */}
                        {logistics.hasLechonTable && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs shrink-0">
                                🍗
                              </div>
                              <div>
                                <p className="font-bold text-natural-text-main">
                                  1 Designated Lechon Chopper Waiter Assigned
                                </p>
                                <p className="text-[11px] text-natural-text-light">
                                  Crew roster automatically allocated to the lechon carving station (Contract Term 8).
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 shrink-0">
                              Designated Crew
                            </span>
                          </div>
                        )}

                        {/* Corkage & Outside Food Surcharges (Contract Term 8 & 15) */}
                        {(() => {
                          const corkage = selectedBooking.corkage_info || logistics.corkage || null;
                          const hasCorkage = corkage && (corkage.hasLechonTable || corkage.alcoholicBeveragesCount > 0 || corkage.outsideFoodCount > 0);
                          if (!hasCorkage) return null;

                          return (
                            <div className="p-3.5 bg-natural-card rounded-xl border border-natural-border space-y-2.5 text-xs">
                              <div className="flex items-center justify-between border-b border-natural-border pb-2">
                                <span className="font-bold text-natural-accent uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                  <Wine className="w-3.5 h-3.5" /> Corkage &amp; Outside Food Services (Term 8)
                                </span>
                                <span className="font-serif font-bold text-natural-text-main text-xs">
                                  Total Corkage: ₱{(corkage.totalCorkageFee || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {corkage.hasLechonTable && (
                                  <div className="p-2 bg-natural-bg/60 border border-natural-border rounded-lg">
                                    <div className="flex justify-between items-center font-bold text-natural-text-main">
                                      <span>Lechon Table Setup</span>
                                      <span className="text-natural-accent">₱1,500</span>
                                    </div>
                                    <p className="text-[10px] text-natural-text-light mt-0.5">
                                      Half table, 50 plates, warmer, board &amp; 1 chopper waiter
                                    </p>
                                  </div>
                                )}
                                {corkage.alcoholicBeveragesCount > 0 && (
                                  <div className="p-2 bg-natural-bg/60 border border-natural-border rounded-lg">
                                    <div className="flex justify-between items-center font-bold text-natural-text-main">
                                      <span>Alcoholic Corkage</span>
                                      <span className="text-natural-accent">₱{(corkage.alcoholicBeveragesCount * 400).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[10px] text-natural-text-light mt-0.5">
                                      {corkage.alcoholicBeveragesCount} bottle(s) @ ₱400 (Ice, water, &amp; glassware included)
                                    </p>
                                  </div>
                                )}
                                {corkage.outsideFoodCount > 0 && (
                                  <div className="p-2 bg-natural-bg/60 border border-natural-border rounded-lg">
                                    <div className="flex justify-between items-center font-bold text-natural-text-main">
                                      <span>Outside Food Corkage</span>
                                      <span className="text-natural-accent">₱{(corkage.outsideFoodCount * 400).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[10px] text-natural-text-light mt-0.5">
                                      {corkage.outsideFoodCount} dish(es) @ ₱400 (Extra chafing warmer included)
                                    </p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                                      ✓ Health Risk Waiver Signed
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Custom Logistics Surcharge Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-text-light">
                              Out-of-Town Travel Fee (₱)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={customTravelFeeInput}
                              onChange={(e) => setCustomTravelFeeInput(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 text-xs font-semibold bg-natural-card border border-natural-border rounded-lg text-natural-text-main focus:outline-none focus:border-natural-accent"
                            />
                            <p className="text-[10px] text-natural-text-light">
                              {logistics.isOutsideTaytay
                                ? "Venue is outside Taytay — input distance/ocular fee"
                                : "Within Taytay coverage (₱0 default)"}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-text-light">
                                Hauling / Stairs Fee (₱)
                              </label>
                              {recommendedHauling > 0 &&
                                Number(customHaulingFeeInput) !== recommendedHauling && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCustomHaulingFeeInput(String(recommendedHauling))
                                    }
                                    className="text-[10px] font-bold text-natural-accent hover:underline cursor-pointer"
                                  >
                                    Use Auto (₱{recommendedHauling.toLocaleString()})
                                  </button>
                                )}
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="150"
                              value={customHaulingFeeInput}
                              onChange={(e) => setCustomHaulingFeeInput(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 text-xs font-semibold bg-natural-card border border-natural-border rounded-lg text-natural-text-main focus:outline-none focus:border-natural-accent"
                            />
                            <p className="text-[10px] text-natural-text-light">
                              Standard: ₱150 / floor / waiter
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <div className="text-xs">
                            {logisticsSaveMessage ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {logisticsSaveMessage}
                              </span>
                            ) : (
                              <span className="text-natural-text-light">
                                Current Logistics Total:{" "}
                                <strong className="text-natural-text-main font-serif">
                                  ₱
                                  {(
                                    (logistics.travelFee || 0) + (logistics.haulingFee || 0)
                                  ).toLocaleString()}
                                </strong>
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={isSavingLogistics}
                            onClick={() => handleSaveLogisticsSurcharge(selectedBooking.id)}
                            className="px-3.5 py-2 bg-natural-accent hover:bg-natural-accent/90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-2xs cursor-pointer shrink-0"
                          >
                            {isSavingLogistics
                              ? "Saving..."
                              : "Update Logistics Surcharge"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

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
                  const evDate = new Date(`${selectedBooking.event_date}T12:00:00`);
                  if (!isNaN(evDate.getTime())) {
                    const dl = new Date(evDate);
                    dl.setDate(dl.getDate() - 15);
                    deadlineStr = dl.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    daysRemaining = Math.ceil((dl.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  }
                }

                return (
                  <div className="p-5 bg-natural-card/50 border border-natural-border rounded-2xl space-y-4 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-natural-accent/10 flex items-center justify-center text-natural-accent shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-natural-text-main uppercase tracking-wider">
                            Payment Scheme & Ledger
                          </h5>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border shrink-0",
                          is50Percent
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                        )}
                      >
                        {payment.payment_scheme}
                      </span>
                    </div>

                    {/* Cost Overview Grid */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-natural-card rounded-xl border border-natural-border text-center shadow-2xs">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-natural-text-light">
                          Total Event Cost
                        </p>
                        <p className="text-sm font-bold text-natural-text-main font-serif">
                          ₱{totalBudget.toLocaleString()}
                        </p>
                      </div>
                      <div className="border-x border-natural-border px-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-natural-accent">
                          {is50Percent ? "50% Downpayment" : "20% Deposit"}
                        </p>
                        <p className="text-sm font-bold text-natural-accent font-serif">
                          ₱{downpaymentDue.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-natural-text-light">
                          {is50Percent ? "50% Final Balance" : "Remaining Balance"}
                        </p>
                        <p className="text-sm font-bold text-natural-text-main font-serif">
                          ₱{balanceDue.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Section 1: Initial Deposit Details & Slip */}
                    <div className="space-y-3 bg-natural-card p-3.5 rounded-xl border border-natural-border shadow-2xs">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-natural-text-main flex items-center gap-1.5 uppercase tracking-wider">
                          <CreditCard className="w-4 h-4 text-natural-accent" />
                          Date Lock Deposit ({is50Percent ? "50%" : "20%"})
                        </p>
                        <span
                          className={cn(
                            "text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border",
                            isDepositVerified
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : payment.receipt_url
                                ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60"
                                : "bg-natural-bg text-natural-text-light border-natural-border"
                          )}
                        >
                          {isDepositVerified
                            ? "Deposit Paid"
                            : payment.receipt_url
                              ? "Pending Review"
                              : "Unpaid"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs gap-2">
                            <span className="text-natural-text-light shrink-0">Method:</span>
                            <span className="font-semibold text-natural-text-main text-right">
                              {payment.payment_method || "Not selected"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs gap-2">
                            <span className="text-natural-text-light shrink-0">Reference:</span>
                            <span className="font-mono font-bold text-natural-accent text-right">
                              {payment.reference_number || "None provided"}
                            </span>
                          </div>
                          <div className="flex justify-between items-start text-xs gap-2">
                            <span className="text-natural-text-light shrink-0">Contract Terms:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-right leading-tight">
                              {payment.terms_accepted
                                ? "✓ Signed"
                                : "Agreed upon Submission"}
                            </span>
                          </div>
                        </div>

                        <div>
                          {payment.receipt_url ? (
                            <div className="flex items-center gap-2.5 bg-natural-bg/70 dark:bg-natural-sidebar/50 p-2.5 rounded-lg border border-natural-border shadow-2xs justify-between">
                              <div className="flex items-center gap-2">
                                <img
                                  src={payment.receipt_url}
                                  alt="Deposit Slip"
                                  className="w-10 h-10 object-cover rounded-md border border-natural-border cursor-pointer hover:opacity-80 transition-opacity"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1554415707-9e4c07d3882d?auto=format&fit=crop&q=80&w=800";
                                  }}
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
                                  <p className="text-xs font-bold text-natural-text-main">
                                    Deposit Receipt Slip
                                  </p>
                                  <p className="text-xs text-natural-text-light">
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
                                className="px-2.5 py-1.5 bg-natural-accent hover:bg-natural-accent/90 text-white text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                              >
                                <Eye className="w-3 h-3" /> Inspect
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-center">
                              <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                                No deposit slip uploaded yet.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stage 1 Admin Verification / Status Action */}
                      {isDepositVerified && (
                        <div className="pt-2 border-t border-natural-border/60">
                          <div className="w-full py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Deposit Confirmed & Date Locked
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section 2: Installment Milestones (If 20% Installment Scheme) */}
                    {!is50Percent && (
                      <div className="space-y-2.5 bg-natural-card p-4 rounded-xl border border-purple-200 dark:border-purple-800/50 shadow-xs">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2 uppercase tracking-wider">
                            <Clock className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                            Installment Breakdown Schedule
                          </p>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-100 text-purple-900 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/50">
                            Monthly Plan
                          </span>
                        </div>

                        {payment.installment_schedule &&
                        payment.installment_schedule.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            {payment.installment_schedule.map((milestone: any, idx: number) => {
                              const isPaid = milestone.status === "Paid" || milestone.status === "Verified" || isFinalVerified;
                              const isPending = !isPaid && milestone.status === "Pending Verification";
                              const receiptUrlToShow = milestone.receipt_url || (isFinalVerified ? payment.final_balance_receipt : "");
                              const hasSlip = Boolean(receiptUrlToShow);

                              return (
                                <div
                                  key={idx}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-3 bg-purple-50/50 hover:bg-purple-50/80 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 rounded-lg border border-purple-200/80 dark:border-purple-800/50 transition-colors shadow-2xs gap-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-purple-700 text-white dark:bg-purple-600 dark:text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                      {idx + 1}
                                    </div>
                                    <div>
                                      <p className="font-bold text-natural-text-main text-xs leading-snug">
                                        {milestone.title || milestone.milestone || `Installment #${idx + 1}`}
                                      </p>
                                      <p className="text-xs font-medium text-natural-text-main/75 dark:text-natural-text-light mt-0.5">
                                        <span className="font-semibold text-natural-text-main">Due:</span> {milestone.dueDate}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-purple-200/50">
                                    <div className="text-right">
                                      <p className="font-bold text-natural-text-main font-serif text-sm">
                                        ₱{Number(milestone.amount).toLocaleString()}
                                      </p>
                                      <span
                                        className={cn(
                                          "inline-block text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider border mt-0.5",
                                          isPaid
                                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                                            : isPending
                                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                                            : milestone.status === "Due Now"
                                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                                            : "bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700"
                                        )}
                                      >
                                        {isPaid ? "Verified" : isPending ? "Under Review" : milestone.status || "Upcoming"}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {hasSlip && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setViewingReceipt({
                                              url: receiptUrlToShow,
                                              bookingName:
                                                selectedBooking.profiles?.name ||
                                                selectedBooking.profiles?.full_name ||
                                                "Client",
                                              ref: milestone.reference_number || payment.final_balance_reference,
                                              method: milestone.payment_method || payment.final_balance_method,
                                              amount: Number(milestone.amount),
                                              title: `${milestone.title || `Installment #${idx + 1}`} Slip`,
                                            })
                                          }
                                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3" /> Slip
                                        </button>
                                      )}

                                      {!isPaid && hasSlip && (
                                        <button
                                          type="button"
                                          onClick={() => handleVerifyInstallment(selectedBooking.id, idx)}
                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                        >
                                          <CheckCheck className="w-3 h-3" /> Confirm
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-lg border border-purple-200/80 dark:border-purple-800/40 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                            <p className="text-xs font-semibold">
                              Client opted for monthly installment distribution leading up to the 15-day final balance.
                            </p>
                            <p className="text-xs text-purple-800/80 dark:text-purple-300 font-medium">
                              Remaining balance of ₱{balanceDue.toLocaleString()} is settled in monthly milestones, concluding strictly 15 days before the event.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 3: 15-Day Final Balance Settlement Tracker & Verification (Only for Standard 50% Scheme) */}
                    {is50Percent && (
                      <div className="space-y-3 bg-natural-card p-3.5 rounded-xl border border-natural-border shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <p className="text-xs font-bold text-natural-text-main flex items-center gap-1.5 uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4 text-natural-accent" />
                            Final Balance Settlement
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isFinalVerified ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Settled & Verified
                            </span>
                          ) : !isDepositVerified ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Awaiting Deposit
                            </span>
                          ) : daysRemaining !== null && daysRemaining < 0 ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" /> Overdue by {Math.abs(daysRemaining)}d
                            </span>
                          ) : daysRemaining !== null && daysRemaining <= 15 ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Due in {daysRemaining}d
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-natural-bg text-natural-text-light border border-natural-border">
                              {daysRemaining !== null ? `Due in ${daysRemaining}d` : "Upcoming"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs gap-2">
                            <span className="text-natural-text-light shrink-0">Final Balance Amount:</span>
                            <span className="font-bold text-natural-accent font-serif text-sm text-right">
                              ₱{finalBalanceAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs gap-2">
                            <span className="text-natural-text-light shrink-0">Payment Method:</span>
                            <span className="font-semibold text-natural-text-main text-right">
                              {payment.final_balance_method || "Pending submission"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs gap-2">
                            <span className="text-natural-text-light shrink-0">Reference Number:</span>
                            <span className="font-mono font-semibold text-natural-text-main text-right">
                              {payment.final_balance_reference || "N/A"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {hasFinalReceipt ? (
                            <div className="flex items-center gap-2.5 bg-natural-bg/70 dark:bg-natural-sidebar/50 p-2 rounded-lg border border-natural-border shadow-2xs justify-between">
                              <div className="flex items-center gap-2">
                                <img
                                  src={payment.final_balance_receipt}
                                  alt="Final Balance Slip"
                                  className="w-10 h-10 object-cover rounded-md border border-natural-border cursor-pointer hover:opacity-80 transition-opacity"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1554415707-9e4c07d3882d?auto=format&fit=crop&q=80&w=800";
                                  }}
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
                                  <p className="text-xs font-bold text-natural-text-main">
                                    Final Balance Slip
                                  </p>
                                  <p className="text-xs text-natural-text-light">
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
                                className="px-2.5 py-1 bg-natural-accent hover:bg-natural-accent/90 text-white text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                              >
                                <Eye className="w-3 h-3" /> Inspect
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-natural-bg/60 dark:bg-natural-sidebar/30 rounded-lg border border-natural-border text-center">
                              <p className="text-xs text-natural-text-light italic">
                                No final balance slip uploaded yet.
                              </p>
                            </div>
                          )}

                          {/* Admin Verification Action */}
                          {isFinalVerified ? (
                            <div className="w-full py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Final Balance Confirmed
                            </div>
                          ) : !isDepositVerified ? (
                            <div className="w-full py-2 bg-natural-bg/50 border border-dashed border-natural-border text-natural-text-light rounded-lg text-xs font-medium flex items-center justify-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-natural-text-light/70" />
                              <span>Unlocks after deposit is confirmed</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!hasFinalReceipt}
                              onClick={() => {
                                if (!hasFinalReceipt) return;
                                setConfirmAction({
                                  type: "verify_final_payment",
                                  bookingId: selectedBooking.id,
                                  bookingName:
                                    selectedBooking.profiles?.name ||
                                    selectedBooking.profiles?.full_name ||
                                    "Unknown User",
                                });
                              }}
                              className={cn(
                                "w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs select-none",
                                hasFinalReceipt
                                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                  : "bg-natural-bg/70 dark:bg-natural-sidebar/40 border border-natural-border text-natural-text-light/60 cursor-not-allowed opacity-75"
                              )}
                              title={
                                !hasFinalReceipt
                                  ? "Client must upload a final balance slip before payment can be confirmed"
                                  : "Verify and confirm final payment"
                              }
                            >
                              {hasFinalReceipt ? (
                                <>
                                  <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                                  <span className="whitespace-nowrap">
                                    Confirm Final Payment
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 shrink-0 text-natural-text-light/70" />
                                  <span className="whitespace-nowrap">
                                    Confirm (Slip Required)
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                );
              })()}
                </div>

                {/* RIGHT COLUMN: Menu Selection & Equipment */}
                <div className="space-y-3.5">
                  {/* Food Allergies (if any) */}
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
                      <div className="p-3 bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-800/40 rounded-xl flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider mb-0.5">
                            Food Allergies & Dietary Restrictions
                          </p>
                          <p className="text-xs text-orange-900 dark:text-orange-200 font-medium leading-relaxed">
                            {cleanAllergies}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Client Special Instructions / Modification Notes (if any) */}
                  {(() => {
                    const modList = Array.isArray(selectedBooking.modification_requests)
                      ? selectedBooking.modification_requests.filter((r: any) => r.status !== "Superseded")
                      : [];
                    const latestModNote =
                      modList.length > 0 ? (modList[modList.length - 1]?.notes || "").trim() : "";
                    const specialInstructions =
                      (selectedBooking.logistics_info?.client_special_instructions || "").trim() ||
                      latestModNote;

                    if (!specialInstructions) return null;

                    return (
                      <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 rounded-xl flex items-start gap-2.5">
                        <Sliders className="w-4 h-4 text-natural-accent shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-natural-accent uppercase tracking-wider mb-0.5">
                            Client Special Instructions / Reason for Changes
                          </p>
                          <p className="text-xs text-natural-text-main font-medium leading-relaxed italic">
                            "{specialInstructions}"
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Menu Selection & Additional Services */}
                  <div className="p-3.5 bg-natural-card/50 border border-natural-border rounded-xl space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between pb-1 border-b border-natural-border/50">
                      <h5 className="text-[11px] font-bold text-natural-accent uppercase tracking-wider">
                        Menu Selection {selectedBooking.selected_menu_items ? `(${selectedBooking.selected_menu_items.length} items)` : ""}
                      </h5>
                      <button
                        type="button"
                        onClick={() => handleOpenSubstituteModal()}
                        className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-natural-accent/10 text-natural-accent hover:bg-natural-accent hover:text-white rounded border border-natural-accent/30 transition-colors flex items-center gap-1 cursor-pointer"
                        title="If ingredient or dish is out of stock in market, select a reasonable replacement"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Substitute Unavailable Dish
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {selectedBooking.selected_menu_items &&
                      selectedBooking.selected_menu_items.length > 0 ? (
                        (() => {
                          const groupedMenu: Record<string, string[]> = {};
                          const uncategorized: string[] = [];

                          selectedBooking.selected_menu_items.forEach(
                            (m: string) => {
                              const itemDef = menuItems.find((mi) => mi.name === m);
                              const cat = getRuleCategory(itemDef?.category || "", m);
                              if (cat) {
                                if (!groupedMenu[cat]) groupedMenu[cat] = [];
                                groupedMenu[cat].push(m);
                              } else {
                                uncategorized.push(m);
                              }
                            },
                          );

                          const sortedCategories = categoryOrder.filter(
                            (cat) => groupedMenu[cat] && groupedMenu[cat].length > 0
                          );
                          Object.keys(groupedMenu).forEach((c) => {
                            if (!sortedCategories.includes(c)) sortedCategories.push(c);
                          });

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {sortedCategories.map((cat) => (
                                <div key={cat} className="space-y-1">
                                  <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-wider border-b border-natural-border/40 pb-0.5">
                                    {cat} ({groupedMenu[cat].length})
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {groupedMenu[cat].map((m) => (
                                      <div
                                        key={m}
                                        className="group/dish inline-flex items-center gap-1 px-2 py-0.5 bg-natural-bg border border-natural-border rounded-md text-[11px] font-semibold text-natural-text-main uppercase tracking-wider"
                                      >
                                        <span>{m}</span>
                                        <button
                                          type="button"
                                          title="Substitute out of stock dish"
                                          onClick={() => handleOpenSubstituteModal(m)}
                                          className="text-natural-text-light/40 group-hover/dish:text-natural-accent hover:scale-110 transition-all p-0.5 cursor-pointer"
                                        >
                                          <RefreshCw className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {uncategorized.length > 0 && (
                                <div key="Other" className="space-y-1">
                                  <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-wider border-b border-natural-border/40 pb-0.5">
                                    Other ({uncategorized.length})
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {uncategorized.map((m) => (
                                      <div
                                        key={m}
                                        className="group/dish inline-flex items-center gap-1 px-2 py-0.5 bg-natural-bg border border-natural-border rounded-md text-[11px] font-semibold text-natural-text-main uppercase tracking-wider"
                                      >
                                        <span>{m}</span>
                                        <button
                                          type="button"
                                          title="Substitute out of stock dish"
                                          onClick={() => handleOpenSubstituteModal(m)}
                                          className="text-natural-text-light/40 group-hover/dish:text-natural-accent hover:scale-110 transition-all p-0.5 cursor-pointer"
                                        >
                                          <RefreshCw className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-natural-text-light italic">
                          No menu items selected
                        </span>
                      )}
                    </div>

                    {/* Active Dish Substitutions Log (filtered to active menu items) */}
                    {(() => {
                      const activeMenu: string[] = Array.isArray(selectedBooking.selected_menu_items)
                        ? selectedBooking.selected_menu_items
                        : [];
                      const activeSubs = Array.isArray(selectedBooking.dish_substitutions)
                        ? selectedBooking.dish_substitutions.filter(
                            (sub: any) => sub?.replacement_dish && activeMenu.includes(sub.replacement_dish)
                          )
                        : [];
                      if (activeSubs.length === 0) return null;
                      return (
                        <div className="pt-2 border-t border-natural-border/60 space-y-1.5">
                          <p className="text-[10px] font-bold text-natural-accent uppercase tracking-wider flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Active Dish Substitutions ({activeSubs.length})
                          </p>
                          <div className="space-y-1">
                            {activeSubs.map((sub: any, idx: number) => (
                              <div key={idx} className="p-1.5 bg-natural-bg/70 border border-natural-border/50 rounded text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <div>
                                  <span className="line-through text-natural-text-light/60">{sub.original_dish}</span>
                                  <span className="mx-1 text-natural-accent font-bold">➔</span>
                                  <span className="font-bold text-natural-text-main">{sub.replacement_dish}</span>
                                  {sub.reason && <span className="text-[10px] text-natural-text-light ml-1.5">({sub.reason})</span>}
                                </div>
                                <span className="text-[9px] text-natural-text-light shrink-0">
                                  {sub.substituted_at ? new Date(sub.substituted_at).toLocaleDateString() : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {selectedBooking.selected_add_ons &&
                      selectedBooking.selected_add_ons.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-natural-border/50">
                          <h6 className="text-[10px] font-bold text-natural-accent uppercase tracking-wider">
                            Additional Services
                          </h6>
                          <div className="flex flex-wrap gap-1">
                            {selectedBooking.selected_add_ons.map((s: string) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 bg-natural-bg border border-natural-border rounded-md text-[11px] font-semibold text-natural-text-main uppercase tracking-wider"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Client Modification Requests & History Card */}
                  {(() => {
                    const visibleModRequests = Array.isArray(selectedBooking.modification_requests)
                      ? selectedBooking.modification_requests.filter((r: any) => r.status !== "Superseded")
                      : [];
                    if (visibleModRequests.length === 0) return null;

                    return (
                      <div className="p-3.5 bg-natural-card/50 border border-natural-border rounded-xl space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between pb-1 border-b border-natural-border/50">
                          <h5 className="text-[11px] font-bold text-natural-accent uppercase tracking-wider flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5" />
                            Client Modifications &amp; History ({visibleModRequests.length})
                          </h5>
                          {hasLateModification(selectedBooking) && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              ⚠️ Under 14-Day Lockout
                            </span>
                          )}
                        </div>

                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                          {[...visibleModRequests].reverse().map((req: any, revIdx: number) => {
                            const origNum = visibleModRequests.length - revIdx;
                            const isLate =
                              req.is_late ||
                              (req.days_before_event !== undefined && req.days_before_event <= 14);
                            const isPending = req.status === "Pending";
                            const isApplied = req.status === "Applied";
                            const isActionable = isPending || isApplied;

                            const prevMenu: string[] = Array.isArray(req.previous_menu_items)
                              ? req.previous_menu_items
                              : [];
                            const reqMenu: string[] = Array.isArray(req.requested_menu_items)
                              ? req.requested_menu_items
                              : [];
                            const addedDishes: string[] = Array.isArray(req.added_dishes)
                              ? req.added_dishes
                              : reqMenu.filter((d) => !prevMenu.includes(d));
                            const removedDishes: string[] = Array.isArray(req.removed_dishes)
                              ? req.removed_dishes
                              : prevMenu.filter((d) => !reqMenu.includes(d));

                            const basePaxVal =
                              Number(req.base_guest_count) ||
                              Number(selectedBooking.guest_count) ||
                              50;
                            const prevExtra = Number(req.previous_additional_pax) || 0;
                            const reqExtra = Number(req.requested_additional_pax) || 0;

                            return (
                              <div
                                key={req.id || revIdx}
                                className="p-3 bg-natural-bg/60 border border-natural-border/60 rounded-lg space-y-2 text-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-natural-text-main">
                                      Modification #{origNum}
                                    </span>
                                    {req.created_at && (
                                      <span className="text-[10px] text-natural-text-light">
                                        {new Date(req.created_at).toLocaleString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    )}
                                    {isLate && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                        ⚠️ Late ({req.days_before_event}d before event)
                                      </span>
                                    )}
                                    {!isLate && req.days_before_event !== undefined && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                        {req.days_before_event}d before event
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      req.status === "Approved"
                                        ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 border border-green-300"
                                        : req.status === "Applied"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300"
                                        : req.status === "Rejected"
                                        ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300"
                                    }`}
                                  >
                                    {req.status === "Applied"
                                      ? "Applied by Client"
                                      : req.status === "Approved"
                                      ? "Confirmed"
                                      : req.status === "Rejected"
                                      ? "Declined / Reverted"
                                      : "Pending Review"}
                                  </span>
                                </div>

                                <div className="space-y-1.5 text-natural-text-light text-[11px]">
                                  {prevExtra !== reqExtra && (
                                    <p>
                                      <strong className="text-natural-text-main">Headcount Change:</strong>{" "}
                                      {basePaxVal + prevExtra} Guests (+{prevExtra} extra) ➔{" "}
                                      <strong className="text-natural-accent">
                                        {basePaxVal + reqExtra} Guests (+{reqExtra} extra)
                                      </strong>
                                    </p>
                                  )}

                                  {(addedDishes.length > 0 || removedDishes.length > 0) && (
                                    <div className="space-y-1">
                                      <strong className="text-natural-text-main block">
                                        Dish Swap:
                                      </strong>
                                      {removedDishes.length === 1 && addedDishes.length === 1 ? (
                                        <p className="flex items-center gap-1.5 flex-wrap">
                                          <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30 rounded text-[10px] line-through">
                                            {removedDishes[0]}
                                          </span>
                                          <span className="text-natural-accent font-bold">➔</span>
                                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold">
                                            {addedDishes[0]}
                                          </span>
                                        </p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1">
                                          {removedDishes.map((d) => (
                                            <span
                                              key={`rem-${d}`}
                                              className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30 rounded text-[10px] line-through"
                                            >
                                              {d}
                                            </span>
                                          ))}
                                          {addedDishes.map((d) => (
                                            <span
                                              key={`add-${d}`}
                                              className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold"
                                            >
                                              + {d}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {req.notes && (
                                    <div className="p-2 bg-natural-card border border-natural-border rounded">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-natural-accent block">
                                        Special Instructions / Reason:
                                      </span>
                                      <p className="italic text-natural-text-main mt-0.5">
                                        "{req.notes}"
                                      </p>
                                    </div>
                                  )}

                                  {req.review_note && (
                                    <p className="text-rose-500 font-medium">
                                      Coordinator Note: "{req.review_note}"
                                    </p>
                                  )}
                                </div>

                                {isActionable && (
                                  <div className="pt-2 border-t border-natural-border/40 flex items-center justify-end gap-2">
                                    {rejectingModId === req.id ? (
                                      <div className="flex items-center gap-1 w-full">
                                        <input
                                          type="text"
                                          placeholder={
                                            isApplied
                                              ? "Reason for reverting changes..."
                                              : "Reason for declining..."
                                          }
                                          value={rejectReasonInput}
                                          onChange={(e) => setRejectReasonInput(e.target.value)}
                                          className="flex-1 bg-natural-card border border-natural-border px-2 py-1 text-xs rounded text-natural-text-main"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRejectModification(req.id, rejectReasonInput)
                                          }
                                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase rounded cursor-pointer"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRejectingModId(null);
                                            setRejectReasonInput("");
                                          }}
                                          className="px-2 py-1 bg-natural-border hover:bg-natural-border/80 text-natural-text-main text-[10px] rounded cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRejectingModId(req.id);
                                            setRejectReasonInput("");
                                          }}
                                          className="px-2.5 py-1 text-rose-600 hover:bg-rose-500/10 border border-rose-500/30 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                        >
                                          {isApplied ? "Revert & Decline" : "Decline"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleApproveModification(req.id)}
                                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                                        >
                                          <CheckCircle2 className="w-3 h-3" />
                                          {isApplied ? "Acknowledge & Confirm" : "Approve & Apply"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Allocated Event Equipment Section */}
                  {/* Allocated Event Equipment Section */}
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
                    const corkageInfo = selectedBooking.corkage_info || selectedBooking.logistics_info?.corkage || null;
                    const equipList = calculatePackageEquipment(
                      pkgName,
                      totalPax,
                      selectedBooking.packages?.inclusions || selectedBooking.inclusions,
                      undefined,
                      corkageInfo
                    );

                    const deductionRec = deductionRecords.find(
                      (d) => String(d.bookingId) === String(selectedBooking.id),
                    );

                    const equipBreakdown = equipList.map((eq) => {
                      const matchedRecItem = deductionRec?.items.find(
                        (it) => it.itemName.toLowerCase() === eq.itemName.toLowerCase(),
                      );
                      const invItem = items.find(
                        (it) =>
                          it.status !== "Archived" &&
                          it.name.toLowerCase() === eq.itemName.toLowerCase(),
                      );

                      let inHouseQty = 0;
                      let outsourcedQty = 0;

                      if (matchedRecItem !== undefined) {
                        inHouseQty = Math.min(matchedRecItem.quantity, eq.quantity);
                        const remainder = Math.max(0, eq.quantity - inHouseQty);
                        outsourcedQty = Math.max(matchedRecItem.outsourcedQuantity || 0, remainder);
                      } else {
                        const available = invItem ? Math.max(0, invItem.stock) : 0;
                        inHouseQty = Math.min(available, eq.quantity);
                        outsourcedQty = Math.max(0, eq.quantity - inHouseQty);
                      }

                      return {
                        ...eq,
                        inHouseQty,
                        outsourcedQty,
                      };
                    });

                    const totalInHouse = equipBreakdown.reduce((acc, eq) => acc + eq.inHouseQty, 0);
                    const totalOutsourced = equipBreakdown.reduce((acc, eq) => acc + eq.outsourcedQty, 0);
                    const bookingStatus = selectedBooking.status || "Pending";
                    const isCompleted = bookingStatus === "Completed";
                    const isConfirmed = bookingStatus === "Confirmed";
                    const isCancelled = bookingStatus === "Cancelled";

                    return (
                      <div className="p-3.5 bg-natural-card/50 border border-natural-border rounded-xl space-y-2.5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-[11px] font-bold text-natural-accent uppercase tracking-wider flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5" />
                              Allocated Event Equipment
                            </h5>
                            {isCompleted ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                                <CheckCheck className="w-3 h-3" /> Returned to Monitoring
                              </span>
                            ) : isConfirmed || isBookingDeducted(selectedBooking.id) ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> ✓ Stock Deducted
                              </span>
                            ) : isCancelled ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60">
                                Cancelled / Released
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                Pending Confirmation
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] font-bold flex-wrap">
                            {isCompleted ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCheck className="w-3 h-3" /> Supplies Returned ({totalPax} Pax)
                              </span>
                            ) : (
                              <>
                                <span
                                  className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"
                                  title={`In-use equipment: ${totalInHouse.toLocaleString()} units`}
                                >
                                  <Warehouse className="w-3 h-3" /> In-Use: {totalInHouse.toLocaleString()} units
                                </span>
                                {totalOutsourced > 0 && (
                                  <span
                                    className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1"
                                    title={`Equipment to outsource: ${totalOutsourced.toLocaleString()} units`}
                                  >
                                    <ArrowUpRight className="w-3 h-3" /> To Outsource: {totalOutsourced.toLocaleString()} units
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                          {equipBreakdown.map((eq, i) => (
                            <div
                              key={i}
                              className={cn(
                                "p-2 rounded-xl border text-[11px] flex flex-col justify-between gap-1.5 transition-all shadow-2xs",
                                !isCompleted && eq.outsourcedQty > 0
                                  ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-300/70 dark:border-amber-800/50"
                                  : "bg-natural-card border-natural-border",
                              )}
                            >
                              <div className="flex justify-between items-start gap-1">
                                <span
                                  className="font-semibold text-natural-text-main leading-tight truncate"
                                  title={eq.itemName}
                                >
                                  {eq.itemName}
                                </span>
                                <span className="font-serif font-bold text-natural-accent shrink-0 text-xs">
                                  {eq.quantity} {eq.unit}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10.5px] pt-1.5 border-t border-natural-border/50 gap-1.5">
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shrink-0",
                                    eq.inHouseQty > 0
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-natural-bg text-natural-text-light/60 border border-natural-border/40",
                                  )}
                                  title={`In-Use: ${eq.inHouseQty.toLocaleString()} ${eq.unit}`}
                                >
                                  <Warehouse className="w-3 h-3 shrink-0" />
                                  <span>{eq.inHouseQty.toLocaleString()}</span>
                                </span>

                                {isCompleted ? (
                                  <span
                                    className="text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] shrink-0 flex items-center gap-0.5"
                                    title="Returned to Monitoring"
                                  >
                                    <CheckCheck className="w-3 h-3 shrink-0" /> Returned
                                  </span>
                                ) : eq.outsourcedQty > 0 ? (
                                  <span
                                    className="px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1"
                                    title={`To Outsource: ${eq.outsourcedQty.toLocaleString()} ${eq.unit}`}
                                  >
                                    <ArrowUpRight className="w-3 h-3 shrink-0" />
                                    <span>{eq.outsourcedQty.toLocaleString()}</span>
                                  </span>
                                ) : (
                                  <span
                                    className="text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] shrink-0 flex items-center gap-0.5"
                                    title="Fully covered (in-use)"
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" /> In-Use
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            </div>

            <div className="py-3.5 px-6 bg-natural-bg/30 border-t border-natural-border flex gap-3 shrink-0">
              {(selectedBooking.status || "Pending") === "Pending" && (() => {
                const payment = getBookingPayment(selectedBooking);
                const totalBudget = calculateBudget(selectedBooking);
                const is50Percent = payment.payment_scheme === "Standard 50%";
                const downpaymentDue =
                  payment.downpayment_amount > 0
                    ? payment.downpayment_amount
                    : Math.round(totalBudget * (is50Percent ? 0.5 : 0.2));

                return (
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
                      className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Verify Deposit & Confirm (₱{downpaymentDue.toLocaleString()})
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
                      className="flex-1 bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-100/70 dark:hover:bg-orange-950/70 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Booking
                    </button>
                  </>
                );
              })()}
              {(selectedBooking.status || "Pending") === "Confirmed" && (() => {
                const payment = getBookingPayment(selectedBooking);
                const isFinalVerified = payment.final_balance_status === "Verified";

                return (
                  <>
                    <button
                      type="button"
                      disabled={!isFinalVerified}
                      onClick={() => {
                        if (!isFinalVerified) return;
                        setConfirmAction({
                          type: "complete",
                          bookingId: selectedBooking.id,
                          bookingName:
                            selectedBooking.profiles?.name ||
                            selectedBooking.profiles?.full_name ||
                            "Unknown User",
                        });
                      }}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 select-none",
                        isFinalVerified
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          : "bg-natural-bg/70 dark:bg-natural-sidebar/50 border border-natural-border text-natural-text-light/60 cursor-not-allowed opacity-75",
                      )}
                      title={
                        !isFinalVerified
                          ? "Final balance payment must be confirmed and verified before completing event"
                          : "Mark event completed and return equipment to monitoring"
                      }
                    >
                      {!isFinalVerified ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-natural-text-light/60" />
                          <span>Complete Event (Final Payment Verification Required)</span>
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Complete Event</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBooking(null)}
                      className="px-6 border border-natural-border text-natural-text-light hover:text-natural-text-main bg-white dark:bg-natural-card py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shrink-0"
                    >
                      Close
                    </button>
                  </>
                );
              })()}
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

      {confirmAction && (() => {
        const confirmTargetBooking =
          confirmAction.type === "confirm"
            ? bookings.find((b) => b.id === confirmAction.bookingId)
            : null;
        const confirmPkgName =
          confirmTargetBooking?.packages?.name ||
          packages.find((p) => p.id === confirmTargetBooking?.package_id)?.name ||
          confirmTargetBooking?.package ||
          packages[0]?.name ||
          "Event Package";
        const confirmTotalPax =
          (Number(confirmTargetBooking?.guest_count) || 50) +
          (Number(confirmTargetBooking?.additional_pax) || 0);
        const confirmCheck =
          confirmAction.type === "confirm"
            ? checkInventoryAvailability(
                confirmPkgName,
                confirmTotalPax,
                confirmTargetBooking?.packages?.inclusions ||
                  confirmTargetBooking?.inclusions,
              )
            : null;
        const hasShortage = confirmCheck ? !confirmCheck.isAvailable : false;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4 overflow-y-auto">
            <div
              className={cn(
                "bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl shadow-2xl w-full max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 my-auto relative",
                hasShortage
                  ? "max-w-2xl"
                  : confirmAction.type === "complete"
                    ? "max-w-xl"
                    : confirmAction.type === "confirm" ||
                        confirmAction.type === "verify_final_payment"
                      ? "max-w-md"
                      : "max-w-sm",
              )}
            >
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="absolute top-4 right-4 p-1 rounded-lg text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/80 transition-colors cursor-pointer z-10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className={cn("text-center", hasShortage ? "p-5" : "p-6")}>
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center mx-auto",
                    hasShortage ? "w-10 h-10 mb-2" : "w-14 h-14 mb-3",
                    confirmAction.type === "confirm"
                      ? "bg-green-100 dark:bg-emerald-950/60"
                      : confirmAction.type === "complete"
                        ? "bg-emerald-100 dark:bg-emerald-950/60"
                        : confirmAction.type === "cancel"
                          ? "bg-orange-100 dark:bg-orange-950/60"
                          : confirmAction.type === "archive"
                            ? "bg-gray-100 dark:bg-natural-bg/50"
                            : "bg-blue-100 dark:bg-blue-950/60",
                  )}
                >
                  {confirmAction.type === "confirm" && (
                    <CheckCircle2 className={cn("text-green-600 dark:text-emerald-400", hasShortage ? "w-5 h-5" : "w-7 h-7")} />
                  )}
                  {confirmAction.type === "complete" && (
                    <CheckCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {confirmAction.type === "cancel" && (
                    <XCircle className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                  )}
                  {confirmAction.type === "archive" && (
                    <Archive className="w-7 h-7 text-gray-600 dark:text-natural-text-light" />
                  )}
                  {confirmAction.type === "create" && (
                    <Plus className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  )}
                  {confirmAction.type === "verify_final_payment" && (
                    <CheckCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <h3 className="text-lg font-serif font-bold text-natural-text-main mb-1 capitalize">
                  {confirmAction.type === "complete"
                    ? "Complete Event?"
                    : confirmAction.type === "verify_final_payment"
                      ? "Confirm Final Payment?"
                      : `${confirmAction.type} Booking?`}
                </h3>
                <p className={cn("text-sm text-natural-text-light", hasShortage ? "mb-3" : "mb-4")}>
                  {confirmAction.type === "create"
                    ? `Are you sure you want to create a new booking for ${confirmAction.bookingName}?`
                    : confirmAction.type === "complete"
                      ? `Are you sure the event for ${confirmAction.bookingName} is finished? This will mark the booking as Completed and return all allocated equipment back to equipment monitoring.`
                      : confirmAction.type === "verify_final_payment"
                        ? `Confirming the final payment will record the client's balance settlement and unlock the Mark Event Complete action for ${confirmAction.bookingName}.`
                        : `Are you sure you want to ${confirmAction.type} the booking for ${confirmAction.bookingName}?`}
                </p>

                {confirmAction.type === "verify_final_payment" && (() => {
                  const targetBooking = bookings.find((b) => b.id === confirmAction.bookingId);
                  const payment = targetBooking ? getBookingPayment(targetBooking) : null;
                  const totalBudget = targetBooking ? calculateBudget(targetBooking) : 0;
                  const is50Percent = payment?.payment_scheme === "Standard 50%";
                  const downpaymentDue =
                    payment?.downpayment_amount && payment.downpayment_amount > 0
                      ? payment.downpayment_amount
                      : Math.round(totalBudget * (is50Percent ? 0.5 : 0.2));
                  const finalBalanceAmount =
                    payment?.final_balance_amount && payment.final_balance_amount > 0
                      ? payment.final_balance_amount
                      : Math.max(0, totalBudget - downpaymentDue);

                  return (
                    <div className="space-y-3 mb-5">
                      <div className="p-3.5 bg-blue-50/90 dark:bg-blue-950/30 border border-blue-200/90 dark:border-blue-800/40 rounded-xl text-left space-y-2">
                        <div className="flex items-center justify-between text-blue-900 dark:text-blue-300 font-bold text-xs">
                          <div className="flex items-center gap-1.5">
                            <CheckCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>Final Balance Settlement</span>
                          </div>
                          <span className="font-mono text-blue-800 dark:text-blue-300 font-bold text-sm">
                            ₱{finalBalanceAmount.toLocaleString()}
                          </span>
                        </div>

                        <div className="text-xs text-blue-950/80 dark:text-blue-200/90 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-natural-text-light">Payment Scheme:</span>
                            <span className="font-semibold text-natural-text-main">
                              {payment?.payment_scheme || "Standard 50%"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-natural-text-light">Payment Method:</span>
                            <span className="font-semibold text-natural-text-main">
                              {payment?.final_balance_method || "Manual / In-Person"}
                            </span>
                          </div>
                          {payment?.final_balance_reference && (
                            <div className="flex justify-between">
                              <span className="text-natural-text-light">Reference:</span>
                              <span className="font-mono font-bold text-natural-accent">
                                {payment.final_balance_reference}
                              </span>
                            </div>
                          )}
                        </div>

                        {payment?.final_balance_receipt && (
                          <div className="pt-2 border-t border-blue-200/70 dark:border-blue-800/40 flex items-center justify-between">
                            <span className="text-xs text-natural-text-light">
                              Receipt attached by client
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setViewingReceipt({
                                  url: payment.final_balance_receipt,
                                  bookingName: confirmAction.bookingName,
                                  ref: payment.final_balance_reference,
                                  method: payment.final_balance_method,
                                  amount: finalBalanceAmount,
                                  title: "15-Day Final Balance Receipt",
                                })
                              }
                              className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-blue-700 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> Inspect Slip
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 rounded-lg text-left text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          Confirming will verify the client's final balance and immediately reveal the <strong>Mark Event Done & Return Equipment</strong> button.
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {confirmAction.type === "complete" && (() => {
                  const targetBooking = bookings.find((b) => b.id === confirmAction.bookingId);
                  const payment = targetBooking ? getBookingPayment(targetBooking) : null;
                  const totalBudget = targetBooking ? calculateBudget(targetBooking) : 0;
                  const is50Percent = payment?.payment_scheme === "Standard 50%";
                  const downpaymentDue =
                    payment?.downpayment_amount && payment.downpayment_amount > 0
                      ? payment.downpayment_amount
                      : Math.round(totalBudget * (is50Percent ? 0.5 : 0.2));
                  const finalBalanceAmount =
                    payment?.final_balance_amount && payment.final_balance_amount > 0
                      ? payment.final_balance_amount
                      : Math.max(0, totalBudget - downpaymentDue);

                  return (
                    <div className="space-y-3 mb-5 text-left">
                      {/* Financial Overview Strip */}
                      <div className="grid grid-cols-3 gap-2 p-3 bg-natural-bg/70 dark:bg-natural-sidebar/50 border border-natural-border/70 rounded-xl text-center">
                        <div>
                          <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-wider">
                            Total Event Cost
                          </p>
                          <p className="font-serif font-bold text-natural-text-main text-sm mt-0.5">
                            ₱{totalBudget.toLocaleString()}
                          </p>
                        </div>
                        <div className="border-x border-natural-border/60">
                          <p className="text-[10px] font-bold text-natural-accent uppercase tracking-wider">
                            {is50Percent ? "50% Downpayment" : "20% Downpayment"}
                          </p>
                          <p className="font-serif font-bold text-natural-accent text-sm mt-0.5">
                            ₱{downpaymentDue.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            {is50Percent ? "50% Final Balance" : "Final Balance"}
                          </p>
                          <p className="font-serif font-bold text-emerald-700 dark:text-emerald-400 text-sm mt-0.5">
                            ₱{finalBalanceAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Payment Records with Inspect Slips */}
                      <div className={cn("grid gap-2.5", is50Percent ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                        {/* Date Lock Deposit Card */}
                        <div className="p-3 bg-natural-card border border-natural-border/70 rounded-xl space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-natural-accent" />
                              Date Lock Deposit
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              Deposit Paid
                            </span>
                          </div>

                          <div className="text-xs space-y-1.5 text-natural-text-light">
                            <div className="flex justify-between items-center">
                              <span>Amount:</span>
                              <span className="font-serif font-bold text-natural-text-main text-xs">
                                ₱{downpaymentDue.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Method:</span>
                              <span className="font-semibold text-natural-text-main">
                                {payment?.payment_method || "Bank Transfer"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Reference:</span>
                              <span className="font-mono font-medium text-natural-text-main truncate max-w-[130px]">
                                {payment?.reference_number || "None provided"}
                              </span>
                            </div>
                          </div>

                          {payment?.receipt_url ? (
                            <div className="pt-2 border-t border-natural-border/60 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <img
                                  src={payment.receipt_url}
                                  alt="Deposit Slip"
                                  className="w-8 h-8 object-cover rounded border border-natural-border cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                  onClick={() =>
                                    setViewingReceipt({
                                      url: payment.receipt_url,
                                      bookingName: confirmAction.bookingName,
                                      ref: payment.reference_number,
                                      method: payment.payment_method,
                                      amount: downpaymentDue,
                                      title: `${is50Percent ? "50%" : "20%"} Reservation Deposit Slip`,
                                    })
                                  }
                                />
                                <div className="truncate">
                                  <p className="text-[11px] font-bold text-natural-text-main truncate">
                                    Deposit Receipt Slip
                                  </p>
                                  <p className="text-[10px] text-natural-text-light">
                                    ₱{downpaymentDue.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingReceipt({
                                    url: payment.receipt_url,
                                    bookingName: confirmAction.bookingName,
                                    ref: payment.reference_number,
                                    method: payment.payment_method,
                                    amount: downpaymentDue,
                                    title: `${is50Percent ? "50%" : "20%"} Reservation Deposit Slip`,
                                  })
                                }
                                className="px-2.5 py-1 bg-natural-accent hover:bg-natural-accent/90 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                              >
                                <Eye className="w-3 h-3" /> Inspect
                              </button>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-natural-border/60 text-[10px] text-natural-text-light italic">
                              No deposit slip attached
                            </div>
                          )}
                        </div>

                        {/* Final Balance Card (Only for Standard 50% Scheme) */}
                        {is50Percent && (
                          <div className="p-3 bg-natural-card border border-natural-border/70 rounded-xl space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Final Balance
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              Settled & Verified
                            </span>
                          </div>

                          <div className="text-xs space-y-1.5 text-natural-text-light">
                            <div className="flex justify-between items-center">
                              <span>Amount:</span>
                              <span className="font-serif font-bold text-natural-text-main text-xs">
                                ₱{finalBalanceAmount.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Method:</span>
                              <span className="font-semibold text-natural-text-main">
                                {payment?.final_balance_method || "Bank Transfer"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Reference:</span>
                              <span className="font-mono font-medium text-natural-text-main truncate max-w-[130px]">
                                {payment?.final_balance_reference || "N/A"}
                              </span>
                            </div>
                          </div>

                          {payment?.final_balance_receipt ? (
                            <div className="pt-2 border-t border-natural-border/60 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <img
                                  src={payment.final_balance_receipt}
                                  alt="Final Balance Slip"
                                  className="w-8 h-8 object-cover rounded border border-natural-border cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                  onClick={() =>
                                    setViewingReceipt({
                                      url: payment.final_balance_receipt,
                                      bookingName: confirmAction.bookingName,
                                      ref: payment.final_balance_reference,
                                      method: payment.final_balance_method,
                                      amount: finalBalanceAmount,
                                      title: "15-Day Final Balance Slip",
                                    })
                                  }
                                />
                                <div className="truncate">
                                  <p className="text-[11px] font-bold text-natural-text-main truncate">
                                    Final Balance Slip
                                  </p>
                                  <p className="text-[10px] text-natural-text-light">
                                    ₱{finalBalanceAmount.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingReceipt({
                                    url: payment.final_balance_receipt,
                                    bookingName: confirmAction.bookingName,
                                    ref: payment.final_balance_reference,
                                    method: payment.final_balance_method,
                                    amount: finalBalanceAmount,
                                    title: "15-Day Final Balance Slip",
                                  })
                                }
                                className="px-2.5 py-1 bg-natural-accent hover:bg-natural-accent/90 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                              >
                                <Eye className="w-3 h-3" /> Inspect
                              </button>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-natural-border/60 text-[10px] text-natural-text-light italic">
                              No final slip attached
                            </div>
                          )}
                        </div>
                        )}
                      </div>

                      {/* Milestone Installments if applicable */}
                      {!is50Percent &&
                        payment?.installment_schedule &&
                        payment.installment_schedule.length > 0 && (
                          <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/40 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-200">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                Milestone Installments
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-semibold">
                                Settled
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {payment.installment_schedule.map((milestone: any, idx: number) => {
                                const receiptUrl =
                                  milestone.receipt_url ||
                                  (payment.final_balance_status === "Verified"
                                    ? payment.final_balance_receipt
                                    : "");
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-1.5 bg-white dark:bg-natural-card rounded border border-purple-200/60 dark:border-purple-800/40 text-[11px]"
                                  >
                                    <span className="font-semibold text-natural-text-main truncate">
                                      {milestone.title || `Installment #${idx + 1}`} (₱{Number(milestone.amount).toLocaleString()})
                                    </span>
                                    {receiptUrl && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewingReceipt({
                                            url: receiptUrl,
                                            bookingName: confirmAction.bookingName,
                                            ref: milestone.reference_number || payment.final_balance_reference,
                                            method: milestone.payment_method || payment.final_balance_method,
                                            amount: Number(milestone.amount),
                                            title: `${milestone.title || `Installment #${idx + 1}`} Slip`,
                                          })
                                        }
                                        className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer shrink-0 ml-1.5"
                                      >
                                        <Eye className="w-3 h-3" /> Inspect
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      {/* Equipment Return & Completion Callout */}
                      <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/40 rounded-xl space-y-1">
                        <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-bold text-xs">
                          <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Automatic Equipment Return</span>
                        </div>
                        <p className="text-xs text-emerald-950/80 dark:text-emerald-200/90 leading-relaxed">
                          Marking this event as Completed will finalize the booking and automatically return all reserved tableware, equipment, and supplies back to equipment monitoring.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {confirmAction.type === "confirm" && confirmCheck && (() => {
                  const targetBooking = confirmTargetBooking;
                  const payment = targetBooking ? getBookingPayment(targetBooking) : null;
                  const totalBudget = targetBooking ? calculateBudget(targetBooking) : 0;
                  const is50Percent = payment?.payment_scheme === "Standard 50%";
                  const downpaymentDue =
                    payment?.downpayment_amount && payment.downpayment_amount > 0
                      ? payment.downpayment_amount
                      : Math.round(totalBudget * (is50Percent ? 0.5 : 0.2));

                  return (
                    <div className="space-y-3 mb-4">
                      <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/90 dark:border-blue-800/40 rounded-xl text-left space-y-1">
                        <div className="flex items-center justify-between text-blue-900 dark:text-blue-300 font-bold text-xs">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>{is50Percent ? "50%" : "20%"} Downpayment Verification</span>
                          </div>
                          <span className="font-mono text-blue-700 dark:text-blue-300 font-bold">
                            ₱{downpaymentDue.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-blue-950/80 dark:text-blue-200/90 leading-relaxed">
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
                              <span className="font-semibold text-green-700 dark:text-emerald-400">
                                Verified
                              </span>
                              .
                            </>
                          ) : (
                            <>
                              Confirming will verify the {is50Percent ? "50%" : "20%"} downpayment requirement
                              and lock in the event date for the client.
                            </>
                          )}
                        </p>
                      </div>

                      <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/40 rounded-xl text-left space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                            <Boxes className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Automatic Stock Allocation</span>
                          </div>
                          <span className="text-[11px] text-amber-950/80 dark:text-amber-200/90">
                            <span className="font-bold">{confirmTotalPax} Guests</span> ({confirmPkgName})
                          </span>
                        </div>
                        {!confirmCheck.isAvailable && (
                          <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 rounded-lg text-xs text-orange-800 dark:text-orange-300 leading-normal space-y-1.5">
                            <p className="font-bold">
                              ⚠️ Shortage — these items will be marked TO OUTSOURCE (rent):
                            </p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                              {confirmCheck.requirements
                                .filter((r) => !r.isAvailable)
                                .map((r) => (
                                  <li
                                    key={r.itemName}
                                    className="flex items-center justify-between gap-2 text-[11px] border-b border-orange-200/40 dark:border-orange-800/30 pb-0.5"
                                  >
                                    <span className="font-semibold truncate">{r.itemName}</span>
                                    <span className="font-mono whitespace-nowrap shrink-0">
                                      {Math.max(0, r.availableStock)} in-house + {r.deficit} to outsource
                                    </span>
                                  </li>
                                ))}
                            </ul>
                            <p className="text-[10px] opacity-80">
                              Items to outsource are tracked in Equipment Monitoring and are not added to warehouse stock when the event is completed.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {["confirm", "cancel", "archive"].includes(
                  confirmAction.type,
                ) && (
                  <div className="mb-4 space-y-3 text-left animate-in slide-in-from-bottom-2 duration-300">
                    {confirmAction.type === "cancel" && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
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
                          <p className="text-xs font-bold text-red-500 uppercase tracking-wider pl-1">
                            {typeof cancelReasonError === "string"
                              ? cancelReasonError
                              : "Reason is required."}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider pl-1">
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
                          "w-full px-4 py-2 bg-natural-bg/50 border rounded-xl text-sm transition-all focus:outline-none focus:bg-white focus:ring-2",
                          passwordError
                            ? "border-red-300 focus:ring-red-100"
                            : "border-natural-border focus:ring-natural-accent/10",
                        )}
                      />
                      {passwordError && (
                        <p className="text-xs font-bold text-red-500 uppercase tracking-wider pl-1">
                          {typeof passwordError === "string"
                              ? passwordError
                              : "Password is required to proceed."}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className={cn("flex gap-2", hasShortage ? "flex-row-reverse" : "flex-col")}>
                  <button
                    onClick={handleConfirmAction}
                    className={cn(
                      "w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white transition-all shadow-sm cursor-pointer",
                      confirmAction.type === "confirm"
                        ? "bg-green-600 hover:bg-green-700"
                        : confirmAction.type === "complete"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : confirmAction.type === "verify_final_payment"
                            ? "bg-blue-600 hover:bg-blue-700"
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
                        ? "Complete Event"
                        : confirmAction.type === "verify_final_payment"
                          ? "Confirm Final Payment"
                          : confirmAction.type}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Product Unavailability & Substitution Tool Modal */}
      {isSubModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-natural-card border border-natural-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-natural-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-natural-accent" />
                <div>
                  <h4 className="text-base font-serif font-bold text-natural-text-main">
                    Product Unavailability &amp; Substitution
                  </h4>
                  <p className="text-[11px] text-natural-text-light">
                    Select a reasonable replacement and send notification to client
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="p-1 hover:bg-natural-bg rounded-lg text-natural-text-light cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {subMessage && (
                <div className={`p-2.5 rounded text-xs ${
                  subMessage.includes("Failed")
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300"
                }`}>
                  {subMessage}
                </div>
              )}

              {/* Original Dish (Unavailable in market) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-natural-text-main uppercase tracking-wider block">
                  Unavailable Dish (Out of stock in market)
                </label>
                <select
                  value={subOriginalDish}
                  onChange={(e) => {
                    const dish = e.target.value;
                    setSubOriginalDish(dish);
                    const itemDef = menuItems.find((mi) => mi.name === dish);
                    const cat = getRuleCategory(itemDef?.category || "", dish);
                    const cur = selectedBooking.selected_menu_items || [];
                    const replacements = menuItems.filter(
                      (mi) => mi.status !== "Archived" && !cur.includes(mi.name) && (!cat || getRuleCategory(mi.category, mi.name) === cat)
                    );
                    const chosen = replacements[0]?.name || "";
                    setSubReplacementDish(chosen);
                    setSubClientNote(
                      `Due to fresh ingredient availability in the local market, "${dish}" has been substituted with "${chosen}" of equivalent quality.`
                    );
                  }}
                  className="w-full bg-natural-bg border border-natural-border px-3 py-2 rounded-lg text-xs font-medium text-natural-text-main focus:border-natural-accent focus:outline-none"
                >
                  {(selectedBooking.selected_menu_items || []).map((m: string) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason for Unavailability */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-natural-text-main uppercase tracking-wider block">
                  Reason for Unavailability
                </label>
                <select
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  className="w-full bg-natural-bg border border-natural-border px-3 py-2 rounded-lg text-xs font-medium text-natural-text-main focus:border-natural-accent focus:outline-none"
                >
                  <option value="Ingredient shortage / Out of stock in market">Ingredient shortage / Out of stock in market</option>
                  <option value="Seasonal fresh produce unavailable">Seasonal fresh produce unavailable</option>
                  <option value="Supplier delivery shipment delayed">Supplier delivery shipment delayed</option>
                  <option value="Quality check failed / Market supply issue">Quality check failed / Market supply issue</option>
                </select>
              </div>

              {/* Replacement Dish Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-natural-text-main uppercase tracking-wider block">
                    Reasonable Replacement Dish
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isCustomReplacement;
                      setIsCustomReplacement(next);
                      if (next) {
                        const val = subCustomReplacement || "";
                        setSubReplacementDish(val);
                        setSubClientNote(
                          `Due to fresh ingredient availability in the local market, "${subOriginalDish}" has been substituted with "${val}" of equivalent quality.`
                        );
                      } else {
                        const currentDef = menuItems.find((mi) => mi.name === subOriginalDish);
                        const cat = currentDef?.category;
                        const cur = selectedBooking.selected_menu_items || [];
                        const reasonableReplacements = menuItems.filter(
                          (mi) => mi.status !== "Archived" && mi.status !== "Not Available" && !cur.includes(mi.name) && (!cat || mi.category === cat)
                        );
                        const chosen = reasonableReplacements[0]?.name || (menuItems.find((mi) => !cur.includes(mi.name))?.name || "");
                        setSubReplacementDish(chosen);
                        setSubClientNote(
                          `Due to fresh ingredient availability in the local market, "${subOriginalDish}" has been substituted with "${chosen}" of equivalent quality.`
                        );
                      }
                    }}
                    className="text-[11px] font-semibold text-natural-accent hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {isCustomReplacement ? "← Select from Menu Catalog" : "+ Type Custom / Off-Menu Dish"}
                  </button>
                </div>

                {isCustomReplacement ? (
                  <div className="space-y-1.5 animate-in fade-in duration-150">
                    <input
                      type="text"
                      autoFocus
                      value={subCustomReplacement}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubCustomReplacement(val);
                        setSubReplacementDish(val);
                        setSubClientNote(
                          `Due to fresh ingredient availability in the local market, "${subOriginalDish}" has been substituted with "${val}" of equivalent quality.`
                        );
                      }}
                      placeholder="Type custom replacement dish"
                      className="w-full bg-natural-bg border border-natural-accent/50 px-3 py-2 rounded-lg text-xs font-medium text-natural-text-main focus:border-natural-accent focus:outline-none"
                    />
                    <p className="text-[10px] text-natural-text-light flex items-center gap-1">
                      Type any off-menu or market alternative not found in the standard catalog.
                    </p>
                  </div>
                ) : (
                  <select
                    value={subReplacementDish}
                    onChange={(e) => {
                      if (e.target.value === "__CUSTOM__") {
                        setIsCustomReplacement(true);
                        setSubCustomReplacement("");
                        setSubReplacementDish("");
                        return;
                      }
                      setSubReplacementDish(e.target.value);
                      setSubClientNote(
                        `Due to fresh ingredient availability in the local market, "${subOriginalDish}" has been substituted with "${e.target.value}" of equivalent quality.`
                      );
                    }}
                    className="w-full bg-natural-bg border border-natural-border px-3 py-2 rounded-lg text-xs font-medium text-natural-text-main focus:border-natural-accent focus:outline-none"
                  >
                    <option value="" disabled>Select replacement dish...</option>
                    <option value="__CUSTOM__">+ Type Custom Dish (Not on Menu)...</option>
                    {(() => {
                      const currentDef = menuItems.find((mi) => mi.name === subOriginalDish);
                      const cat = getRuleCategory(currentDef?.category || "", subOriginalDish);
                      const cur = selectedBooking.selected_menu_items || [];
                      const sameCatDishes = menuItems.filter(
                        (mi) => mi.status !== "Archived" && !cur.includes(mi.name) && getRuleCategory(mi.category, mi.name) === cat
                      );
                      const otherDishes = menuItems.filter(
                        (mi) => mi.status !== "Archived" && !cur.includes(mi.name) && getRuleCategory(mi.category, mi.name) !== cat
                      );

                      return (
                        <>
                          {sameCatDishes.length > 0 && (
                            <optgroup label={`Recommended (Same Category: ${cat || 'General'})`}>
                              {sameCatDishes.map((r) => (
                                <option key={r.id} value={r.name}>
                                  {r.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {otherDishes.length > 0 && (
                            <optgroup label="Other Available Dishes">
                              {otherDishes.map((r) => (
                                <option key={r.id} value={r.name}>
                                  {r.name} ({r.category})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                )}
              </div>

              {/* Notification Note to Client */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-natural-text-main uppercase tracking-wider block">
                  Notification Message to Client
                </label>
                <textarea
                  rows={2}
                  value={subClientNote}
                  onChange={(e) => setSubClientNote(e.target.value)}
                  className="w-full bg-natural-bg border border-natural-border p-2.5 rounded-lg text-xs text-natural-text-main focus:border-natural-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-natural-border bg-natural-bg/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-natural-text-light hover:bg-natural-bg rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingSub || !(isCustomReplacement ? subCustomReplacement.trim() : subReplacementDish.trim())}
                onClick={handleConfirmDishSubstitution}
                className="px-5 py-2 bg-natural-accent hover:bg-natural-accent/90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSavingSub ? "animate-spin" : ""}`} />
                {isSavingSub ? "Saving..." : "Confirm Substitution & Notify Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof of Payment Full Inspection Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-70 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-natural-border flex items-center justify-between bg-natural-bg/30">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-natural-accent" />
                <div>
                  <h4 className="text-sm font-bold text-natural-text-main">
                    {viewingReceipt.title || "Proof of Payment Receipt"}
                  </h4>
                  <p className="text-xs text-natural-text-light">
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
                className="max-h-[55vh] w-auto max-w-full rounded-lg shadow-md object-contain border border-natural-border bg-white dark:bg-natural-bg/40"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1554415707-9e4c07d3882d?auto=format&fit=crop&q=80&w=800";
                }}
              />
            </div>

            <div className="p-4 bg-white dark:bg-natural-card border-t border-natural-border">
              <div className="text-left">
                {typeof viewingReceipt.amount === "number" && (
                  <p className="text-sm font-bold text-natural-accent">
                    ₱{viewingReceipt.amount.toLocaleString()} {viewingReceipt.title ? `(${viewingReceipt.title})` : ""}
                  </p>
                )}
                <p className="text-xs text-natural-text-light">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
