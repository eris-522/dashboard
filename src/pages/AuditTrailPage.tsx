import React from 'react';
import { Search, Filter, History, User, Clock, Shield, Database, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const auditLogs = [
  { 
    id: 1, 
    user: 'Roxan P.', 
    action: 'Updated Booking', 
    target: 'Wedding Reception - Santos', 
    timestamp: new Date(2026, 3, 22, 10, 30), 
    type: 'Update',
    details: 'Status changed from Pending to Confirmed'
  },
  { 
    id: 2, 
    user: 'Juan Dela Cruz', 
    action: 'Added Menu Item', 
    target: 'Beef Caldereta Special', 
    timestamp: new Date(2026, 3, 22, 9, 15), 
    type: 'Create',
    details: 'New dish added to Main Course category'
  },
  { 
    id: 3, 
    user: 'System', 
    action: 'Inventory Alert', 
    target: 'Glassware Set', 
    timestamp: new Date(2026, 3, 21, 23, 0), 
    type: 'System',
    details: 'Stock level dropped below minimum threshold (8/20)'
  },
  { 
    id: 4, 
    user: 'Maria Salome', 
    action: 'Modified Package', 
    target: 'Classic Wedding Package', 
    timestamp: new Date(2026, 3, 21, 16, 45), 
    type: 'Update',
    details: 'Adjusted price per pax from ₱800 to ₱850'
  },
  { 
    id: 5, 
    user: 'Roxan P.', 
    action: 'Deleted User', 
    target: 'Temp Account #3', 
    timestamp: new Date(2026, 3, 21, 14, 20), 
    type: 'Delete',
    details: 'Permanent removal of temporary administrative account'
  },
  { 
    id: 6, 
    user: 'Ricardo Dalisay', 
    action: 'Logistics Update', 
    target: 'BDO Corp Anniversary', 
    timestamp: new Date(2026, 3, 21, 11, 0), 
    type: 'Update',
    details: 'Assigned Driver for transport team'
  },
];

export function AuditTrailPage() {
  const [logs, setLogs] = React.useState<any[]>([]);

  /**
   * Clears the current session's audit log display after user confirmation.
   * Note: In a production environment, this would require high-level authorization.
   */
  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) {
      setLogs([]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">System Audit Trail</h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">Complete record of administrative actions</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleClearLogs}
            className="flex items-center gap-2 px-4 py-2.5 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-all uppercase tracking-widest"
          >
            <History className="w-3.5 h-3.5" />
            Clear Logs
          </button>
          <button className="flex items-center gap-2 bg-natural-sidebar text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-sidebar/90 transition-all shadow-sm">
            Download Audit Archive
          </button>
        </div>
      </div>

      <div className="glass-card bg-white overflow-hidden">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="Search by user or action..." 
              className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-colors uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              Event Type
            </button>
          </div>
        </div>

        <div className="divide-y divide-natural-border">
          {logs.length === 0 ? (
            <div className="py-20 text-center">
              <History className="w-12 h-12 text-natural-text-light mx-auto mb-4 opacity-20" />
              <p className="text-natural-text-light font-serif italic text-sm">No administrative logs recorded yet</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-natural-bg/10 transition-colors flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex items-center gap-4 shrink-0 w-full md:w-64">
                  <div className={cn(
                    "p-3 rounded-xl border",
                    log.type === 'Update' ? "bg-blue-50 border-blue-100 text-blue-600" :
                    log.type === 'Create' ? "bg-green-50 border-green-100 text-green-600" :
                    log.type === 'Delete' ? "bg-red-50 border-red-100 text-red-600" :
                    "bg-amber-50 border-amber-100 text-amber-600"
                  )}>
                    {log.type === 'Update' ? <Database className="w-5 h-5" /> :
                     log.type === 'Create' ? <Plus className="w-5 h-5" /> :
                     log.type === 'Delete' ? <Shield className="w-5 h-5" /> :
                     <Clock className="w-5 h-5" />}
                  </div>
                  <div>
                     <p className="text-xs font-bold text-natural-text-main uppercase tracking-widest leading-none mb-1">{log.type}</p>
                     <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest opacity-60">ID: LOG-{log.id.toString().padStart(5, '0')}</p>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                     <div>
                        <h4 className="text-sm font-bold text-natural-text-main tracking-tight leading-tight">{log.action}</h4>
                        <p className="text-xs text-natural-text-light font-medium mt-0.5">Target: <span className="text-natural-text-main font-semibold">{log.target}</span></p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-bold text-natural-text-main tracking-tighter">{format(log.timestamp, 'HH:mm a')}</p>
                        <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">{format(log.timestamp, 'MMM d, yyyy')}</p>
                     </div>
                  </div>
                  
                  <div className="bg-natural-bg border border-natural-border px-4 py-3 rounded-lg mt-3 flex items-start gap-3">
                     <div className="w-1 h-8 bg-natural-border rounded-full" />
                     <div>
                        <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest mb-1">Administrative Changes</p>
                        <p className="text-xs font-medium text-natural-text-main italic">"{log.details}"</p>
                     </div>
                  </div>
                </div>

                <div className="shrink-0 w-full md:w-48 pt-1 flex md:flex-col items-center md:items-end justify-between md:justify-start gap-3">
                   <div className="flex items-center gap-2 text-right">
                      <div className="text-right hidden md:block">
                         <p className="text-xs font-bold text-natural-text-main leading-tight">{log.user}</p>
                         <p className="text-[9px] font-bold text-natural-text-light uppercase tracking-wider">Access Granted</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-natural-sidebar text-[#f8f7f2] flex items-center justify-center text-[0.65rem] font-bold shrink-0">
                         {log.user === 'System' ? 'S' : log.user.split(' ').map(n => n[0]).join('')}
                      </div>
                   </div>
                   <button className="flex items-center gap-1.5 text-[10px] font-bold text-natural-accent uppercase tracking-widest hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      Verify
                   </button>
                </div>
              </div>
            ))
          )}
        </div>

        {logs.length > 0 && (
          <div className="p-4 bg-natural-bg/10 text-center">
            <button className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-[0.2em] hover:text-natural-accent transition-colors">
              Load Historical Entries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const Plus = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);
