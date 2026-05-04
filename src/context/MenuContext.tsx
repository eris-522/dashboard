import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  status: 'Available' | 'Archived';
}

interface MenuContextType {
  menuItems: MenuItem[];
  addMenuItem: (item: Omit<MenuItem, 'id' | 'status'>) => void;
  updateMenuItem: (id: number, item: Partial<MenuItem>) => void;
  archiveMenuItem: (id: number) => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

/**
 * Global provider for the menu catalog.
 * Manages all dishes and catering options available for selection in bookings.
 */
export function MenuProvider({ children }: { children: ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  /**
   * Adds a new dish to the menu catalog.
   */
  const addMenuItem = (itemData: Omit<MenuItem, 'id' | 'status'>) => {
    const nextId = menuItems.length > 0 ? Math.max(...menuItems.map(i => i.id)) + 1 : 1;
    const newItem: MenuItem = {
      ...itemData,
      id: nextId,
      status: 'Available'
    };
    setMenuItems(prev => [...prev, newItem]);
  };

  /**
   * Updates an existing dish's information.
   */
  const updateMenuItem = (id: number, itemData: Partial<MenuItem>) => {
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, ...itemData } : item));
  };

  /**
   * Moves a dish to the archived status.
   */
  const archiveMenuItem = (id: number) => {
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, status: 'Archived' } : item));
  };

  return (
    <MenuContext.Provider value={{ menuItems, addMenuItem, updateMenuItem, archiveMenuItem }}>
      {children}
    </MenuContext.Provider>
  );
}

/**
 * Custom hook to access the menu catalog state and actions.
 */
export function useMenu() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}
