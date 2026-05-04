import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  status: 'Healthy' | 'Low Stock' | 'Critical';
}

interface InventoryContextType {
  items: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id' | 'status'>) => void;
  updateStock: (id: number, quantity: number) => void;
  removeItem: (id: number) => void;
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

  /**
   * Adds a new item to the inventory and automatically sets its initial status.
   * @param newItem Item details excluding ID and auto-calculated status.
   */
  const addItem = (newItem: Omit<InventoryItem, 'id' | 'status'>) => {
    const item: InventoryItem = {
      ...newItem,
      id: Date.now(),
      status: getStatus(newItem.stock, newItem.minStock)
    };
    setItems(prev => [...prev, item]);
  };

  /**
   * Modifies the stock level of an item and updates its status accordingly.
   * @param id The unique identifier of the item.
   * @param quantity The amount to add (positive) or subtract (negative).
   */
  const updateStock = (id: number, quantity: number) => {
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
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <InventoryContext.Provider value={{ items, addItem, updateStock, removeItem }}>
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
