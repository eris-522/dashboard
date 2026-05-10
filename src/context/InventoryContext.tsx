import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../utils/supabase';

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  status: 'Healthy' | 'Low Stock' | 'Critical' | 'Archived';
}

interface InventoryContextType {
  items: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  refreshItems: (silent?: boolean) => Promise<void>;
  addItem: (item: Omit<InventoryItem, 'id' | 'status'>) => Promise<void>;
  updateStock: (id: number, quantity: number) => Promise<void>;
  archiveItem: (id: number) => Promise<void>;
  updateItem: (id: number, updates: Partial<InventoryItem>) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

/**
 * Determines the stock status based on current quantity and defined minimum levels.
 * @param stock Current quantity in inventory.
 * @param minStock Threshold for low stock warning.
 * @returns 'Healthy', 'Low Stock', or 'Critical' status string.
 */
export const getStatus = (stock: number, minStock: number): 'Healthy' | 'Low Stock' | 'Critical' => {
  if (stock <= minStock * 0.5) return 'Critical';
  if (stock <= minStock) return 'Low Stock';
  return 'Healthy';
};

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshItems = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .order('name');
        
      if (fetchError) throw fetchError;
      
      if (data) {
        const mapped = data.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          stock: item.stock,
          minStock: item.min_stock,
          unit: item.unit,
          status: item.status || getStatus(item.stock, item.min_stock)
        }));
        setItems(mapped);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error("Error fetching inventory:", msg);
      setError(msg);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshItems();

    const intervalId = setInterval(() => refreshItems(true), 10000);

    const channel = supabase
      .channel("inventory-channel-context")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => {
          refreshItems(true);
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

  /**
   * Adds a new item to the inventory and automatically sets its initial status.
   * @param newItem Item details excluding ID and auto-calculated status.
   */
  const addItem = async (newItem: Omit<InventoryItem, 'id' | 'status'>) => {
    const status = getStatus(newItem.stock, newItem.minStock);
    
    // Optimistic UI update
    const tempId = Date.now();
    setItems(prev => [...prev, { ...newItem, id: tempId, status }]);

    const { error: insertError } = await supabase.from('inventory').insert([{
      name: newItem.name,
      category: newItem.category,
      stock: newItem.stock,
      min_stock: newItem.minStock,
      unit: newItem.unit,
      status: status
    }]);

    if (insertError) {
      console.error("Error adding item:", insertError);
      alert("Supabase Error: " + insertError.message);
    }
    refreshItems(true);
  };

  /**
   * Modifies the stock level of an item and updates its status accordingly.
   * @param id The unique identifier of the item.
   * @param quantity The amount to add (positive) or subtract (negative).
   */
  const updateStock = async (id: number, quantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newStock = item.stock + quantity;
        return {
          ...item,
          stock: newStock,
          status: getStatus(newStock, item.minStock)
        };
      }
      return item;
    }));

    const item = items.find(i => i.id === id);
    if (item) {
      const newStock = item.stock + quantity;
      const newStatus = item.status === 'Archived' ? 'Archived' : getStatus(newStock, item.minStock);
      const { error: updateError } = await supabase.from('inventory').update({
        stock: newStock,
        status: newStatus
      }).eq('id', id);

      if (updateError) {
        console.error("Error updating stock:", updateError);
        alert("Supabase Error: " + updateError.message);
        refreshItems(true);
      }
    }
  };

  const archiveItem = async (id: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'Archived' } : item));
    
    const { error: archiveError } = await supabase.from('inventory').update({ status: 'Archived' }).eq('id', id);
    
    if (archiveError) {
      console.error("Error archiving item:", archiveError);
      alert("Supabase Error: " + archiveError.message);
      refreshItems(true);
    }
  };

  const updateItem = async (id: number, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, ...updates };
        if (updates.stock !== undefined || updates.minStock !== undefined) {
          updatedItem.status = updatedItem.status === 'Archived' ? 'Archived' : getStatus(updatedItem.stock, updatedItem.minStock);
        }
        return updatedItem;
      }
      return item;
    }));

    const item = items.find(i => i.id === id);
    if (item) {
      const newStock = updates.stock !== undefined ? updates.stock : item.stock;
      const newMinStock = updates.minStock !== undefined ? updates.minStock : item.minStock;
      const newStatus = item.status === 'Archived' ? 'Archived' : getStatus(newStock, newMinStock);

      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
      if (updates.minStock !== undefined) dbUpdates.min_stock = updates.minStock;
      if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
      dbUpdates.status = newStatus;

      const { error: updateError } = await supabase.from('inventory').update(dbUpdates).eq('id', id);
      
      if (updateError) {
        console.error("Error updating item:", updateError);
        alert("Supabase Error: " + updateError.message);
        refreshItems(true);
      }
    }
  };

  return (
    <InventoryContext.Provider value={{ items, isLoading, error, refreshItems, addItem, updateStock, archiveItem, updateItem }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
