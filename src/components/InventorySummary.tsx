import { AlertTriangle, ChevronRight, PackageSearch } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

/**
 * Renders a summary of current inventory levels with visual progress bars.
 * Highlights items that require restocking based on their status.
 */
export function InventorySummary({ onViewAll }: { onViewAll?: () => void }) {
  const { items } = useInventory();
  
  const activeItems = items.filter(item => item.status !== 'Archived' && item.status?.toLowerCase() !== 'archived');
  const displayItems = activeItems.slice(0, 5);
  const restockNeededCount = activeItems.filter(i => i.status !== 'Healthy').length;

  return (
    <div className="glass-card p-6 h-full flex flex-col bg-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif">Inventory Overview</h3>
          <p className="text-[0.7rem] text-natural-text-light font-medium uppercase tracking-wider">Status of catering equipment</p>
        </div>
        <button 
          onClick={onViewAll}
          className="text-[0.7rem] font-bold text-natural-accent hover:underline flex items-center uppercase tracking-widest"
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
            const stockPercentage = Math.min(((item.stock / (item.minStock * 2)) * 100), 100);
            return (
              <div key={item.id} className="space-y-2 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-[0.8rem] font-medium text-natural-text-main">{item.name}</span>
                  <span className="text-[0.6rem] font-bold text-natural-text-light uppercase">{item.stock} {item.unit}</span>
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

      <div className="mt-8 flex items-center justify-between p-4 rounded-xl bg-natural-bg border border-natural-border shadow-xs">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-natural-accent" />
          <span className="text-xs font-semibold text-natural-text-main">Stock Alert</span>
        </div>
        <span className="text-[10px] font-bold text-natural-accent uppercase tracking-widest px-2 py-1 bg-white rounded-lg border border-natural-border">
          {restockNeededCount} {restockNeededCount === 1 ? 'Action' : 'Actions'} Needed
        </span>
      </div>
    </div>
  );
}
