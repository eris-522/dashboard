import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { supabase } from "../utils/supabase";

export interface MenuSelection {
  appetizers: string[];
  mainCourse: string[];
  desserts: string[];
  beverages: string[];
}

export interface Booking {
  id: number;
  customerName: string;
  email: string;
  phone: string;
  eventType: string;
  package: string;
  date: string;
  time: string;
  guestCount: number;
  additionalPax?: number;
  venueName: string;
  venueAddress: string;
  menu: MenuSelection;
  additionalServices: string[];
  foodAllergies?: string;
  budget: number;
  status:
    | "Confirmed"
    | "Pending"
    | "Inquiry"
    | "Cancelled"
    | "Completed"
    | "Rejected"
    | "Archived";
  cancellation_reason?: string;
  downpayment_amount?: number;
  payment_method?: string;
  payment_status?: string;
  receipt_url?: string;
  reference_number?: string;
  terms_accepted?: boolean;
  payment_scheme?: string;
  final_balance_amount?: number;
  final_balance_status?: string;
  final_balance_method?: string;
  final_balance_reference?: string;
  final_balance_receipt?: string;
  installment_schedule?: any;
  inclusions?: any[];
  selected_menu_items?: string[];
  logistics_info?: any;
  corkage_info?: any;
  dish_substitutions?: any[];
  modification_requests?: any[];
  cancelled_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardMetrics {
  status_counts: {
    confirmed_completed: number;
    pending: number;
    cancelled: number;
    archived: number;
    total: number;
  };
  active_customer_count: number;
  low_stock_count: number;
  available_years: number[];
  monthly_series: Array<{
    year: number;
    month_idx: number;
    revenue: number;
    events: number;
    guests: number;
  }>;
  package_by_year: Array<{
    year: number;
    name: string;
    count: number;
    revenue: number;
  }>;
  event_type_by_year: Array<{
    year: number;
    type: string;
    count: number;
    revenue: number;
  }>;
}

const splitVenueLocation = (rawLocation?: string | null): { venueName: string; venueAddress: string } => {
  const clean = String(rawLocation || "").trim();
  if (!clean) return { venueName: "", venueAddress: "" };
  const sepIdx = clean.indexOf(" - ");
  if (sepIdx === -1) return { venueName: clean, venueAddress: "" };
  return {
    venueName: clean.slice(0, sepIdx).trim(),
    venueAddress: clean.slice(sepIdx + 3).trim(),
  };
};

interface BookingContextType {
  bookings: Booking[];
  dashboardMetrics: DashboardMetrics | null;
  isLoading: boolean;
  error: string | null;
  addBooking: (booking: Omit<Booking, "id">) => void;
  updateBookingStatus: (id: number, status: Booking["status"]) => void;
  removeBooking: (id: number) => void;
  refreshBookings: (silent?: boolean) => Promise<void>;
}

export const BookingContext = createContext<BookingContextType | undefined>(undefined);

const initialBookings: Booking[] = [];

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards against out-of-order responses and throttles tab-focus storms
  const latestRequestRef = React.useRef(0);
  const lastFetchTimeRef = React.useRef(0);

