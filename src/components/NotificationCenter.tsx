import React from 'react';
import { Bell, X, AlertTriangle, CheckCircle, Sliders, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useBooking, Booking } from '../context/BookingContext';

export interface AdminNotificationItem {
  notifKey: string;
  notifType: 'booking_status' | 'client_modification' | 'payment_uploaded';
  booking: Booking;
  timestamp: string;
  isActionable: boolean;
  modRequest?: any;
  addedDishes?: string[];
  removedDishes?: string[];
}

export function buildAdminNotifications(bookings: Booking[]): AdminNotificationItem[] {
  const items: AdminNotificationItem[] = [];

  bookings
    .filter((b) => (b.status || 'Pending') !== 'Archived')
    .forEach((b) => {
      const status = b.status || 'Pending';
      const isStatusActionable =
        status === 'Pending' ||
        status === 'Inquiry' ||
        status === 'Cancelled' ||
        status === 'Confirmed';

      items.push({
        notifKey: `${b.id}-${status}`,
        notifType: 'booking_status',
        booking: b,
        timestamp:
          b.logistics_info?.confirmed_at ||
          b.updated_at ||
          b.created_at ||
          '',
        isActionable: isStatusActionable,
      });

      // Emit distinct notifications for every active client modification (Applied or Pending)
      if (Array.isArray(b.modification_requests)) {
        b.modification_requests.forEach((mod: any) => {
          if (mod && (mod.status === 'Applied' || mod.status === 'Pending')) {
            const prevDishes: string[] = Array.isArray(mod.previous_menu_items)
              ? mod.previous_menu_items
              : [];
            const reqDishes: string[] = Array.isArray(mod.requested_menu_items)
              ? mod.requested_menu_items
              : [];
            const addedDishes = Array.isArray(mod.added_dishes)
              ? mod.added_dishes
              : reqDishes.filter((d) => !prevDishes.includes(d));
            const removedDishes = Array.isArray(mod.removed_dishes)
              ? mod.removed_dishes
              : prevDishes.filter((d) => !reqDishes.includes(d));

            items.push({
              notifKey: `${b.id}-client-mod-${mod.id}`,
              notifType: 'client_modification',
              booking: b,
              timestamp: mod.created_at || b.created_at || '',
              isActionable: true,
              modRequest: mod,
              addedDishes,
              removedDishes,
            });
          }
        });
      }

      // Emit notification when client uploads final balance receipt for verification
      if (b.final_balance_status === 'Pending Verification' && b.final_balance_receipt) {
        items.push({
          notifKey: `${b.id}-balance-upload-${b.final_balance_reference || 'slip'}`,
          notifType: 'payment_uploaded',
          booking: b,
          timestamp: b.logistics_info?.client_modified_at || b.created_at || '',
          isActionable: true,
        });
      }
    });

  return items;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onViewAllLogs?: () => void;
  onManageBooking?: () => void;
  dismissedIds?: string[];
  onDismiss?: (id: string) => void;
}

