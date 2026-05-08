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
} from "lucide-react";
import { cn } from "../lib/utils";
import { EventCalendar } from "../components/EventCalendar";
import { supabase } from "../utils/supabase";

type SortField = "customerName" | "date" | "budget" | "status" | null;
type SortOrder = "asc" | "desc" | null;

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export function BookingPage() {
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "confirm" | "reject" | "archive" | "create";
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
    venueName: "",
    venueAddress: "",
    selected_menu_items: [] as string[],
    selected_add_ons: [] as string[],
  });

  useEffect(() => {
    setConfirmPassword("");
    setPasswordError(false);
  }, [confirmAction]);

  useEffect(() => {
    // Fetch initial data
    fetchAllData();

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
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
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
          profiles (name, email),
          packages (name, price)
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
      }

      const [pRes, pkgRes, menuRes, srvRes] = await Promise.all([
        supabase.from("profiles").select("*").neq("status", "Archived"),
        supabase.from("packages").select("*").neq("status", "Archived"),
        supabase.from("menu_items").select("*").neq("status", "Archived"),
        supabase.from("add_ons").select("*").neq("status", "Archived"),
      ]);

      if (pRes.error) console.error("Error fetching profiles:", pRes.error.message);
      else if (pRes.data) setCustomers(pRes.data);

      if (pkgRes.error) console.error("Error fetching packages:", pkgRes.error.message);
      else if (pkgRes.data) setPackages(pkgRes.data);

      if (menuRes.error) console.error("Error fetching menu items:", menuRes.error.message);
      else if (menuRes.data) setMenuItems(menuRes.data);

      if (srvRes.error) console.error("Error fetching add-ons:", srvRes.error.message);
      else if (srvRes.data) setAdditionalServices(srvRes.data);
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
    const pkgPriceString =
      booking.packages?.price ||
      packages.find((p) => p.id === booking.package_id)?.price;

    if (pkgPriceString) {
      basePrice =
        parseFloat(String(pkgPriceString).replace(/[^\d.]/g, "")) *
        (booking.guest_count || 0);
    }

    const servicesPrice = (booking.selected_add_ons || []).reduce(
      (acc: number, name: string) => {
        const service = additionalServices.find((s) => s.name === name);
        return acc + (service ? parseFloat(String(service.price)) : 0);
      },
      0,
    );

    return basePrice + servicesPrice;
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const customerName = booking.profiles?.name || "Unknown User";
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        customerName.toLowerCase().includes(query) ||
        (booking.event_type || "").toLowerCase().includes(query) ||
        (booking.event_location || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All Status"
          ? booking.status !== "Archived"
          : booking.status === statusFilter;


      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, bookings]);

  const sortedBookings = useMemo(() => {
    if (!sortConfig.field || !sortConfig.order) return filteredBookings;

    return [...filteredBookings].sort((a, b) => {
      const { field, order } = sortConfig;
      let valA: any =
        field === "customerName" ? a.profiles?.name : field ? a[field] : "";
      let valB: any =
        field === "customerName" ? b.profiles?.name : field ? b[field] : "";

      if (field === "budget") {
        valA = calculateBudget(a);
        valB = calculateBudget(b);
      } else if (field === "date") {
        valA = new Date(a.event_date || 0).getTime();
        valB = new Date(b.event_date || 0).getTime();
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
      venueName: "",
      venueAddress: "",
      selected_menu_items: [],
      selected_add_ons: [],
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, bookingId } = confirmAction;

    if (["confirm", "reject", "archive"].includes(type) && !confirmPassword) {
      setPasswordError(true);
      return;
    }

    if (type === "confirm" && bookingId) {
      await supabase
        .from("bookings")
        .update({ status: "Confirmed" })
        .eq("id", bookingId);
    } else if (type === "reject" && bookingId) {
      await supabase
        .from("bookings")
        .update({ status: "Rejected" })
        .eq("id", bookingId);
    } else if (type === "archive" && bookingId) {
      await supabase
        .from("bookings")
        .update({ status: "Archived" })
        .eq("id", bookingId);
    } else if (type === "create") {
      await supabase.from("bookings").insert([
        {
          user_id: newBooking.user_id,
          package_id: newBooking.package_id,
          event_type: newBooking.event_type,
          event_date: newBooking.date,
          event_time: newBooking.time,
          event_location: `${newBooking.venueName} - ${newBooking.venueAddress}`,
          guest_count: newBooking.guest_count,
          selected_menu_items: newBooking.selected_menu_items,
          selected_add_ons: newBooking.selected_add_ons,
          status: "Confirmed",
        },
      ]);
    }

    await fetchAllData();
    setConfirmAction(null);
    setSelectedBooking(null);
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Bookings",
            value: bookings.filter((b) => b.status !== "Archived").length.toString(),
            sub: "Active",
          },
          {
            label: "Confirmed",
            value: bookings
              .filter((b) => b.status === "Confirmed")
              .length.toString(),
            sub: "Paid/Ready",
          },
          {
            label: "Pending",
            value: bookings
              .filter((b) => b.status === "Pending")
              .length.toString(),
            sub: "Needs Review",
          },
          {
            label: "Est. Revenue",
            value: `₱${(bookings.reduce((acc, b) => acc + calculateBudget(b), 0) / 1000).toFixed(0)}k`,
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
              <option>Pending</option>
              <option>Rejected</option>
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
                    Status
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
                          {booking.profiles?.name || "Unknown User"}
                        </p>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <p className="text-[10px] text-natural-text-light flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5" />{" "}
                            {booking.profiles?.email || "N/A"}
                          </p>
                          <p className="text-[10px] text-natural-text-light flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />{" "}
                            {booking.profiles?.phone || "N/A"}
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
                          {booking.event_date}
                        </p>
                        <p className="text-[10px] text-natural-text-light flex items-center gap-2">
                          <Clock className="w-3 h-3" /> {booking.event_time}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <p className="text-xs font-bold text-natural-text-main">
                        ₱{calculateBudget(booking).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-natural-text-light uppercase font-bold">
                        {booking.guest_count} Pax
                      </p>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <span
                        className={cn(
                          "text-[0.6rem] font-bold uppercase tracking-widest px-2 py-1 rounded border",
                          booking.status === "Confirmed"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : booking.status === "Pending"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : booking.status === "Rejected"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : booking.status === "Archived"
                                  ? "bg-gray-100 text-gray-600 border-gray-300"
                                  : "bg-gray-50 text-gray-700 border-gray-200",
                        )}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-b border-natural-border/50">
                      <div className="flex items-center gap-2">
                        {booking.status !== "Archived" && (
                          <>
                            {(booking.status === "Inquiry" ||
                              booking.status === "Pending") && (
                              <>
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "confirm",
                                      bookingId: booking.id,
                                      bookingName: booking.profiles?.name,
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
                                      type: "reject",
                                      bookingId: booking.id,
                                      bookingName: booking.profiles?.name,
                                    })
                                  }
                                  className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                  title="Reject Booking"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
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
                                  bookingName: booking.profiles?.name,
                                })
                              }
                              className="p-1.5 text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50 rounded-lg transition-all"
                              title="Archive Booking"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {booking.status === "Archived" && (
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
                bookings={bookings.filter((b) => b.status === "Confirmed")}
              />
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between bg-natural-bg/20">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    {menuItems.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 p-2 hover:bg-natural-bg/50 rounded-lg transition-colors cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-natural-border text-natural-accent focus:ring-natural-accent/20"
                          checked={newBooking.selected_menu_items.includes(
                            item.name,
                          )}
                          onChange={(e) => {
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
                        <span className="text-xs font-medium text-natural-text-main group-hover:text-natural-accent transition-colors">
                          {item.name}{" "}
                          <span className="text-[9px] text-gray-400">
                            ({item.category})
                          </span>
                        </span>
                      </label>
                    ))}
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

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex items-center justify-end gap-4">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
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

            <div className="p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-2xl font-serif font-bold text-natural-text-main">
                    {selectedBooking.profiles?.name}
                  </h4>
                  <p className="text-sm font-medium text-natural-text-light">
                    {selectedBooking.event_type} •{" "}
                    {selectedBooking.packages?.name} Package
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[0.6rem] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border",
                    selectedBooking.status === "Confirmed"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : selectedBooking.status === "Rejected"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : selectedBooking.status === "Archived"
                          ? "bg-gray-100 text-gray-600 border-gray-300"
                          : "bg-orange-50 text-orange-700 border-orange-200",
                  )}
                >
                  {selectedBooking.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-8 py-6 border-y border-natural-border/50">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-natural-accent" />
                    <div>
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mb-0.5">
                        Date & Time
                      </p>
                      <p className="text-sm font-semibold text-natural-text-main">
                        {selectedBooking.event_date} at{" "}
                        {selectedBooking.event_time}
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
                    <CreditCard className="w-4 h-4 text-natural-accent" />
                    <div>
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mb-0.5">
                        Total Budget
                      </p>
                      <p className="text-lg font-bold text-natural-text-main font-serif italic">
                        ₱{calculateBudget(selectedBooking).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-natural-text-light font-bold">
                        FOR {selectedBooking.guest_count} GUESTS
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-natural-accent" />
                    <div>
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mb-0.5">
                        Contact
                      </p>
                      <p className="text-sm font-semibold text-natural-text-main">
                        {selectedBooking.profiles?.phone}
                      </p>
                      <p className="text-xs text-natural-text-light mt-0.5">
                        {selectedBooking.profiles?.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-[0.65rem] font-bold text-natural-accent uppercase tracking-widest">
                  Menu Selection
                </h5>
                <div className="flex flex-wrap gap-2">
                  {selectedBooking.selected_menu_items &&
                  selectedBooking.selected_menu_items.length > 0 ? (
                    selectedBooking.selected_menu_items.map((m: string) => (
                      <span
                        key={m}
                        className="px-2 py-1 bg-natural-bg border border-natural-border rounded text-[9px] font-bold text-natural-text-main uppercase tracking-tighter"
                      >
                        {m}
                      </span>
                    ))
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
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              {selectedBooking.status === "Pending" && (
                <>
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: "confirm",
                        bookingId: selectedBooking.id,
                        bookingName: selectedBooking.profiles?.name,
                      })
                    }
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-sm"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: "reject",
                        bookingId: selectedBooking.id,
                        bookingName: selectedBooking.profiles?.name,
                      })
                    }
                    className="flex-1 border border-orange-200 text-orange-600 bg-orange-50/50 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-50 transition-all"
                  >
                    Reject
                  </button>
                </>
              )}
              {selectedBooking.status !== "Pending" && (
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                  confirmAction.type === "confirm"
                    ? "bg-green-100"
                    : confirmAction.type === "reject"
                      ? "bg-orange-100"
                      : confirmAction.type === "archive"
                        ? "bg-gray-100"
                        : "bg-blue-100",
                )}
              >
                {confirmAction.type === "confirm" && (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                )}
                {confirmAction.type === "reject" && (
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
                {confirmAction.type} Booking?
              </h3>
              <p className="text-sm text-natural-text-light mb-6">
                {confirmAction.type === "create"
                  ? `Are you sure you want to create a new booking for ${confirmAction.bookingName}?`
                  : `Are you sure you want to ${confirmAction.type} the booking for ${confirmAction.bookingName}?`}
              </p>

              {["confirm", "reject", "archive"].includes(
                confirmAction.type,
              ) && (
                <div className="mb-6 space-y-2 text-left animate-in slide-in-from-bottom-2 duration-300">
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
                      Password is required to proceed.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConfirmAction}
                  className={cn(
                    "w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white transition-all shadow-sm",
                    confirmAction.type === "confirm"
                      ? "bg-green-600 hover:bg-green-700"
                      : confirmAction.type === "reject"
                        ? "bg-orange-600 hover:bg-orange-700"
                        : confirmAction.type === "archive"
                          ? "bg-gray-600 hover:bg-gray-700"
                          : "bg-blue-600 hover:bg-blue-700",
                  )}
                >
                  Yes,{" "}
                  {confirmAction.type === "create"
                    ? "Create"
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
    </div>
  );
}