  // Fetch bookings on mount and set up real-time listener
  useEffect(() => {
    const FOCUS_COOLDOWN_MS = 60_000;
    let realtimeDebounce: ReturnType<typeof setTimeout> | null = null;
    let hasSubscribedOnce = false;

    refreshBookings();

    // Cross-component event listener for immediate local admin synchronization
    const handleSync = () => refreshBookings(true);
    window.addEventListener("bookingsUpdated", handleSync);

    // Throttled refresh when the admin returns to the tab/window (60s cooldown)
    const handleVisibilityOrFocus = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastFetchTimeRef.current >= FOCUS_COOLDOWN_MS
      ) {
        refreshBookings(true);
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    let realtimeHealthy = false;
    const channel = supabase
      .channel(`bookings-channel-context-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload: any) => {
          if (payload.eventType === "DELETE" && payload.old?.id) {
            setBookings((prev) => prev.filter((b) => String(b.id) !== String(payload.old.id)));
          }
          if (realtimeDebounce) clearTimeout(realtimeDebounce);
          realtimeDebounce = setTimeout(() => {
            refreshBookings(true);
            window.dispatchEvent(new CustomEvent("bookingsRealtimeSync"));
          }, 250);
        },
      )
      .subscribe((status: string, err?: Error) => {
        realtimeHealthy = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          // Only re-sync on reconnection (initial mount already called refreshBookings above)
          if (hasSubscribedOnce) {
            refreshBookings(true);
          }
          hasSubscribedOnce = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[Bookings] Realtime ${status}. Falling back to 60s heartbeat.`, err);
        }
      });

    // Fallback polling ONLY when Realtime WebSocket is disconnected
    const pollId = window.setInterval(() => {
      if (!realtimeHealthy && document.visibilityState === "visible") {
        refreshBookings(true);
      }
    }, 60_000);

    // Cleanup subscription on unmount
    return () => {
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      window.removeEventListener("bookingsUpdated", handleSync);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, []);

  /**
   * Fetches active bookings (bounded) + aggregate dashboard metrics RPC in parallel.
   */
  const refreshBookings = async (silent = false) => {
    const requestId = ++latestRequestRef.current;
    lastFetchTimeRef.current = Date.now();
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      const [{ data: bData, error: bError }, metricsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            `
            id, user_id, package_id, event_date, event_time, event_location, event_type,
            guest_count, additional_pax, selected_menu_items, selected_add_ons, status,
            cancellation_reason, cancelled_by, food_allergies, payment_method, downpayment_amount,
            payment_status, receipt_url, reference_number, terms_accepted, payment_scheme,
            final_balance_amount, final_balance_status, final_balance_method,
            final_balance_reference, final_balance_receipt, installment_schedule,
            logistics_info, corkage_info, overtime_info, dish_substitutions,
            modification_requests, created_at,
            profiles (id, name, email, phone_number, status),
            packages (id, name, type, price, pax, additional_pax_price, inclusions, category_limits)
          `,
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.rpc("get_admin_dashboard_metrics"),
      ]);

      // A newer refresh has been started; discard this stale result
      if (requestId !== latestRequestRef.current) return;

      if (!metricsRes.error && metricsRes.data) {
        setDashboardMetrics(metricsRes.data as DashboardMetrics);
      }

      if (bError) {
        setError(`Error fetching bookings: ${bError.message}`);
        console.error("Error fetching bookings:", bError.message);
      } else {
        // Transform database rows to Booking interface
        const transformedBookings = (bData || []).map((booking: any) => {
          let paymentMethod = booking.payment_method || "";
          let downpaymentAmount = Number(booking.downpayment_amount) || 0;
          let paymentStatus = booking.payment_status || "Pending Verification";
          let receiptUrl = booking.receipt_url || "";
          let referenceNumber = booking.reference_number || "";
          let termsAccepted = Boolean(booking.terms_accepted);
          let paymentScheme = booking.payment_scheme || "";
          let finalBalanceAmount = Number(booking.final_balance_amount) || 0;
          let finalBalanceStatus = booking.final_balance_status || "Unpaid";
          let finalBalanceMethod = booking.final_balance_method || "";
          let finalBalanceReference = booking.final_balance_reference || "";
          let finalBalanceReceipt = booking.final_balance_receipt || "";
          let installmentSchedule = booking.installment_schedule || null;
          let logisticsInfo = booking.logistics_info || null;
          let embeddedOvertime: any = null;

          // Fallback extraction if embedded in food_allergies
          if (typeof booking.food_allergies === "string" && booking.food_allergies.includes("__PAYMENT_METADATA__:")) {
            try {
              const raw = booking.food_allergies.split("__PAYMENT_METADATA__:")[1];
              const parsed = JSON.parse(raw);
              if (!paymentMethod) paymentMethod = parsed.method || "";
              if (!downpaymentAmount) downpaymentAmount = Number(parsed.downpayment) || 0;
              if (!paymentStatus || paymentStatus === "Pending Verification") paymentStatus = parsed.status || "Pending Verification";
              if (!receiptUrl) receiptUrl = parsed.receipt || "";
              if (!referenceNumber) referenceNumber = parsed.ref || "";
              if (!termsAccepted) termsAccepted = Boolean(parsed.termsAccepted);
              if (!paymentScheme) paymentScheme = parsed.scheme || "";
              if (!finalBalanceAmount) finalBalanceAmount = Number(parsed.balance) || 0;
              if (!finalBalanceStatus || finalBalanceStatus === "Unpaid") finalBalanceStatus = parsed.finalBalanceStatus || "Unpaid";
              if (!finalBalanceMethod) finalBalanceMethod = parsed.finalBalanceMethod || "";
              if (!finalBalanceReference) finalBalanceReference = parsed.finalBalanceRef || "";
              if (!finalBalanceReceipt) finalBalanceReceipt = parsed.finalBalanceReceipt || "";
              if (!installmentSchedule) installmentSchedule = parsed.installments || null;
              if ((!logisticsInfo || Object.keys(logisticsInfo).length === 0) && parsed.logistics) {
                logisticsInfo = parsed.logistics;
              }
              if (parsed.overtime) {
                embeddedOvertime = parsed.overtime;
              }
            } catch (e) {}
          }

          // Clean food allergies string if fallback was used
          const cleanFoodAllergies = typeof booking.food_allergies === "string" && booking.food_allergies.includes("__PAYMENT_METADATA__:")
            ? booking.food_allergies.split("__PAYMENT_METADATA__:")[0].trim()
            : (booking.food_allergies || "");

          const { venueName, venueAddress } = splitVenueLocation(booking.event_location);

          return {
            id: booking.id,
            customerName:
              booking.profiles?.name ||
              booking.profiles?.full_name ||
              "Unknown User",
            email: booking.profiles?.email || "",
            phone:
              booking.profiles?.phone_number || booking.profiles?.phone || "",
            eventType: booking.event_type || booking.packages?.type || "",
            package: booking.packages?.name || "",
            inclusions: Array.isArray(booking.packages?.inclusions) ? booking.packages.inclusions : [],
            date: booking.event_date || "",
            time: booking.event_time || "",
            guestCount: booking.guest_count || 0,
            additionalPax: booking.additional_pax || 0,
            venueName,
            venueAddress,
            menu: booking.selected_menu_items || [],
            selected_menu_items: booking.selected_menu_items || [],
            additionalServices: booking.selected_add_ons || [],
            foodAllergies: cleanFoodAllergies,
            logistics_info: logisticsInfo,
            corkage_info: booking.corkage_info || logisticsInfo?.corkage || null,
            overtime_info: booking.overtime_info || embeddedOvertime || null,
            dish_substitutions: Array.isArray(booking.dish_substitutions) ? booking.dish_substitutions : [],
            modification_requests: Array.isArray(booking.modification_requests) ? booking.modification_requests : [],
            cancelled_by: booking.cancelled_by || "",
            budget: (() => {
              const basePrice =
                parseFloat(
                  String(booking.packages?.price || "0").replace(
                    /[^0-9.-]+/g,
                    "",
                  ),
                ) || 0;
              const addPrice =
                parseFloat(
                  String(booking.packages?.additional_pax_price || "0").replace(
                    /[^0-9.-]+/g,
                    "",
                  ),
                ) || 0;
              const extraPax = Number(booking.additional_pax) || 0;
              const travelFee = Number(logisticsInfo?.travelFee) || 0;
              const haulingFee = Number(logisticsInfo?.haulingFee) || 0;
              const rainLaundryFee =
                Number(logisticsInfo?.rainLaundryFee) ||
                (logisticsInfo?.rainLaundryApplied ? 2000 : 0);
              const corkageObj = booking.corkage_info || logisticsInfo?.corkage || null;
              const corkageFee =
                Number(corkageObj?.totalCorkageFee) ||
                ((corkageObj?.hasLechonTable ? 1500 : 0) +
                  Number(corkageObj?.alcoholicBeveragesCount || 0) * 400 +
                  Number(corkageObj?.outsideFoodCount || 0) * 400) ||
                0;
              let otData = booking.overtime_info || embeddedOvertime;
              if (typeof otData === "string") {
                try {
                  otData = JSON.parse(otData);
                } catch (e) {}
              }
              const prebookedOTFee = Number(otData?.prebooked?.total_prebooked_fee) || 0;
              const dayOfOTFee = Number(otData?.day_of?.total_day_of_fee) || 0;
              const totalOTFee = Number(otData?.total_overtime_fee) || (prebookedOTFee + dayOfOTFee);
              const excessFee =
                Number(
                  logisticsInfo?.post_event_billing?.excess_guest_fee ??
                    logisticsInfo?.post_event_billing?.excess_fee
                ) || 0;
              const damageFee = Number(logisticsInfo?.damage_appraisal?.total_damage_fee) || 0;

              return (
                basePrice +
                addPrice * extraPax +
                travelFee +
                haulingFee +
                rainLaundryFee +
                corkageFee +
                totalOTFee +
                excessFee +
                damageFee
              );
            })(),
            status: booking.status || "Pending",
            downpayment_amount: downpaymentAmount,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            receipt_url: receiptUrl,
            reference_number: referenceNumber,
            terms_accepted: termsAccepted,
            payment_scheme: paymentScheme,
            final_balance_amount: finalBalanceAmount,
            final_balance_status: finalBalanceStatus,
            final_balance_method: finalBalanceMethod,
            final_balance_reference: finalBalanceReference,
            final_balance_receipt: finalBalanceReceipt,
            installment_schedule: installmentSchedule,
            cancellation_reason:
              booking.cancellation_reason ||
              booking.cancel_reason ||
              booking.reason ||
              "",
            created_at: booking.created_at,
          };
        });
        setBookings(transformedBookings);
        setError(null);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      console.error("Unexpected error in refreshBookings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Adds a new booking to the state with a generated unique ID.
   * @param newBooking The booking data without an ID.
   */
  const addBooking = (newBooking: Omit<Booking, "id">) => {
    const booking: Booking = {
      ...newBooking,
      id: Date.now(),
    };
    setBookings((prev) => [...prev, booking]);
  };

  /**
   * Updates the status of an existing booking.
   * @param id The unique identifier of the booking.
   * @param status The new status to apply.
   */
  const updateBookingStatus = (id: number, status: Booking["status"]) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b)),
    );
  };

  /**
   * Permanently deletes a booking from the state.
   * @param id The unique identifier of the booking to remove.
   */
  const removeBooking = (id: number) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <BookingContext.Provider
      value={{
        bookings,
        dashboardMetrics,
        isLoading,
        error,
        addBooking,
        updateBookingStatus,
        removeBooking,
        refreshBookings,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}
