import React, { createContext, useContext, useState, ReactNode } from "react";

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
}

interface BookingContextType {
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, "id">) => void;
  updateBookingStatus: (id: number, status: Booking["status"]) => void;
  removeBooking: (id: number) => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

const initialBookings: Booking[] = [];

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);

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
      value={{ bookings, addBooking, updateBookingStatus, removeBooking }}
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
