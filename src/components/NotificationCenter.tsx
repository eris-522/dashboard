import React from 'react';
import { Bell, X, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useBooking } from '../context/BookingContext';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onViewAllLogs?: () => void;
  onManageBooking?: () => void;
  dismissedIds?: number[];
  onDismiss?: (id: number) => void;
}

export function NotificationCenter({ isOpen, onClose, onViewAllLogs, onManageBooking, dismissedIds = [], onDismiss }: NotificationCenterProps) {
  const { bookings } = useBooking();
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setShowAll(false), 200);
    }
  }, [isOpen]);

  const allNotifications = bookings
    .filter((b) => (b.status || "Pending") !== "Archived")
    .sort((a, b) => {
      const isUnreadA = ((a.status || "Pending") === "Pending" || a.status === "Inquiry" || a.status === "Cancelled") && !dismissedIds.includes(a.id);
      const isUnreadB = ((b.status || "Pending") === "Pending" || b.status === "Inquiry" || b.status === "Cancelled") && !dismissedIds.includes(b.id);

      if (isUnreadA && !isUnreadB) return -1;
      if (!isUnreadA && isUnreadB) return 1;
      
      return typeof b.id === 'number' && typeof a.id === 'number' ? b.id - a.id : 0;
    });
  const displayBookings = showAll ? allNotifications : allNotifications.slice(0, 5);

  const pendingCount = bookings.filter((b) => {
    const status = b.status || "Pending";
    return (status === "Pending" || status === "Inquiry" || status === "Cancelled") && !dismissedIds.includes(b.id);
  }).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay to handle closing when clicking outside */}
          <div 
            className="fixed inset-0 z-40 bg-black/5" 
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 w-96 bg-white border border-natural-border rounded-xl shadow-2xl z-50 overflow-hidden glass-card"
          >
            <div className="p-4 border-b border-natural-border flex items-center justify-between bg-natural-bg/30">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-natural-text-main uppercase tracking-widest">
                  {showAll ? "All Notifications" : "Recent Notifications"}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {allNotifications.some(b => {
                  const status = b.status || "Pending";
                  return (status === "Pending" || status === "Inquiry" || status === "Cancelled") && !dismissedIds.includes(b.id);
                }) && (
                  <button 
                    onClick={() => {
                      allNotifications.forEach(b => {
                        const status = b.status || "Pending";
                        if ((status === "Pending" || status === "Inquiry" || status === "Cancelled") && !dismissedIds.includes(b.id)) {
                          if (onDismiss) onDismiss(b.id);
                        }
                      });
                    }}
                    className="text-[9px] font-bold text-natural-accent hover:underline uppercase tracking-widest"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={onClose} className="p-1 hover:bg-natural-bg rounded-lg transition-colors">
                  <X className="w-4 h-4 text-natural-text-light" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-natural-border scrollbar-none">
              {displayBookings.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell className="w-8 h-8 text-natural-text-light opacity-20 mx-auto mb-3" />
                  <p className="text-xs font-serif italic text-natural-text-light">No notifications found.</p>
                </div>
              ) : (
                displayBookings.map((booking) => {
                  const isUnreadNotif = ((booking.status || "Pending") === "Pending" || booking.status === "Inquiry" || booking.status === "Cancelled") && !dismissedIds.includes(booking.id);
                  const isExpanded = expandedId === booking.id;

                  return (
                    <div 
                      key={booking.id} 
                      className={cn(
                        "p-4 hover:bg-natural-bg/30 transition-all cursor-pointer group",
                        isUnreadNotif && (booking.status === "Cancelled" ? "bg-red-50/50" : "bg-natural-accent/5")
                      )}
                      onClick={() => {
                        setExpandedId(isExpanded ? null : booking.id);
                        if (isUnreadNotif && onDismiss) onDismiss(booking.id);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-natural-text-main flex items-center gap-2">
                            {booking.status === "Cancelled" ? "Cancelled Booking" : `${booking.eventType || "Event"} Booking`}
                            {isUnreadNotif && (
                              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", booking.status === "Cancelled" ? "bg-orange-500" : "bg-red-500")}></span>
                            )}
                          </p>
                          <p className="text-[10px] text-natural-text-light mt-0.5">
                            from {booking.customerName}
                          </p>
                          {booking.status === "Cancelled" && !isExpanded && (
                            <p className="text-[10px] text-red-800/70 mt-1 italic truncate max-w-[180px]">
                              Reason: {booking.cancellation_reason && booking.cancellation_reason.trim() !== "" ? booking.cancellation_reason : "No reason provided"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnreadNotif && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDismiss) onDismiss(booking.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-natural-text-light hover:text-green-600 hover:bg-green-50 rounded transition-all"
                              title="Mark as read"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-[9px] font-medium bg-natural-accent/10 text-natural-accent px-1.5 py-0.5 rounded">
                            {isExpanded ? "Hide" : "View"}
                          </span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-natural-border/50 animate-in slide-in-from-top-1 fade-in duration-200">
                          {booking.status === "Cancelled" && (
                            <div className="mb-3 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                              <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest mb-1">Reason for Cancellation</p>
                              <p className="text-[11px] text-red-900 italic">"{booking.cancellation_reason && booking.cancellation_reason.trim() !== "" ? booking.cancellation_reason : "No reason provided"}"</p>
                            </div>
                          )}
                          <p className="text-[11px] text-natural-text-main mb-1">
                            <span className="font-semibold text-natural-text-light">Email:</span> {booking.email || "N/A"}
                          </p>
                          <p className="text-[11px] text-natural-text-main mb-1">
                            <span className="font-semibold text-natural-text-light">Phone:</span> {booking.phone || "N/A"}
                          </p>
                          <p className="text-[11px] text-natural-text-main mb-1">
                            <span className="font-semibold text-natural-text-light">Package:</span> {booking.package || "Custom"}
                          </p>
                          <p className="text-[11px] text-natural-text-main mb-3">
                            <span className="font-semibold text-natural-text-light">Date:</span> {booking.date}
                          </p>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onManageBooking) onManageBooking();
                              onClose();
                            }}
                            className="text-[10px] font-bold bg-natural-accent text-white px-3 py-1.5 rounded w-full hover:bg-natural-accent/90 transition-colors shadow-sm"
                          >
                            Manage Booking
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-natural-bg/50 border-t border-natural-border text-center">
              {!showAll && allNotifications.length > 5 ? (
                <button 
                  onClick={() => setShowAll(true)}
                  className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-accent transition-colors"
                >
                  View All Notifications
                </button>
              ) : (
                <button 
                  onClick={() => {
                    if (onManageBooking) onManageBooking();
                    onClose();
                  }}
                  className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-accent transition-colors"
                >
                  Manage Bookings
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
