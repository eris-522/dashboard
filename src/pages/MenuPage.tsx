import React from 'react';
import { Search, Plus, Filter, MoreVertical, Utensils, Zap, Clock, Star, X, Edit3, Archive, Trash2, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMenu } from '../context/MenuContext';

const categories = ['All', 'Main Course', 'Appetizers', 'Desserts', 'Beverages', 'Archived'];

export function MenuPage() {
  const [activeCategory, setActiveCategory] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const { menuItems, addMenuItem, updateMenuItem, archiveMenuItem } = useMenu();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<any | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    category: 'Main Course',
  });
  
  const [confirmAction, setConfirmAction] = React.useState<{
    type: 'create' | 'edit' | 'archive';
    itemId?: number;
    itemName: string;
  } | null>(null);

  /**
   * Memoized filter for menu items based on:
   * 1. Active category selection (handling 'All' and 'Archived' specifically)
   * 2. Global search query string
   */
  const filteredItems = React.useMemo(() => {
    return menuItems.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = item.name.toLowerCase().includes(query) || 
                           item.category.toLowerCase().includes(query);
      
      if (activeCategory === 'Archived') {
        return item.status === 'Archived' && matchesSearch;
      }
      
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const isNotArchived = item.status !== 'Archived';
      return matchesCategory && matchesSearch && isNotArchived;
    });
  }, [activeCategory, searchQuery, menuItems]);

  /**
   * Resets form and opens modal for a new menu item entry.
   */
  const handleAddClick = () => {
    setEditingItem(null);
    setFormData({ name: '', category: 'Main Course' });
    setIsModalOpen(true);
  };

  /**
   * Loads item data and opens modal for editing an existing item.
   */
  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setFormData({ name: item.name, category: item.category });
    setIsModalOpen(true);
  };

  /**
   * Triggers the archive confirmation workflow for a specific item.
   */
  const handleArchiveClick = (item: any) => {
    setConfirmAction({
      type: 'archive',
      itemId: item.id,
      itemName: item.name
    });
  };

  /**
   * Moves from form entry to the second confirmation dialog stage.
   */
  const handleConfirmSave = () => {
    setIsModalOpen(false);
    setConfirmAction({
      type: editingItem ? 'edit' : 'create',
      itemId: editingItem?.id,
      itemName: formData.name || 'New Dish'
    });
  };

  /**
   * Finalizes the data change (Create/Update/Archive) after final user confirmation.
   */
  const handleExecuteAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'create') {
      addMenuItem({
        name: formData.name,
        category: formData.category
      });
    } else if (confirmAction.type === 'edit' && confirmAction.itemId !== undefined) {
      updateMenuItem(confirmAction.itemId, {
        name: formData.name,
        category: formData.category
      });
    } else if (confirmAction.type === 'archive' && confirmAction.itemId !== undefined) {
      archiveMenuItem(confirmAction.itemId);
    }

    setConfirmAction(null);
    setEditingItem(null);
    setFormData({ name: '', category: 'Main Course' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">Menu Catalog</h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">Design and manage your catering selections</p>
        </div>
        
        <button 
          onClick={handleAddClick}
          className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New Dish
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-1.5 rounded-full text-[0.7rem] font-bold uppercase tracking-widest transition-all whitespace-nowrap border",
              activeCategory === cat
                ? "bg-natural-accent text-white border-natural-accent shadow-sm"
                : "bg-white text-natural-text-light border-natural-border hover:bg-natural-bg"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="glass-card bg-white overflow-hidden shadow-sm border border-natural-border/50">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between bg-natural-bg/5">
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="Search dishes or ingredients..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
              {filteredItems.length} Dishes Found
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-natural-border">
          {filteredItems.map((item) => (
            <div key={item.id} className={cn(
              "p-6 hover:bg-natural-bg/10 transition-all flex flex-col group relative",
              item.status === 'Archived' && "bg-natural-bg/40 opacity-60 grayscale-[0.5]"
            )}>
              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.status !== 'Archived' ? (
                  <>
                    <button 
                      onClick={() => handleEditClick(item)}
                      className="p-1.5 text-natural-text-light hover:text-natural-accent hover:bg-white hover:shadow-xs rounded-lg transition-all"
                      title="Edit Dish"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleArchiveClick(item)}
                      className="p-1.5 text-natural-text-light hover:text-red-500 hover:bg-white hover:shadow-xs rounded-lg transition-all"
                      title="Archive Dish"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-[0.6rem] font-bold text-natural-text-light/40 uppercase tracking-widest bg-natural-bg/50 px-2 py-1 rounded">Archived</span>
                )}
              </div>
              
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-natural-bg border border-natural-border rounded-xl">
                  <Utensils className="w-6 h-6 text-natural-accent opacity-70" />
                </div>
              </div>

              <div className="mb-2">
                <p className="text-[0.6rem] font-bold text-natural-accent uppercase tracking-[0.15em] mb-1">{item.category}</p>
                <h4 className="text-base font-bold text-natural-text-main tracking-tight leading-snug">{item.name}</h4>
              </div>

              <div className="mt-auto pt-6 flex items-center justify-between">
                <span className="text-[0.65rem] font-bold text-natural-text-light/60 uppercase tracking-widest">
                  ID: #{item.id.toString().padStart(3, '0')}
                </span>
                <span className={cn(
                  "text-[0.65rem] font-bold px-2 py-0.5 rounded border uppercase tracking-wider",
                  item.status === 'Archived' 
                    ? "text-gray-500 bg-gray-50 border-gray-200" 
                    : "text-green-600 bg-green-50 border-green-100"
                )}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full p-20 text-center">
              <Utensils className="w-12 h-12 text-natural-text-light/20 mx-auto mb-4" />
              <p className="text-natural-text-light font-medium">No dishes found in this category.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-natural-bg/10 text-center border-t border-natural-border">
          <button className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-[0.2em] hover:text-natural-accent transition-colors">
            Load More Specialties
          </button>
        </div>
      </div>

      {/* Add/Edit Dish Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-natural-border">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-natural-text-main">
                {editingItem ? 'Edit Dish' : 'Add New Dish'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 hover:bg-natural-bg rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Dish Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Adobo Special"
                  className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Category</label>
                <select 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all font-medium"
                >
                  {categories.filter(c => c !== 'All' && c !== 'Archived').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-[0.65rem] font-bold text-natural-text-light uppercase tracking-[0.2em] hover:text-natural-text-main transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmSave}
                disabled={!formData.name}
                className="bg-natural-accent text-white px-8 py-2.5 rounded-xl text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-natural-accent/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingItem ? 'Save Changes' : 'Add Dish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border">
            <div className="p-8 text-center">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0",
                confirmAction.type === 'create' ? "bg-blue-600 shadow-blue-200" : 
                confirmAction.type === 'edit' ? "bg-natural-accent shadow-natural-accent/20" : 
                "bg-red-600 shadow-red-200"
              )}>
                {confirmAction.type === 'create' && <Plus className="w-8 h-8 text-white" />}
                {confirmAction.type === 'edit' && <Edit3 className="w-8 h-8 text-white" />}
                {confirmAction.type === 'archive' && <Archive className="w-8 h-8 text-white" />}
              </div>
              
              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                {confirmAction.type === 'create' ? 'Add to Catalog?' : 
                 confirmAction.type === 'edit' ? 'Update Dish?' : 
                 'Archive Dish?'}
              </h3>
              
              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                {confirmAction.type === 'create' ? (
                  <>Are you sure you want to add <span className="font-bold text-natural-text-main">{confirmAction.itemName}</span> to your menu catalog?</>
                ) : confirmAction.type === 'edit' ? (
                  <>You are about to update the details for <span className="font-bold text-natural-text-main">{confirmAction.itemName}</span>. Continue?</>
                ) : (
                  <>This will move <span className="font-bold text-natural-text-main">{confirmAction.itemName}</span> to the archives. It will no longer appear in the active catalog.</>
                )}
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleExecuteAction}
                  className={cn(
                    "w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white transition-all shadow-md active:scale-[0.98]",
                    confirmAction.type === 'create' ? "bg-blue-600 hover:bg-blue-700" : 
                    confirmAction.type === 'edit' ? "bg-natural-accent hover:bg-natural-accent/90" : 
                    "bg-red-600 hover:bg-red-700"
                  )}
                >
                  Confirm {confirmAction.type}
                </button>
                <button 
                  onClick={() => setConfirmAction(null)}
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
