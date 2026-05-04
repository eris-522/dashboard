import React from 'react';
import { Search, Plus, Filter, MoreVertical, PackageSearch, AlertTriangle, ArrowUpRight, ArrowDownRight, Warehouse, X, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useInventory, InventoryItem, getStatus } from '../context/InventoryContext';

const categories = ['Equipment', 'Furniture', 'Linens', 'Tableware', 'Kitchen', 'Other'];

export function InventoryPage() {
  const { items, addItem, updateStock, removeItem } = useInventory();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = React.useState(false);
  const [selectedItemId, setSelectedItemId] = React.useState<number | null>(null);
  const [updateQuantity, setUpdateQuantity] = React.useState<number>(0);

  const [newItem, setNewItem] = React.useState<Partial<InventoryItem>>({
    name: '',
    category: 'Equipment',
    stock: 0,
    minStock: 10,
    unit: 'pcs'
  });

  /**
   * Finalizes the addition of a new stock-keeping unit (SKU) to the inventory.
   */
  const handleAddItem = () => {
    if (!newItem.name || !newItem.category || newItem.stock === undefined || newItem.minStock === undefined) return;
    
    addItem({
      name: newItem.name,
      category: newItem.category,
      stock: newItem.stock,
      minStock: newItem.minStock,
      unit: newItem.unit || 'pcs',
    });

    setIsAddModalOpen(false);
    setNewItem({ name: '', category: 'Equipment', stock: 0, minStock: 10, unit: 'pcs' });
  };

  /**
   * Applies a numeric adjustment (positive for restock, negative for consumption) to an item's stock level.
   */
  const handleUpdateStock = () => {
    if (selectedItemId === null) return;
    updateStock(selectedItemId, updateQuantity);
    setIsUpdateModalOpen(false);
    setSelectedItemId(null);
    setUpdateQuantity(0);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalSKU: items.length,
    restockNeeded: items.filter(i => i.status !== 'Healthy').length,
    lastUpdate: items.length > 0 ? 'Just now' : 'Never'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">Inventory Management</h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">Monitor and restock catering supplies</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
            onClick={() => setIsUpdateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-natural-border rounded-lg text-sm font-semibold text-natural-text-main hover:bg-natural-bg transition-all"
          >
            Update Stock
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Item
          </button>
        </div>
      </div>

      {/* Inventory Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex items-center gap-4 bg-white">
          <div className="p-3 bg-natural-bg rounded-xl border border-natural-border">
            <Warehouse className="w-6 h-6 text-natural-accent" />
          </div>
          <div>
            <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest">Total SKU</p>
            <h4 className="text-2xl font-bold font-serif text-natural-text-main">{stats.totalSKU} Items</h4>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-natural-accent bg-white">
          <div className="p-3 bg-natural-accent/10 rounded-xl border border-natural-accent/20">
            <AlertTriangle className="w-6 h-6 text-natural-accent" />
          </div>
          <div>
            <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest">Restock Needed</p>
            <h4 className="text-2xl font-bold font-serif text-natural-accent">{stats.restockNeeded} Items</h4>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center gap-4 bg-white">
          <div className="p-3 bg-natural-bg rounded-xl border border-natural-border">
            <ArrowUpRight className="w-6 h-6 text-[#6b8e23]" />
          </div>
          <div>
            <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest">Recent Activity</p>
            <h4 className="text-2xl font-bold font-serif text-natural-text-main text-[0.9rem] uppercase tracking-tighter">{stats.lastUpdate}</h4>
          </div>
        </div>
      </div>

      <div className="glass-card bg-white overflow-hidden">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by Name or Category..." 
              className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-colors uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              Category
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-natural-text-light">
              <PackageSearch className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-serif italic">Your inventory is empty</p>
              <p className="text-[0.7rem] uppercase tracking-widest mt-1">Start by adding some catering supplies</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-natural-bg/30">
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">Item & Category</th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border text-center">Stock Level</th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">Min. Req</th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">Status</th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const stockPercentage = Math.min(((item.stock / (item.minStock * 2)) * 100), 100);
                  return (
                    <tr key={item.id} className="hover:bg-natural-bg/20 transition-colors group">
                      <td className="px-6 py-5 border-b border-natural-border/50">
                        <div>
                          <p className="text-sm font-bold text-natural-text-main tracking-tight leading-tight">{item.name}</p>
                          <p className="text-[0.65rem] text-natural-text-light font-bold uppercase tracking-widest mt-1">{item.category}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 border-b border-natural-border/50">
                        <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                          <div className="flex justify-between w-full text-[0.65rem] font-bold text-natural-text-main">
                            <span>{item.stock} {item.unit}</span>
                            <span className="opacity-40">{item.minStock > 0 ? Math.round((item.stock / item.minStock) * 100) : 0}%</span>
                          </div>
                          <div className="h-[5px] w-full bg-natural-bg border border-natural-border rounded-full overflow-hidden">
                             <div 
                               className={cn(
                                 "h-full transition-all duration-700",
                                 item.status === 'Healthy' ? "bg-[#6b8e23]" : item.status === 'Low Stock' ? "bg-orange-400" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                               )} 
                               style={{ width: `${stockPercentage}%` }} 
                             />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 border-b border-natural-border/50">
                        <p className="text-xs font-semibold text-natural-text-light">{item.minStock} {item.unit}</p>
                      </td>
                      <td className="px-6 py-5 border-b border-natural-border/50">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            item.status === 'Healthy' ? "bg-[#6b8e23]" : item.status === 'Low Stock' ? "bg-orange-400" : "bg-red-500"
                          )} />
                          <span className={cn(
                            "text-[0.65rem] font-bold uppercase tracking-widest",
                            item.status === 'Healthy' ? "text-[#6b8e23]" : item.status === 'Low Stock' ? "text-orange-500" : "text-red-500"
                          )}>
                            {item.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 border-b border-natural-border/50 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setSelectedItemId(item.id); setIsUpdateModalOpen(true); }}
                            className="p-1.5 text-natural-text-light hover:text-natural-accent hover:bg-natural-accent/5 rounded-lg transition-all"
                            title="Update Stock"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { if(confirm('Are you sure you want to remove this item?')) removeItem(item.id); }}
                            className="p-1.5 text-natural-text-light hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Remove Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">Add New SKU</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-natural-bg rounded-lg">
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Item Name</label>
                <input 
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/10"
                  placeholder="e.g. Silverware Set"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Category</label>
                  <select 
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Unit</label>
                  <input 
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                    placeholder="pcs, sets, etc."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Current Stock</label>
                  <input 
                    type="number"
                    value={newItem.stock}
                    onChange={(e) => setNewItem({...newItem, stock: Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Min. Required</label>
                  <input 
                    type="number"
                    value={newItem.minStock}
                    onChange={(e) => setNewItem({...newItem, minStock: Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddItem}
                disabled={!newItem.name}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 disabled:opacity-50"
              >
                Create Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Stock Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                {selectedItemId ? 'Update Stock' : 'Quick Update'}
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {!selectedItemId ? (
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Select Item to Update</label>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                    {items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all",
                          selectedItemId === item.id 
                            ? "border-natural-accent bg-natural-accent/5 ring-2 ring-natural-accent/10" 
                            : "border-natural-border hover:bg-natural-bg"
                        )}
                      >
                        <p className="text-sm font-bold text-natural-text-main">{item.name}</p>
                        <p className="text-[10px] text-natural-text-light uppercase">{item.stock} {item.unit} available</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-natural-bg/50 rounded-2xl border border-natural-border">
                   <p className="text-xs font-bold text-natural-text-main">{items.find(i => i.id === selectedItemId)?.name}</p>
                   <p className="text-[10px] text-natural-text-light">Current: {items.find(i => i.id === selectedItemId)?.stock} {items.find(i => i.id === selectedItemId)?.unit}</p>
                   <button onClick={() => setSelectedItemId(null)} className="text-[10px] text-natural-accent font-bold uppercase mt-2 hover:underline">Change Item</button>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Adjustment Amount</label>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setUpdateQuantity(q => q - 1)}
                      className="w-10 h-10 rounded-full border border-natural-border flex items-center justify-center text-xl font-serif hover:bg-natural-bg"
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      value={updateQuantity}
                      onChange={(e) => setUpdateQuantity(Number(e.target.value))}
                      className="flex-1 text-center text-xl font-bold font-serif bg-transparent focus:outline-none"
                    />
                    <button 
                      onClick={() => setUpdateQuantity(q => q + 1)}
                      className="w-10 h-10 rounded-full border border-natural-border flex items-center justify-center text-xl font-serif hover:bg-natural-bg"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-natural-text-light text-center mt-2 italic">Use negative values for reduction/outgoing</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button 
                onClick={() => { setIsUpdateModalOpen(false); setSelectedItemId(null); setUpdateQuantity(0); }}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateStock}
                disabled={!selectedItemId || updateQuantity === 0}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 disabled:opacity-50"
              >
                Apply Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

