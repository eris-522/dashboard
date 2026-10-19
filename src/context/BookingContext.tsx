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
  created_at?: string;
  updated_at?: string;
}

interface BookingContextType {
  bookings: Booking[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch bookings on mount and set up real-time listener
  useEffect(() => {
    refreshBookings();

    // Cross-component event listener for immediate synchronization
    const handleSync = () => refreshBookings(true);
    window.addEventListener("bookingsUpdated", handleSync);

    // Refresh immediately when the admin returns to the tab/window
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshBookings(true);
    };
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleVisibility);

    // Subscribe to real-time changes on the bookings table.
    // A unique channel name per mount prevents the React StrictMode
    // unmount/remount race where a re-created channel with the same topic
    // gets torn down by the pending removeChannel() and silently stops
    // receiving events.
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
          refreshBookings(true); // Refresh data silently only when a booking actually changes
        },
      )
      .subscribe((status: string, err?: Error) => {
        realtimeHealthy = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          // Catch anything that changed while we were connecting
          refreshBookings(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[Bookings] Realtime ${status}. Falling back to polling.`, err);
        }
      });

    // Fallback polling: fast when realtime is down, slow safety net otherwise
    let tick = 0;
    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      tick++;
      if (!realtimeHealthy || tick % 6 === 0) refreshBookings(true);
    }, 5000);

    // Cleanup subscription on unmount
    return () => {
      window.removeEventListener("bookingsUpdated", handleSync);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, []);

  // Guards against out-of-order responses overwriting newer data
  const latestRequestRef = React.useRef(0);

  /**
   * Fetches all active bookings from Supabase with lightweight joined fields
   */
  const refreshBookings = async (silent = false) => {
    const requestId = ++latestRequestRef.current;
    try {
      if (!silent) setIsLoading(true);
      setError(null);

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

      // A newer refresh has been started; discard this stale result
      if (requestId !== latestRequestRef.current) return;

      if (bError) {
        setError(`Error fetching bookings: ${bError.message}`);
        console.error("Error fetching bookings:", bError.message);
        setBookings([]);
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
            } catch (e) {}
          }

          // Clean food allergies string if fallback was used
          const cleanFoodAllergies = typeof booking.food_allergies === "string" && booking.food_allergies.includes("__PAYMENT_METADATA__:")
            ? booking.food_allergies.split("__PAYMENT_METADATA__:")[0].trim()
            : (booking.food_allergies || "");

          return {
            id: booking.id,
            customerName:
              booking.profiles?.name ||
              booking.profiles?.full_name ||
              "Unknown User",
            email: booking.profiles?.email || "",
            phone:
              booking.profiles?.phone_number || booking.profiles?.phone || "",
            eventType: booking.event_type || "",
            package: booking.packages?.name || "",
            date: booking.event_date || "",
            time: booking.event_time || "",
            guestCount: booking.guest_count || 0,
            additionalPax: booking.additional_pax || 0,
            venueName: booking.event_location?.split(" - ")[0] || "",
            venueAddress: booking.event_location?.split(" - ")[1] || "",
            menu: booking.selected_menu_items || [],
            additionalServices: booking.selected_add_ons || [],
            foodAllergies: cleanFoodAllergies,
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
              const extraPax = booking.additional_pax || 0;
              return basePrice + addPrice * extraPax;
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
            updated_at: booking.updated_at,
          };
        });
        setBookings(transformedBookings);
        setError(null);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      console.error("Unexpected error in refreshBookings:", err);
      setBookings([]);
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
