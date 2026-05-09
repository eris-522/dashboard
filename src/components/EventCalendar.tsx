import { ChevronLeft, ChevronRight } from 'lucide-react';

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import React from 'react';
import { cn } from '../lib/utils';

interface EventCalendarProps {
  bookings?: {
    id: number;
    customerName: string;
    eventType: string;
    date: string;
    time: string;
    venueName: string;
    package?: string;
    guestCount?: number;
    status?: string;
  }[];
  detailedView?: boolean;
}

export function EventCalendar({ bookings = [], detailedView = false }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const events = bookings.map((b) => {
    try {
      return {
        id: b.id,
        title: `${b.eventType} - ${b.customerName || "Unknown"}`,
        date: b.date && b.date.trim() ? parseISO(b.date) : new Date(),
      };
    } catch (error) {
      console.warn(`Failed to parse event date for booking ${b.id}:`, error);
      return {
        id: b.id,
        title: `${b.eventType} - ${b.customerName || "Unknown"}`,
        date: new Date(),
      };
    }
  });


  /**
   * Advances the calendar view to the next month.
   */
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  /**
   * Regresses the calendar view to the previous month.
   */
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const detailedEvents = events.map(e => {
    const booking = bookings.find(b => b.id === e.id);
    return {
      ...e,
      time: booking?.time,
      venue: booking?.venueName,
      package: booking?.package,
      guestCount: booking?.guestCount,
      status: booking?.status
    };
  });

  const monthEvents = detailedEvents.filter(e => isSameMonth(e.date, currentMonth));

  return (
    <div className="glass-card p-6 h-full flex flex-col min-h-[500px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif">Event Schedule</h3>
          {!detailedView && (
            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Confirmed Bookings Only</p>
          )}
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

      <div className={cn("grid grid-cols-7 flex-1", detailedView ? "gap-2" : "gap-1")}>
        {days.map((day, idx) => {
          const dayEvents = detailedEvents.filter(e => isSameDay(e.date, day));
          const hasEvent = dayEvents.length > 0;
          return (
            <div 
              key={idx} 
              className={cn(
                "rounded-md cursor-pointer transition-all relative flex",
                detailedView ? "min-h-[120px] flex-col p-1.5 border border-natural-border/50 items-start justify-start hover:border-natural-accent/40" : "aspect-square items-center justify-center text-[0.7rem]",
                !isSameMonth(day, currentMonth) ? 'opacity-20 bg-natural-bg/50' : 'text-natural-text-main',
                isToday(day) && !detailedView ? 'bg-natural-accent text-white font-bold' : 'hover:bg-natural-bg',
                hasEvent && !isToday(day) && !detailedView ? 'bg-natural-accent/10 border border-natural-accent/20' : '',
                detailedView && isToday(day) ? 'border-natural-accent/50 bg-natural-accent/5' : ''
              )}
            >
              <span className={cn(
                detailedView ? "text-[0.65rem] font-bold mb-1 w-full text-right" : "",
                isToday(day) && detailedView ? "text-natural-accent" : ""
              )}>
                {format(day, 'd')}
              </span>
              
              {detailedView && dayEvents.length > 0 && (
                <div className="flex flex-col gap-1 w-full overflow-y-auto flex-1 scrollbar-none mt-1">
                  {dayEvents.map((e, i) => (
                    <div key={i} className={cn(
                      "text-[0.55rem] px-1.5 py-1.5 rounded-md border flex flex-col gap-0.5",
                      e.status === 'Confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                      e.status === 'Pending' || e.status === 'Inquiry' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    )} title={`${e.time} - ${e.title}`}>
                      <div className="font-bold flex justify-between items-start gap-1">
                        <span className="truncate">{e.title.split(' - ')[0]}</span>
                        <span className="shrink-0">{e.time}</span>
                      </div>
                      <div className="opacity-90 font-medium truncate mt-0.5">{e.title.split(' - ')[1] || "Unknown Client"}</div>
                      <div className="opacity-90 italic truncate text-[0.5rem] mt-0.5">{e.venue}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 pt-1 border-t border-current/20 opacity-90 text-[0.5rem]">
                        {e.package && <span><span className="font-medium opacity-80">Pkg:</span> {e.package}</span>}
                        {e.guestCount ? <span><span className="font-medium opacity-80">Pax:</span> {e.guestCount}</span> : null}
                        {e.status && (
                          <span className={cn(
                            "font-bold uppercase tracking-widest px-1 py-0.5 rounded border w-full text-center mt-0.5",
                            e.status === 'Confirmed' ? 'bg-green-100 text-green-800 border-green-300' :
                            e.status === 'Pending' || e.status === 'Inquiry' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                            'bg-gray-200 text-gray-800 border-gray-300'
                          )}>
                            {e.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasEvent && !isToday(day) && !detailedView && (
                <div className="absolute top-1 right-1 w-1 h-1 bg-natural-accent rounded-full" />
              )}
            </div>
          )
        })}
      </div>

      {!detailedView && (
        <div className="mt-8 space-y-3">
          {monthEvents.length === 0 ? (
            <p className="text-center text-xs text-natural-text-light font-medium py-4 italic">No events scheduled for this month</p>
          ) : (
            monthEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-xl bg-natural-bg border border-natural-border hover:shadow-xs transition-shadow">
                <div className="flex items-start gap-3 w-full">
                  <div className={cn(
                    "w-1 h-12 rounded-full shrink-0 mt-1", 
                    event.status === 'Confirmed' ? 'bg-green-500' : 
                    event.status === 'Pending' || event.status === 'Inquiry' ? 'bg-orange-400' : 
                    'bg-gray-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-bold text-natural-text-main tracking-tight">{event.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[9px] text-natural-text-light font-bold uppercase tracking-wider">{format(event.date, 'MMM d')}</p>
                      <span className="text-[8px] text-natural-text-light">•</span>
                      <p className="text-[9px] text-natural-text-light font-bold uppercase tracking-wider">{event.time}</p>
                    </div>
                    <p className="text-[9px] text-natural-accent font-medium mt-0.5 italic truncate">{event.venue}</p>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-natural-border/50">
                      {event.package && (
                        <p className="text-[9px] text-natural-text-main">
                          <span className="text-natural-text-light font-medium">Pkg:</span> {event.package}
                        </p>
                      )}
                      {event.guestCount ? (
                        <p className="text-[9px] text-natural-text-main">
                          <span className="text-natural-text-light font-medium">Pax:</span> {event.guestCount}
                        </p>
                      ) : null}
                      {event.status && (
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border",
                          event.status === 'Confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                          event.status === 'Pending' || event.status === 'Inquiry' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        )}>
                          {event.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
