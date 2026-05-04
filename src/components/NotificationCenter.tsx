import React from 'react';
import { Bell, X, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const notifications: any[] = [];

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onViewAllLogs?: () => void;
}

export function NotificationCenter({ isOpen, onClose, onViewAllLogs }: NotificationCenterProps) {
  const [items, setItems] = React.useState(notifications);

  /**
   * Updates all current notifications to a 'read' state.
   */
  const markAllAsRead = () => {
    setItems(items.map(item => ({ ...item, unread: false })));
  };

  /**
   * Removes a specific notification from the list.
   * @param id The unique identifier of the notification to delete.
   */
  const removeNotification = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

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
            className="absolute right-0 top-12 w-[328px] bg-white border border-natural-border rounded-xl shadow-2xl z-50 overflow-hidden glass-card"
          >
            <div className="p-4 border-b border-natural-border flex items-center justify-between bg-natural-bg/30">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-natural-accent" />
                <h3 className="text-sm font-bold text-natural-text-main uppercase tracking-widest">Notifications</h3>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="flex items-center justify-center p-1.5 bg-white rounded-lg hover:bg-natural-bg transition-all group/check"
                >
                  <CheckCircle className="w-4 h-4 text-[#8a8b82] group-hover/check:text-natural-accent transition-colors" />
                </button>
                <button onClick={onClose} className="p-1 hover:bg-natural-bg rounded-lg transition-colors">
                  <X className="w-4 h-4 text-natural-text-light" />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-none">
              {items.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell className="w-8 h-8 text-natural-text-light opacity-20 mx-auto mb-3" />
                  <p className="text-xs font-serif italic text-natural-text-light">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-natural-border">
                  {items.map((item) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-4 hover:bg-natural-bg/20 transition-all group relative",
                        item.unread && "bg-natural-accent/5"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "mt-1 rounded-lg border h-[29.25px] flex items-center justify-center shrink-0 px-2",
                          item.type === 'success' ? "bg-green-50 border-green-100 text-green-600" :
                          item.type === 'warning' ? "bg-red-50 border-red-100 text-red-600" :
                          "bg-blue-50 border-blue-100 text-blue-600"
                        )}>
                          {item.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> :
                           item.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                           <Info className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <h4 className="text-xs font-bold text-natural-text-main leading-tight">{item.title}</h4>
                            <div className="flex items-center gap-1 text-[9px] font-bold text-natural-text-light uppercase opacity-60">
                              <Clock className="w-2.5 h-2.5" />
                              {item.time}
                            </div>
                          </div>
                          <p className="text-[11px] text-natural-text-light leading-snug">{item.message}</p>
                        </div>
                        <button 
                          onClick={() => removeNotification(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-natural-border rounded transition-all"
                        >
                          <X className="w-3 h-3 text-natural-text-light" />
                        </button>
                      </div>
                      {item.unread && (
                        <div className="absolute right-2 top-11 w-1.5 h-1.5 bg-natural-accent rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-natural-bg/50 border-t border-natural-border text-center">
              <button 
                onClick={() => {
                  if (onViewAllLogs) onViewAllLogs();
                }}
                className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-accent transition-colors"
              >
                View All Activity Logs
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
