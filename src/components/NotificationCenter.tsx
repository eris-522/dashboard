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

  const recentBookings = bookings
    .filter((b) => (b.status || "Pending") !== "Archived")
    .slice(0, 5);

  const pendingCount = bookings.filter((b) => {
    const status = b.status || "Pending";
    return (status === "Pending" || status === "Inquiry") && !dismissedIds.includes(b.id);
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
            className="absolute right-0 top-12 w-80 bg-white border border-natural-border rounded-xl shadow-2xl z-50 overflow-hidden glass-card"
          >
            <div className="p-4 border-b border-natural-border flex items-center justify-between bg-natural-bg/30">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-natural-text-main uppercase tracking-widest">Recent Bookings</h3>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-1 hover:bg-natural-bg rounded-lg transition-colors">
                  <X className="w-4 h-4 text-natural-text-light" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-natural-border scrollbar-none">
              {recentBookings.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell className="w-8 h-8 text-natural-text-light opacity-20 mx-auto mb-3" />
                  <p className="text-xs font-serif italic text-natural-text-light">No recent bookings found.</p>
                </div>
              ) : (
                recentBookings.map((booking) => {
                  const isPending = ((booking.status || "Pending") === "Pending" || booking.status === "Inquiry") && !dismissedIds.includes(booking.id);
                  const isExpanded = expandedId === booking.id;

                  return (
                    <div 
                      key={booking.id} 
                      className={cn(
                        "p-4 hover:bg-natural-bg/30 transition-all cursor-pointer group",
                        isPending && "bg-natural-accent/5"
                      )}
                      onClick={() => {
                        setExpandedId(isExpanded ? null : booking.id);
                        if (isPending && onDismiss) onDismiss(booking.id);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-natural-text-main flex items-center gap-2">
                            {booking.eventType || "Event"} Booking
                            {isPending && (
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                            )}
                          </p>
                          <p className="text-[10px] text-natural-text-light mt-0.5">
                            from {booking.customerName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPending && (
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
              <button 
                onClick={() => {
                  if (onManageBooking) onManageBooking();
                  onClose();
                }}
                className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-accent transition-colors"
              >
                View All Bookings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
