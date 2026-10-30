import { AlertTriangle, ChevronRight, PackageSearch, Boxes, ArrowUpRight } from 'lucide-react';
import { useInventory, normalizeStockStatus } from '../context/InventoryContext';

/**
 * Renders a summary of current equipment monitoring levels with visual progress bars.
 * Highlights items that require restocking or external outsourcing (renting) based on current events.
 */
export function InventorySummary({ onViewAll }: { onViewAll?: () => void }) {
  const { items, getAllocatedStock, getOutsourcedStock } = useInventory();
  
  const activeItems = items.filter(item => item.status !== 'Archived' && item.status?.toLowerCase() !== 'archived');
  const totalOutsourced = activeItems.reduce((acc, i) => acc + getOutsourcedStock(i.id), 0);

  // Lowest stock first (by stock level vs. minimum required); ties fall back to name for a stable order
  const stockRatio = (i: (typeof activeItems)[number]) => i.stock / Math.max(1, i.minStock);
  const sortedItems = [...activeItems].sort((a, b) =>
    stockRatio(a) - stockRatio(b) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
    String(a.id).localeCompare(String(b.id))
  );

  // Show enough rows to fill the card, matching the Recent Audit Trail height
  const displayItems = sortedItems.slice(0, 9);
  const restockNeededCount = activeItems.filter(i => normalizeStockStatus(i.status) === 'Low').length;
  const totalAllocated = activeItems.reduce((acc, i) => acc + getAllocatedStock(i.id), 0);

  return (
    <div className="glass-card p-6 h-full flex flex-col bg-white dark:bg-natural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif">Equipment Monitoring Overview</h3>
          <p className="text-[0.7rem] text-natural-text-light font-medium uppercase tracking-wider">Status of catering equipment & supplies</p>
        </div>
        <button 
          onClick={onViewAll}
          className="text-[0.7rem] font-bold text-natural-accent hover:underline flex items-center uppercase tracking-widest cursor-pointer"
        >
          View All <ChevronRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-3">
        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-natural-text-light opacity-60">
            <PackageSearch className="w-8 h-8 mb-2" />
            <p className="text-[0.7rem] font-serif italic">No equipment monitoring records</p>
          </div>
        ) : (
          displayItems.map((item) => {
            const allocated = getAllocatedStock(item.id);
            const outsourced = getOutsourcedStock(item.id);
            const stockPercentage = Math.min(((item.stock / Math.max(1, item.minStock * 2)) * 100), 100);
            return (
              <div key={item.id} className="space-y-1.5 py-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[0.8rem] font-medium text-natural-text-main">{item.name}</span>
                    {allocated > 0 && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-1.5 py-0.2 rounded">
                        {allocated} in-use
                      </span>
                    )}
                    {outsourced > 0 && (
                      <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/70 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <ArrowUpRight className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        +{outsourced.toLocaleString()} to outsource
                      </span>
                    )}
                  </div>
                  <span className="text-[0.65rem] font-bold text-natural-text-light uppercase">{item.stock} {item.unit}</span>
                </div>
                <div className="h-[6px] w-full bg-[#efeee7] dark:bg-natural-bg rounded-full overflow-hidden">
                  {(() => {
                    const s = normalizeStockStatus(item.status);
                    return (
                      <div 
                        className={`h-full transition-all duration-500 ${
                          s === 'High' ? 'bg-[#6b8e23]' : s === 'Normal' ? 'bg-amber-400' : 'bg-red-500'
                        }`} 
                        style={{ width: `${stockPercentage}%` }} 
                      />
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`mt-6 pt-4 border-t border-natural-border/60 grid ${totalOutsourced > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-natural-bg/50 border border-natural-border">
          <AlertTriangle className="w-4 h-4 text-natural-accent shrink-0" />
          <div>
            <span className="text-[9px] font-bold text-natural-text-light uppercase tracking-wider block">Low Stock</span>
            <span className="text-xs font-bold text-natural-accent">{restockNeededCount} Items</span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-natural-bg/50 border border-natural-border">
          <Boxes className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <span className="text-[9px] font-bold text-natural-text-light uppercase tracking-wider block">In-Use</span>
            <span className="text-xs font-bold text-green-700 dark:text-emerald-400">{totalAllocated.toLocaleString()} Units</span>
          </div>
        </div>

        {totalOutsourced > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
            <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">Outsourced</span>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{totalOutsourced.toLocaleString()} Units</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const EquipmentMonitoringSummary = InventorySummary;
