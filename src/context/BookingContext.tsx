import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
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
  venueName: string;
  venueAddress: string;
  menu: MenuSelection;
  additionalServices: string[];
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
        const transformedBookings = (bData || []).map((booking: any) => ({
          id: booking.id,
          customerName: booking.profiles?.name || booking.profiles?.full_name || "Unknown User",
          email: booking.profiles?.email || "",
          phone: booking.profiles?.phone_number || booking.profiles?.phone || "",
          eventType: booking.event_type || "",
          package: booking.packages?.name || "",
          date: booking.event_date || "",
          time: booking.event_time || "",
          guestCount: booking.guest_count || 0,
          venueName: booking.event_location?.split(" - ")[0] || "",
          venueAddress: booking.event_location?.split(" - ")[1] || "",
          menu: booking.selected_menu_items || [],
          additionalServices: booking.selected_add_ons || [],
          budget: 0, // Will be calculated by components if needed
          status: booking.status || "Pending",
          cancellation_reason: booking.cancellation_reason || booking.cancel_reason || booking.reason || "",
          created_at: booking.created_at,
          updated_at: booking.updated_at,
        }));
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
      value={{ bookings, isLoading, error, addBooking, updateBookingStatus, removeBooking, refreshBookings }}
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
