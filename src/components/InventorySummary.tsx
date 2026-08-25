import { AlertTriangle, ChevronRight, PackageSearch, Boxes, Warehouse } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

/**
 * Renders a summary of current inventory levels with visual progress bars.
 * Highlights items that require restocking based on their status.
 */
export function InventorySummary({ onViewAll }: { onViewAll?: () => void }) {
  const { items, getAllocatedStock } = useInventory();
  
  const activeItems = items.filter(item => item.status !== 'Archived' && item.status?.toLowerCase() !== 'archived');
  const displayItems = activeItems.slice(0, 5);
  const restockNeededCount = activeItems.filter(i => i.status !== 'Healthy').length;
  const totalAllocated = activeItems.reduce((acc, i) => acc + getAllocatedStock(i.id), 0);

  return (
    <div className="glass-card p-6 h-full flex flex-col bg-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif">Inventory Overview</h3>
          <p className="text-[0.7rem] text-natural-text-light font-medium uppercase tracking-wider">Status of catering supplies & equipment</p>
        </div>
        <button 
          onClick={onViewAll}
          className="text-[0.7rem] font-bold text-natural-accent hover:underline flex items-center uppercase tracking-widest cursor-pointer"
        >
          View All <ChevronRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>

      <div className="flex-1 space-y-4">
        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-natural-text-light opacity-60">
            <PackageSearch className="w-8 h-8 mb-2" />
            <p className="text-[0.7rem] font-serif italic">No inventory records</p>
          </div>
        ) : (
          displayItems.map((item) => {
            const allocated = getAllocatedStock(item.id);
            const stockPercentage = Math.min(((item.stock / Math.max(1, item.minStock * 2)) * 100), 100);
            return (
              <div key={item.id} className="space-y-1.5 py-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.8rem] font-medium text-natural-text-main">{item.name}</span>
                    {allocated > 0 && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                        {allocated} allocated
                      </span>
                    )}
                  </div>
                  <span className="text-[0.65rem] font-bold text-natural-text-light uppercase">{item.stock} {item.unit}</span>
                </div>
                <div className="h-[6px] w-full bg-[#efeee7] rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      item.status === 'Healthy' ? 'bg-[#6b8e23]' : item.status === 'Low Stock' ? 'bg-orange-400' : 'bg-red-500'
                    }`} 
                    style={{ width: `${stockPercentage}%` }} 
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-natural-border/60 grid grid-cols-2 gap-3">
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
            <span className="text-[9px] font-bold text-natural-text-light uppercase tracking-wider block">Reserved</span>
            <span className="text-xs font-bold text-green-700">{totalAllocated} Units</span>
          </div>
        </div>
      </div>
    </div>
  );
}
