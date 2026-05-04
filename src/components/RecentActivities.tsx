import { Activity } from 'lucide-react';

const activities: any[] = [];

/**
 * Displays a chronological list of recent system changes and user actions.
 */
export function RecentActivities({ onViewLogs }: { onViewLogs?: () => void }) {
  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="mb-6 text-center lg:text-left">
        <h3 className="text-lg font-bold text-natural-text-main font-serif">Recent Audit Trail</h3>
        <p className="text-[0.7rem] text-natural-text-light font-medium uppercase tracking-wider">Live tracking of system events</p>
      </div>

      <div className="flex-1 space-y-6">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-natural-text-light opacity-50">
            <Activity className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-[0.7rem] font-serif italic">No recent system activities</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="relative pl-7 pb-4 last:pb-0">
              {/* Timeline dot */}
              <div className="absolute left-0 top-1 w-2 h-2 rounded-full border-2 border-natural-card bg-natural-accent z-10 box-content" />
              
              <div className="flex flex-col">
                <p className="text-[0.75rem] text-natural-text-main leading-relaxed">
                  <span className="font-bold">{activity.user}</span>
                  {' '}{activity.action}{' '}
                  {activity.target && <span className="font-semibold text-natural-accent italic opacity-90">"{activity.target}"</span>}
                </p>
                <span className="text-[9px] font-bold text-natural-text-light mt-1 uppercase tracking-[0.15em]">{activity.time}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <button 
        onClick={onViewLogs}
        className="mt-8 py-2 w-full bg-natural-bg hover:bg-natural-border border border-natural-border rounded-lg text-[0.7rem] font-bold text-natural-text-main transition-colors uppercase tracking-widest shadow-xs"
      >
        System Logs
      </button>
    </div>
  );
}
