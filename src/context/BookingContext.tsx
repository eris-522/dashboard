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

const BookingContext = createContext<BookingContextType | undefined>(undefined);

const initialBookings: Booking[] = [];

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch bookings on mount and set up real-time listener
  useEffect(() => {
    refreshBookings();

    // Fallback polling: Refresh bookings silently every 10 seconds
    // in case real-time WebSockets fail or drop.
    const intervalId = setInterval(() => refreshBookings(true), 10000);

    // Subscribe to real-time changes on the bookings table
    const channel = supabase
      .channel("bookings-channel-context")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          console.log("Booking change detected in context:", payload);
          refreshBookings(true); // Refresh data silently when any booking changes
        },
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

  /**
   * Fetches all active bookings from Supabase
   */
  const refreshBookings = async (silent = false) => {
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
