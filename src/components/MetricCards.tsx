import { CalendarCheck, PartyPopper, Users, ArrowUpRight } from 'lucide-react';
import { useBooking } from '../context/BookingContext';
import { useUser } from '../context/UserContext';
import { useInventory } from '../context/InventoryContext';
import { cn } from '../lib/utils';

interface MetricCardsProps {
  onNavigate?: (id: string) => void;
}

/**
 * Renders high-level business metrics including confirmed/pending bookings, active users,
 * and outsourced rental equipment when active shortages exist.
 */
export function MetricCards({ onNavigate }: MetricCardsProps = {}) {
  const { bookings } = useBooking();
  const { activeUserCount } = useUser();
  const { items, getOutsourcedStock } = useInventory();

  const confirmedCount = bookings.filter((b) => b.status === 'Confirmed' || b.status === 'Completed').length;
  const pendingCount = bookings.filter((b) => b.status === 'Pending').length;

  const activeItems = items.filter((item) => item.status !== 'Archived' && item.status?.toLowerCase() !== 'archived');
  const totalOutsourced = activeItems.reduce((acc, i) => acc + getOutsourcedStock(i.id), 0);
  const outsourcedItemsCount = activeItems.filter((i) => getOutsourcedStock(i.id) > 0).length;

  // “Active Users” should reflect the same status used in User Management.
  // `User.status` values are like: "Active", "Inactive", "Archived".
  // Active user count is sourced directly from the database via UserContext

  const stats = [
    {
      id: 'total-booking',
      label: 'Confirmed Bookings',
      value: confirmedCount.toString(),
      change: 'Active',
      icon: CalendarCheck,
      badgeColor: 'text-natural-accent',
      iconBg: 'bg-natural-bg border-natural-border text-natural-accent',
      onClick: onNavigate ? () => onNavigate('booking') : undefined,
    },
    {
      id: 'total-events',
      label: 'Total Pendings',
      value: pendingCount.toString(),
      change: 'Awaiting Response',
      icon: PartyPopper,
      badgeColor: 'text-natural-accent',
      iconBg: 'bg-natural-bg border-natural-border text-natural-accent',
      onClick: onNavigate ? () => onNavigate('booking') : undefined,
    },
    {
      id: 'total-users',
      label: 'Total Active Users',
      value: activeUserCount.toString(),
      change: 'Currently Active',
      icon: Users,
      badgeColor: 'text-natural-accent',
      iconBg: 'bg-natural-bg border-natural-border text-natural-accent',
      onClick: onNavigate ? () => onNavigate('users') : undefined,
    },
    ...(totalOutsourced > 0 ? [
      {
        id: 'total-outsourced',
        label: 'Outsourced (Rent)',
        value: `${totalOutsourced.toLocaleString()} Units`,
        change: `${outsourcedItemsCount} Item${outsourcedItemsCount === 1 ? '' : 's'} to Rent`,
        icon: ArrowUpRight,
        badgeColor: 'text-amber-700 dark:text-amber-300 font-bold',
        iconBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400',
        cardBorder: 'border-amber-400/50 dark:border-amber-700/60',
        onClick: onNavigate ? () => onNavigate('inventory') : undefined,
      }
    ] : []),
  ];

  return (
    <div className={cn(
      "grid gap-6",
      stats.length === 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-3"
    )}>
      {stats.map((stat) => (
        <div
          key={stat.id}
          id={stat.id}
          onClick={stat.onClick}
          className={cn(
            "glass-card p-6 transition-all duration-250",
            stat.cardBorder,
            stat.onClick && "cursor-pointer hover:shadow-md hover:scale-[1.01]"
          )}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[0.7rem] font-medium text-natural-text-light uppercase tracking-[0.1em] mb-2">{stat.label}</p>
              <h3 className="text-3xl font-semibold text-natural-text-main font-serif">{stat.value}</h3>
              <p className="mt-2 text-[0.7rem] font-medium">
                <span className={stat.badgeColor}>{stat.change}</span>
              </p>
            </div>
            <div className={cn("p-2 rounded-lg border", stat.iconBg)}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
