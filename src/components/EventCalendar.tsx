import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import React from 'react';

interface EventCalendarProps {
  bookings?: {
    id: number;
    customerName: string;
    eventType: string;
    date: string;
    time: string;
    venueName: string;
  }[];
}

export function EventCalendar({ bookings = [] }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const events = bookings.map(b => ({
    id: b.id,
    title: `${b.eventType} - ${b.customerName}`,
    date: parseISO(b.date)
  }));

  /**
   * Advances the calendar view to the next month.
   */
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  /**
   * Regresses the calendar view to the previous month.
   */
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthEvents = events.map(e => {
    const booking = bookings.find(b => b.id === e.id);
    return {
      ...e,
      time: booking?.time,
      venue: booking?.venueName
    };
  }).filter(e => isSameMonth(e.date, currentMonth));

  return (
    <div className="glass-card p-6 h-full flex flex-col min-h-[500px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif">Event Schedule</h3>
          <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Confirmed Bookings Only</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={prevMonth}
            className="p-1.5 hover:bg-natural-bg rounded-lg transition-colors border border-natural-border shadow-xs"
          >
            <ChevronLeft className="w-4 h-4 text-natural-text-main" />
          </button>
          <button 
            onClick={nextMonth}
            className="p-1.5 hover:bg-natural-bg rounded-lg transition-colors border border-natural-border shadow-xs"
          >
            <ChevronRight className="w-4 h-4 text-natural-text-main" />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm font-semibold text-natural-accent font-serif italic tracking-wide">{format(currentMonth, 'MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <div key={`${day}-${idx}`} className="text-center text-[10px] font-bold text-natural-text-light uppercase tracking-wider opacity-50">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1">
        {days.map((day, idx) => {
          const hasEvent = events.some(e => isSameDay(e.date, day));
          return (
            <div 
              key={idx} 
              className={`
                aspect-square flex items-center justify-center text-[0.7rem] rounded-md cursor-pointer transition-all relative
                ${!isSameMonth(day, currentMonth) ? 'opacity-20' : 'text-natural-text-main'}
                ${isToday(day) ? 'bg-natural-accent text-white font-bold' : 'hover:bg-natural-bg'}
                ${hasEvent && !isToday(day) ? 'bg-natural-accent/10 border border-natural-accent/20' : ''}
              `}
            >
              {format(day, 'd')}
              {hasEvent && !isToday(day) && (
                <div className="absolute top-1 right-1 w-1 h-1 bg-natural-accent rounded-full" />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8 space-y-3">
        {monthEvents.length === 0 ? (
          <p className="text-center text-xs text-natural-text-light font-medium py-4 italic">No events scheduled for this month</p>
        ) : (
          monthEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between p-3 rounded-xl bg-natural-bg border border-natural-border hover:shadow-xs transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-green-500 rounded-full" />
                <div>
                  <p className="text-[0.75rem] font-bold text-natural-text-main tracking-tight">{event.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] text-natural-text-light font-bold uppercase tracking-wider">{format(event.date, 'MMM d')}</p>
                    <span className="text-[8px] text-natural-text-light">•</span>
                    <p className="text-[9px] text-natural-text-light font-bold uppercase tracking-wider">{event.time}</p>
                  </div>
                  <p className="text-[9px] text-natural-accent font-medium mt-0.5 italic">{event.venue}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
