import { CalendarCheck, PartyPopper, Users } from 'lucide-react';
import { useBooking } from '../context/BookingContext';
import { useUser } from '../context/UserContext';

/**
 * Renders high-level business metrics including confirmed/pending bookings and user count.
 */
export function MetricCards() {
  const { bookings } = useBooking();
  const { activeUserCount } = useUser();

  const confirmedCount = bookings.filter((b) => b.status === 'Confirmed').length;
  const pendingCount = bookings.filter((b) => b.status === 'Pending').length;

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
    },
    {
      id: 'total-events',
      label: 'Total Pendings',
      value: pendingCount.toString(),
      change: 'Awaiting Response',
      icon: PartyPopper,
    },
    {
      id: 'total-users',
      label: 'Total Active Users',
      value: activeUserCount.toString(),
      change: 'Currently Active',
      icon: Users,
    },
  ];


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat) => (
        <div key={stat.id} id={stat.id} className="glass-card p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[0.7rem] font-medium text-natural-text-light uppercase tracking-[0.1em] mb-2">{stat.label}</p>
              <h3 className="text-3xl font-semibold text-natural-text-main font-serif">{stat.value}</h3>
              <p className="mt-2 text-[0.7rem] font-medium">
                <span className="text-natural-accent">{stat.change}</span>
              </p>
            </div>
            <div className="p-2 rounded-lg bg-natural-bg border border-natural-border">
              <stat.icon className="w-5 h-5 text-natural-accent" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