export function NotificationCenter({
  isOpen,
  onClose,
  onManageBooking,
  dismissedIds = [],
  onDismiss,
}: NotificationCenterProps) {
  const { bookings, refreshBookings } = useBooking();
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [readDuringSession, setReadDuringSession] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      refreshBookings(true);
    } else {
      setTimeout(() => {
        setShowAll(false);
        setReadDuringSession([]);
      }, 200);
    }
  }, [isOpen]);

  const allNotifications = React.useMemo(() => {
    const raw = buildAdminNotifications(bookings);
    return raw.sort((a, b) => {
      const isUnreadA =
        a.isActionable &&
        (!dismissedIds.includes(a.notifKey) || readDuringSession.includes(a.notifKey));
      const isUnreadB =
        b.isActionable &&
        (!dismissedIds.includes(b.notifKey) || readDuringSession.includes(b.notifKey));

      if (isUnreadA && !isUnreadB) return -1;
      if (!isUnreadA && isUnreadB) return 1;

      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [bookings, dismissedIds, readDuringSession]);

  const displayItems = showAll ? allNotifications : allNotifications.slice(0, 6);
  const hasUnread = allNotifications.some(
    (item) => item.isActionable && !dismissedIds.includes(item.notifKey)
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 w-[30rem] bg-white border border-natural-border rounded-xl shadow-2xl z-50 overflow-hidden glass-card"
          >
            <div className="p-4 border-b border-natural-border flex items-center justify-between bg-natural-bg/30">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-natural-text-main uppercase tracking-widest">
                  {showAll ? "All Notifications" : "Recent Notifications"}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {hasUnread && (
                  <button
                    onClick={() => {
                      const newlyRead: string[] = [];
                      allNotifications.forEach((item) => {
                        if (item.isActionable && !dismissedIds.includes(item.notifKey)) {
                          newlyRead.push(item.notifKey);
                          if (onDismiss) onDismiss(item.notifKey);
                        }
                      });
                      setReadDuringSession((prev) => [...prev, ...newlyRead]);
                    }}
                    className="text-[9px] font-bold text-natural-accent hover:underline uppercase tracking-widest cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-natural-bg rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-natural-text-light" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-natural-border scrollbar-none">
              {displayItems.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell className="w-8 h-8 text-natural-text-light opacity-20 mx-auto mb-3" />
                  <p className="text-xs font-serif italic text-natural-text-light">
                    No notifications found.
                  </p>
                </div>
              ) : (
                displayItems.map((item) => {
                  const { notifKey, notifType, booking, modRequest, addedDishes = [], removedDishes = [] } = item;
                  const isUnreadNotif = item.isActionable && !dismissedIds.includes(notifKey);
                  const isExpanded = expandedKey === notifKey;
                  const isCancelled = notifType === 'booking_status' && booking.status === 'Cancelled';
                  const isMod = notifType === 'client_modification';
                  const isPayment = notifType === 'payment_uploaded';

                  const paxChanged =
                    isMod &&
                    modRequest?.previous_additional_pax !== undefined &&
                    modRequest?.requested_additional_pax !== undefined &&
                    Number(modRequest.previous_additional_pax) !== Number(modRequest.requested_additional_pax);

                  return (
                    <div
                      key={notifKey}
                      className={cn(
                        "p-4 hover:bg-natural-bg/30 transition-all cursor-pointer group",
                        isUnreadNotif &&
                          (isCancelled
                            ? "bg-red-50/50 dark:bg-red-950/30"
                            : isMod
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : "bg-natural-accent/5")
                      )}
                      onClick={() => {
                        setExpandedKey(isExpanded ? null : notifKey);
                        if (isUnreadNotif && onDismiss) {
                          setReadDuringSession((prev) => [...prev, notifKey]);
                          onDismiss(notifKey);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-xs font-bold flex items-center gap-2",
                              isCancelled
                                ? "text-red-600 dark:text-red-400"
                                : isMod
                                ? "text-natural-accent"
                                : "text-natural-text-main"
                            )}
                          >
                            {isCancelled && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                            {isMod && <Sliders className="w-3.5 h-3.5 shrink-0" />}
                            {isPayment && <CreditCard className="w-3.5 h-3.5 shrink-0" />}
                            <span>
                              {isMod
                                ? modRequest?.status === "Applied"
                                  ? "Client Updated Menu / Event Details"
                                  : "Client Modification Request"
                                : isPayment
                                ? "Final Balance Receipt Uploaded"
                                : isCancelled
                                ? "Cancelled Booking"
                                : `${booking.eventType || "Event"} Booking (${booking.status || "Pending"})`}
                            </span>
                            {isUnreadNotif && (
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full animate-pulse shrink-0",
                                  isCancelled ? "bg-red-500" : "bg-natural-accent"
                                )}
                              />
                            )}
                          </p>
                          <p className="text-[10px] text-natural-text-light mt-0.5">
                            from <strong className="text-natural-text-main">{booking.customerName}</strong> • Event: {booking.date}
                          </p>
                          <p className="text-[9px] text-natural-text-light mt-0.5 opacity-70">
                            {item.timestamp
                              ? new Date(item.timestamp).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Recently"}
                          </p>

                          {/* Compact summary preview for modifications */}
                          {isMod && !isExpanded && (
                            <div className="mt-1.5 space-y-0.5 text-[10px] text-natural-text-main">
                              {paxChanged && (
                                <p>
                                  Extra Pax: +{modRequest.previous_additional_pax || 0} ➔{" "}
                                  <strong className="text-natural-accent">
                                    +{modRequest.requested_additional_pax || 0}
                                  </strong>
                                </p>
                              )}
                              {(addedDishes.length > 0 || removedDishes.length > 0) && (
                                <p className="truncate">
                                  Menu: {removedDishes.length > 0 ? `-${removedDishes.join(", ")} ` : ""}
                                  {addedDishes.length > 0 ? `+${addedDishes.join(", ")}` : ""}
                                </p>
                              )}
                              {modRequest?.notes && (
                                <p className="italic text-natural-text-light truncate">
                                  Note: "{modRequest.notes}"
                                </p>
                              )}
                            </div>
                          )}

                          {isCancelled && !isExpanded && (
                            <p className="text-[10px] text-red-800/70 dark:text-red-300/80 mt-1 italic truncate max-w-[240px]">
                              Reason:{" "}
                              {booking.cancellation_reason && booking.cancellation_reason.trim() !== ""
                                ? booking.cancellation_reason
                                : "No reason provided"}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isUnreadNotif && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDismiss) {
                                  setReadDuringSession((prev) => [...prev, notifKey]);
                                  onDismiss(notifKey);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-natural-text-light hover:text-green-600 hover:bg-green-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/40 rounded transition-all cursor-pointer"
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
                        <div className="mt-3 pt-3 border-t border-natural-border/50 animate-in slide-in-from-top-1 fade-in duration-200 space-y-2">
                          {isCancelled && (
                            <div className="mb-2 p-2.5 bg-red-50 border border-red-100 dark:bg-red-950/40 dark:border-red-900/60 rounded-lg">
                              <p className="text-[9px] font-bold text-red-800 dark:text-red-300 uppercase tracking-widest mb-1">
                                Reason for Cancellation
                              </p>
                              <p className="text-[11px] text-red-900 dark:text-red-200 italic">
                                "{booking.cancellation_reason && booking.cancellation_reason.trim() !== ""
                                  ? booking.cancellation_reason
                                  : "No reason provided"}"
                              </p>
                            </div>
                          )}

                          {isMod && modRequest && (
                            <div className="p-2.5 bg-natural-bg/80 border border-natural-border rounded-lg space-y-1.5 text-[11px]">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-natural-accent">
                                Client Modification Summary ({modRequest.status})
                              </p>
                              {paxChanged && (
                                <p className="text-natural-text-main">
                                  <span className="font-semibold text-natural-text-light">Headcount:</span>{" "}
                                  {(Number(modRequest.base_guest_count) || Number(booking.guestCount) || 50) +
                                    (Number(modRequest.previous_additional_pax) || 0)}{" "}
                                  ➔{" "}
                                  <strong className="text-natural-accent">
                                    {(Number(modRequest.base_guest_count) || Number(booking.guestCount) || 50) +
                                      (Number(modRequest.requested_additional_pax) || 0)}{" "}
                                    Guests (+{modRequest.requested_additional_pax || 0} Extra)
                                  </strong>
                                </p>
                              )}
                              {(addedDishes.length > 0 || removedDishes.length > 0) && (
                                <div className="space-y-1">
                                  <span className="font-semibold text-natural-text-light block">
                                    Dish Swaps:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {removedDishes.map((d) => (
                                      <span
                                        key={`rem-${d}`}
                                        className="px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded text-[10px] line-through"
                                      >
                                        {d}
                                      </span>
                                    ))}
                                    {addedDishes.map((d) => (
                                      <span
                                        key={`add-${d}`}
                                        className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold"
                                      >
                                        + {d}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {modRequest.notes && (
                                <div className="pt-1 border-t border-natural-border/50">
                                  <span className="font-semibold text-natural-text-light block text-[10px] uppercase">
                                    Special Instructions / Reason:
                                  </span>
                                  <p className="italic text-natural-text-main mt-0.5">
                                    "{modRequest.notes}"
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="text-[11px] text-natural-text-main space-y-0.5">
                            <p>
                              <span className="font-semibold text-natural-text-light">Email:</span>{" "}
                              {booking.email || "N/A"}
                            </p>
                            <p>
                              <span className="font-semibold text-natural-text-light">Phone:</span>{" "}
                              {booking.phone || "N/A"}
                            </p>
                            <p>
                              <span className="font-semibold text-natural-text-light">Package:</span>{" "}
                              {booking.package || "Custom"}
                            </p>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onManageBooking) onManageBooking();
                              setTimeout(() => {
                                window.dispatchEvent(
                                  new CustomEvent("openAdminBookingOverview", {
                                    detail: { bookingId: booking.id },
                                  })
                                );
                              }, 80);
                              onClose();
                            }}
                            className="text-[10px] font-bold bg-natural-accent text-white px-3 py-1.5 rounded w-full hover:bg-natural-accent/90 transition-colors shadow-sm cursor-pointer"
                          >
                            View &amp; Manage Booking
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-natural-bg/50 border-t border-natural-border text-center">
              {!showAll && allNotifications.length > 6 ? (
                <button
                  onClick={() => setShowAll(true)}
                  className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-accent transition-colors cursor-pointer"
                >
                  View All Notifications ({allNotifications.length})
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (onManageBooking) onManageBooking();
                    onClose();
                  }}
                  className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-accent transition-colors cursor-pointer"
                >
                  View All Bookings
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
