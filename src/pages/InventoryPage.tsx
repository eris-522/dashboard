import React from 'react';
import { Search, Plus, Filter, MoreVertical, PackageSearch, AlertTriangle, ArrowUpRight, ArrowDownRight, Warehouse, X, CheckCircle2, Trash2, Archive, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useInventory, InventoryItem, getStatus } from '../context/InventoryContext';

const categories = ['Event Equipment', 'Furniture', 'Decor & Ceremony Items', 'Linen & Styling', 'Tableware'];
const units = ['pcs', 'sets', 'boxes', 'packs', 'kg', 'g', 'lbs', 'L', 'ml'];

export function InventoryPage() {
  const { items, isLoading, addItem, updateStock, archiveItem, updateItem } = useInventory();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState('All');
  const [showArchived, setShowArchived] = React.useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = React.useState(false);
  const [selectedItemId, setSelectedItemId] = React.useState<number | null>(null);
  const [updateQuantity, setUpdateQuantity] = React.useState<number>(0);
  const [editName, setEditName] = React.useState('');
  const [editCategory, setEditCategory] = React.useState('Event Equipment');
  const [editMinStock, setEditMinStock] = React.useState<number>(10);
  const [confirmUpdate, setConfirmUpdate] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [itemToArchive, setItemToArchive] = React.useState<number | null>(null);
  const [sortStatus, setSortStatus] = React.useState<'asc' | 'desc' | null>(null);

  const [newItem, setNewItem] = React.useState<Partial<InventoryItem>>({
    name: '',
    category: 'Event Equipment',
    stock: undefined,
    minStock: 10,
    unit: 'pcs'
  });

  /**
   * Finalizes the addition of a new item stock to the inventory.
   */
  const handleAddItem = () => {
    if (!newItem.name || !newItem.category || newItem.stock === undefined || newItem.minStock === undefined) return;
    
    const nameRegex = /^[a-zA-Z\sñÑ\-']+$/;
    if (!nameRegex.test(newItem.name)) {
      setFormError("Item name cannot contain numbers or special characters.");
      return;
    }

    addItem({
      name: newItem.name,
      category: newItem.category,
      stock: newItem.stock,
      minStock: newItem.minStock,
      unit: newItem.unit || 'pcs',
    });

    setIsAddModalOpen(false);
    setFormError(null);
    setNewItem({ name: '', category: 'Event Equipment', stock: undefined, minStock: 10, unit: 'pcs' });
  };

  /**
   * Applies a numeric adjustment (positive for restock, negative for consumption) to an item's stock level.
   */
  const handleUpdateStock = () => {
    if (selectedItemId === null) return;
    
    if (updateQuantity !== 0) {
      updateStock(selectedItemId, updateQuantity);
    }
    
    const currentItem = items.find(i => i.id === selectedItemId);
    if (updateItem && currentItem && (editName !== currentItem.name || editCategory !== currentItem.category || editMinStock !== currentItem.minStock)) {
      updateItem(selectedItemId, { name: editName, category: editCategory, minStock: editMinStock });
    }

    setIsUpdateModalOpen(false);
    setSelectedItemId(null);
    setUpdateQuantity(0);
    setEditName('');
    setEditCategory('Event Equipment');
    setEditMinStock(10);
    setFormError(null);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory || (filterCategory === 'Event Equipment' && item.category === 'Equipment');
    const matchesStatus = showArchived ? item.status === 'Archived' : item.status !== 'Archived';
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortedItems = React.useMemo(() => {
    if (!sortStatus) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      const statusOrder: Record<string, number> = {
        'Critical': 1,
        'Low Stock': 2,
        'Healthy': 3,
        'Archived': 4
      };
      const valA = statusOrder[a.status] || 5;
      const valB = statusOrder[b.status] || 5;
      if (valA < valB) return sortStatus === 'asc' ? -1 : 1;
      if (valA > valB) return sortStatus === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortStatus]);

  const activeItems = items.filter(i => i.status !== 'Archived');
  const stats = {
    totalItemStock: activeItems.length,
    restockNeeded: activeItems.filter(i => i.status !== 'Healthy').length,
    lastUpdate: activeItems.length > 0 ? 'Just now' : 'Never'
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
            onClick={() => { setIsUpdateModalOpen(true); setFormError(null); }}
            className="flex items-center gap-2 px-4 py-2.5 border border-natural-border rounded-lg text-sm font-semibold text-natural-text-main hover:bg-natural-bg transition-all"
          >
            Quick Update
          </button>
          <button 
            onClick={() => { setIsAddModalOpen(true); setFormError(null); }}
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
            <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest">Total Item Stock</p>
            <h4 className="text-2xl font-bold font-serif text-natural-text-main">{stats.totalItemStock} Items</h4>
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
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowArchived(false)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all w-full md:w-auto",
                  !showArchived
                    ? "bg-natural-accent text-white shadow-sm"
                    : "bg-natural-bg text-natural-text-light hover:text-natural-text-main",
                )}
              >
                Active
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 w-full md:w-auto",
                  showArchived
                    ? "bg-natural-text-main text-white shadow-sm"
                    : "bg-natural-bg text-natural-text-light hover:text-natural-text-main",
                )}
              >
                <Archive className="w-3.5 h-3.5" />
                Archived
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 border border-natural-border rounded-lg bg-white transition-colors hover:bg-natural-bg focus-within:ring-2 focus-within:ring-natural-accent/10">
              <Filter className="w-3.5 h-3.5 text-natural-text-main" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-xs font-bold text-natural-text-main bg-transparent outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-natural-text-light">
              <div className="w-8 h-8 border-4 border-natural-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-serif italic">Loading inventory...</p>
            </div>
          ) : items.length === 0 ? (
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
                  <th 
                    className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                    onClick={() => setSortStatus(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}
                  >
                    <div className="flex items-center gap-1.5">
                      Status
                      {sortStatus === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-natural-accent" />
                      ) : sortStatus === 'desc' ? (
                        <ArrowDown className="w-3 h-3 text-natural-accent" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border"></th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const stockPercentage = item.status === 'Archived' ? 0 : Math.min(((item.stock / (item.minStock * 2)) * 100), 100);
                  return (
                    <tr key={item.id} className={cn(
                      "transition-colors group",
                      item.status === 'Archived' ? "bg-natural-bg/40 opacity-60 grayscale-[0.5]" : "hover:bg-natural-bg/20"
                    )}>
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
                                 item.status === 'Healthy' ? "bg-[#6b8e23]" : item.status === 'Low Stock' ? "bg-orange-400" : item.status === 'Archived' ? "bg-gray-400" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
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
                            item.status === 'Healthy' ? "bg-[#6b8e23]" : item.status === 'Low Stock' ? "bg-orange-400" : item.status === 'Archived' ? "bg-gray-400" : "bg-red-500"
                          )} />
                          <span className={cn(
                            "text-[0.65rem] font-bold uppercase tracking-widest",
                            item.status === 'Healthy' ? "text-[#6b8e23]" : item.status === 'Low Stock' ? "text-orange-500" : item.status === 'Archived' ? "text-gray-500" : "text-red-500"
                          )}>
                            {item.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 border-b border-natural-border/50 text-right">
                        <div className="flex justify-end gap-2">
                          {item.status !== 'Archived' ? (
                            <>
                          <button 
                            onClick={() => { 
                              setSelectedItemId(item.id); 
                              setEditName(item.name);
                              setEditCategory(item.category);
                              setEditMinStock(item.minStock);
                              setFormError(null);
                              setIsUpdateModalOpen(true); 
                            }}
                            className="p-1.5 text-natural-text-light hover:text-natural-accent hover:bg-natural-accent/5 rounded-lg transition-all"
                            title="Quick Update"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setItemToArchive(item.id)}
                            className="p-1.5 text-natural-text-light hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Archive Item"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                            </>
                          ) : (
                            <span className="text-[0.6rem] font-bold text-natural-text-light/40 uppercase tracking-widest bg-natural-bg/50 px-2 py-1 rounded">
                              Archived
                            </span>
                          )}
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
              <h3 className="text-xl font-serif font-bold text-natural-text-main">Add New Item</h3>
              <button onClick={() => { setIsAddModalOpen(false); setFormError(null); }} className="p-1 hover:bg-natural-bg rounded-lg">
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-600">{formError}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Item Name</label>
                <input 
                  type="text"
                  value={newItem.name}
                  onChange={(e) => { setNewItem({...newItem, name: e.target.value}); setFormError(null); }}
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
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white cursor-pointer"
                  >
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Current Stock</label>
                  <input 
                    type="number"
                    value={newItem.stock ?? ''}
                    onChange={(e) => setNewItem({...newItem, stock: e.target.value === '' ? undefined : Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Min. Required</label>
                  <input 
                    type="number"
                    value={newItem.minStock ?? ''}
                    onChange={(e) => setNewItem({...newItem, minStock: e.target.value === '' ? undefined : Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button 
                onClick={() => { setIsAddModalOpen(false); setFormError(null); }}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                Quick Update
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-600">{formError}</p>
                </div>
              )}
              {!selectedItemId ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Select Item to Update</label>
                    <span className="text-[0.6rem] font-bold text-natural-accent bg-natural-accent/10 px-2 py-0.5 rounded">Needs Attention</span>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {items
                      .filter(i => i.status === 'Critical' || i.status === 'Low Stock')
                      .sort((a, b) => {
                        if (a.status === 'Critical' && b.status !== 'Critical') return -1;
                        if (a.status !== 'Critical' && b.status === 'Critical') return 1;
                        return 0;
                      })
                      .map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setEditName(item.name);
                            setEditCategory(item.category);
                            setEditMinStock(item.minStock);
                            setFormError(null);
                          }}
                          className={cn(
                            "w-full text-left p-4 rounded-xl border-2 transition-all relative overflow-hidden group",
                            selectedItemId === item.id 
                              ? "border-natural-accent bg-natural-accent/5 ring-2 ring-natural-accent/10" 
                              : item.status === 'Critical'
                                ? "border-red-200 bg-red-50/50 hover:bg-red-50 hover:border-red-300"
                                : "border-orange-200 bg-orange-50/50 hover:bg-orange-50 hover:border-orange-300"
                          )}
                        >
                          <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1.5",
                            item.status === 'Critical' ? "bg-red-500" : "bg-orange-400"
                          )} />
                          <div className="pl-2 flex justify-between items-center">
                            <div>
                              <p className="text-base font-bold text-natural-text-main">{item.name}</p>
                              <p className="text-xs text-natural-text-light uppercase mt-1">
                                Stock: <span className={cn("font-bold", item.status === 'Critical' ? "text-red-600" : "text-orange-600")}>{item.stock}</span> / {item.minStock} {item.unit}
                              </p>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md",
                              item.status === 'Critical' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                            )}>
                              {item.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    {items.filter(i => i.status === 'Critical' || i.status === 'Low Stock').length === 0 && (
                      <div className="p-8 text-center border-2 border-dashed border-natural-border rounded-xl">
                        <CheckCircle2 className="w-8 h-8 text-[#6b8e23] mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-bold text-natural-text-main">All caught up!</p>
                        <p className="text-xs text-natural-text-light mt-1">No items are currently low on stock.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-natural-bg/50 rounded-2xl border border-natural-border space-y-4">
                   <div className="space-y-3">
                     <div className="space-y-1">
                       <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Item Name</label>
                       <input 
                         type="text" 
                         value={editName}
                         onChange={(e) => { setEditName(e.target.value); setFormError(null); }}
                         className="w-full px-3 py-2 bg-white border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Category</label>
                       <select 
                         value={editCategory}
                         onChange={(e) => setEditCategory(e.target.value)}
                         className="w-full px-3 py-2 bg-white border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all cursor-pointer"
                       >
                         {categories.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                     </div>
                     <div className="space-y-1">
                       <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Min. Required Stock</label>
                       <input 
                         type="number" 
                         value={editMinStock}
                         onChange={(e) => setEditMinStock(Number(e.target.value))}
                         className="w-full px-3 py-2 bg-white border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all"
                       />
                     </div>
                   </div>
                   
                   <div className="pt-3 border-t border-natural-border/50">
                     <p className="text-[10px] text-natural-text-light">Current Stock: {items.find(i => i.id === selectedItemId)?.stock}/{items.find(i => i.id === selectedItemId)?.minStock} {items.find(i => i.id === selectedItemId)?.unit}</p>
                     <button onClick={() => setSelectedItemId(null)} className="text-[10px] text-natural-accent font-bold uppercase mt-1 hover:underline">Change Item</button>
                   </div>
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
                onClick={() => { setIsUpdateModalOpen(false); setSelectedItemId(null); setUpdateQuantity(0); setEditName(''); setEditCategory('Event Equipment'); setEditMinStock(10); setFormError(null); }}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                   const nameRegex = /^[a-zA-Z\sñÑ\-']+$/;
                   if (editName && !nameRegex.test(editName)) {
                     setFormError("Item name cannot contain numbers or special characters.");
                     return;
                   }
                   setFormError(null);
                   setIsUpdateModalOpen(false); 
                   setConfirmUpdate(true); 
                }}
                disabled={!selectedItemId || (updateQuantity === 0 && editName === items.find(i => i.id === selectedItemId)?.name && editCategory === items.find(i => i.id === selectedItemId)?.category && editMinStock === items.find(i => i.id === selectedItemId)?.minStock)}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 disabled:opacity-50"
              >
                Apply Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Confirmation Modal */}
      {confirmUpdate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border relative">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0 bg-natural-accent shadow-natural-accent/20">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                Confirm Update?
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                You are about to update the details and stock for <span className="font-bold text-natural-text-main">{items.find(i => i.id === selectedItemId)?.name || editName}</span>. Continue?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    handleUpdateStock();
                    setConfirmUpdate(false);
                  }}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white bg-natural-accent hover:bg-natural-accent/90 transition-all shadow-md active:scale-[0.98]"
                >
                  Confirm Update
                </button>
                <button
                  onClick={() => {
                    setConfirmUpdate(false);
                    setIsUpdateModalOpen(true);
                  }}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all active:scale-[0.98]"
                >
                  Back to Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {itemToArchive !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border relative">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0 bg-gray-600 shadow-gray-200">
                <Archive className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                Archive Item?
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                Are you sure you want to move <span className="font-bold text-natural-text-main">{items.find(i => i.id === itemToArchive)?.name}</span> to the archives? It will be hidden from active views.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    archiveItem(itemToArchive);
                    setItemToArchive(null);
                  }}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white bg-gray-800 hover:bg-gray-900 transition-all shadow-md active:scale-[0.98]"
                >
                  Confirm Archive
                </button>
                <button
                  onClick={() => setItemToArchive(null)}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
