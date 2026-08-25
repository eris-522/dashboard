import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../utils/supabase';

export interface InventoryItem {
  id: string | number;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  status: 'Healthy' | 'Low Stock' | 'Critical' | 'Archived';
}

export interface PackageEquipmentRule {
  itemName: string;
  category: string;
  type: 'per_pax' | 'fixed';
  ratio?: number; // e.g. 1.0 = 1 per pax, 0.1 = 1 per 10 pax
  fixedCount?: number; // e.g. 2 buffet tables
  unit: string;
}

export interface StockMovement {
  id: string;
  itemId: string | number;
  itemName: string;
  change: number;
  previousStock: number;
  newStock: number;
  type: 'Booking Deduction' | 'Booking Return' | 'Restock' | 'Manual Adjustment' | 'Damaged/Loss';
  reason: string;
  bookingId?: string | number;
  bookingName?: string;
  timestamp: string;
  user: string;
}

export interface BookingDeductionRecord {
  bookingId: string | number;
  bookingName: string;
  packageName: string;
  guestCount: number;
  deductedAt: string;
  items: {
    itemId: string | number;
    itemName: string;
    quantity: number;
    unit: string;
  }[];
}

export interface EquipmentRequirement {
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  type: 'per_pax' | 'fixed';
  matchedItemId?: string | number;
  currentStock?: number;
  isAvailable?: boolean;
}

interface InventoryContextType {
  items: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  stockMovements: StockMovement[];
  deductionRecords: BookingDeductionRecord[];
  refreshItems: (silent?: boolean) => Promise<void>;
  addItem: (item: Omit<InventoryItem, 'id' | 'status'>) => Promise<void>;
  updateStock: (id: string | number, quantity: number, reason?: string, type?: StockMovement['type']) => Promise<void>;
  archiveItem: (id: string | number) => Promise<void>;
  updateItem: (id: string | number, updates: Partial<InventoryItem>) => Promise<void>;
  calculatePackageEquipment: (packageName: string, pax: number, inclusions?: string[]) => EquipmentRequirement[];
  checkInventoryAvailability: (packageName: string, pax: number, inclusions?: string[]) => {
    isAvailable: boolean;
    requirements: (EquipmentRequirement & { availableStock: number; deficit: number })[];
  };
  deductBookingInventory: (bookingId: string | number, bookingName: string, packageName: string, guestCount: number, inclusions?: string[]) => Promise<boolean>;
  restoreBookingInventory: (bookingId: string | number, bookingName?: string) => Promise<boolean>;
  isBookingDeducted: (bookingId: string | number) => boolean;
  getAllocatedStock: (itemId: string | number) => number;
  recordStockMovement: (movement: Omit<StockMovement, 'id' | 'timestamp'>) => void;
  getPackageRules: (packageName: string) => PackageEquipmentRule[];
  savePackageRules: (packageName: string, rules: PackageEquipmentRule[]) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

/**
 * Determines the stock status based on current quantity and defined minimum levels.
 */
export const getStatus = (stock: number, minStock: number): 'Healthy' | 'Low Stock' | 'Critical' => {
  if (stock <= 0) return 'Critical';
  if (stock <= minStock * 0.5) return 'Critical';
  if (stock <= minStock) return 'Low Stock';
  return 'Healthy';
};

/**
 * Automatically derives equipment rules dynamically from the live warehouse inventory catalog.
 * Guarantees that any future package or new inventory item works automatically without hardcoded code.
 */
export const deriveDynamicPackageRules = (
  inventoryItems: InventoryItem[],
  inclusions?: string[]
): PackageEquipmentRule[] => {
  const dynamicRules: PackageEquipmentRule[] = [];
  const inclusionStrings = (inclusions || []).map((inc) => inc.toLowerCase());

  inventoryItems.forEach((item) => {
    if (item.status === 'Archived' || item.status?.toLowerCase() === 'archived') return;

    const lowerName = item.name.toLowerCase();
    const cat = item.category || 'Event Equipment';

    // 1. Tableware (Plates, Bowls, Cutlery, Glassware, Goblets, etc.) -> 1 per guest
    if (cat === 'Tableware') {
      const isServingUtensil =
        lowerName.includes('spoon') ||
        lowerName.includes('tong') ||
        lowerName.includes('tray') ||
        lowerName.includes('platter') ||
        lowerName.includes('chafing');
      if (isServingUtensil) {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'fixed',
          fixedCount: 4,
          unit: item.unit || 'pcs',
        });
      } else {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'per_pax',
          ratio: 1.0,
          unit: item.unit || 'pcs',
        });
      }
      return;
    }

    // 2. Chairs and Seating -> 1 per guest
    if (lowerName.includes('chair') || lowerName.includes('seat') || lowerName.includes('stool')) {
      dynamicRules.push({
        itemName: item.name,
        category: cat,
        type: 'per_pax',
        ratio: 1.0,
        unit: item.unit || 'pcs',
      });
      return;
    }

    // 3. Dining Tables, Tablecloths, Centerpieces, Napkins
    if (
      lowerName.includes('dining table') ||
      lowerName.includes('round table') ||
      lowerName.includes('tablecloth') ||
      lowerName.includes('centerpiece') ||
      lowerName.includes('napkin')
    ) {
      const isPerGuest = lowerName.includes('napkin');
      dynamicRules.push({
        itemName: item.name,
        category: cat,
        type: 'per_pax',
        ratio: isPerGuest ? 1.0 : 0.1,
        unit: item.unit || 'pcs',
      });
      return;
    }

    // 4. Inclusions Match: If the item matches an inclusion in the package
    const matchesInclusion = inclusionStrings.some(
      (inc) => inc.includes(lowerName) || lowerName.includes(inc)
    );
    if (matchesInclusion) {
      dynamicRules.push({
        itemName: item.name,
        category: cat,
        type: 'fixed',
        fixedCount: lowerName.includes('buffet') ? 2 : 1,
        unit: item.unit || 'pcs',
      });
      return;
    }

    // 5. Standard Essential Event Equipment (Buffet tables, Sound, Lights, Staging, Backdrops)
    if (
      lowerName.includes('buffet') ||
      lowerName.includes('sound') ||
      lowerName.includes('light') ||
      lowerName.includes('stage') ||
      lowerName.includes('backdrop') ||
      lowerName.includes('arch') ||
      lowerName.includes('cord') ||
      lowerName.includes('skirt') ||
      lowerName.includes('projector') ||
      lowerName.includes('cake stand')
    ) {
      dynamicRules.push({
        itemName: item.name,
        category: cat,
        type: 'fixed',
        fixedCount:
          lowerName.includes('buffet') || lowerName.includes('light') || lowerName.includes('skirt')
            ? 2
            : 1,
        unit: item.unit || 'pcs',
      });
      return;
    }
  });

  return dynamicRules;
};

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stock Movement History
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_stock_movements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Booking Deductions History
  const [deductionRecords, setDeductionRecords] = useState<BookingDeductionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_booking_deductions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Custom Package Equipment Rules (Persisted)
  const [customPackageRules, setCustomPackageRules] = useState<Record<string, PackageEquipmentRule[]>>(() => {
    try {
      const saved = localStorage.getItem('inventory_package_rules');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('inventory_stock_movements', JSON.stringify(stockMovements));
    } catch (e) {
      console.error('Failed to save stock movements', e);
    }
  }, [stockMovements]);

  useEffect(() => {
    try {
      localStorage.setItem('inventory_booking_deductions', JSON.stringify(deductionRecords));
    } catch (e) {
      console.error('Failed to save deduction records', e);
    }
  }, [deductionRecords]);

  useEffect(() => {
    try {
      localStorage.setItem('inventory_package_rules', JSON.stringify(customPackageRules));
    } catch (e) {
      console.error('Failed to save custom package rules', e);
    }
  }, [customPackageRules]);

  const refreshItems = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('inventory')
        .select('*')
        .order('name', { ascending: true });

      if (fetchErr) {
        throw fetchErr;
      }

      if (data) {
        const mapped: InventoryItem[] = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          stock: Number(item.stock) || 0,
          minStock: Number(item.min_stock) || 0,
          unit: item.unit || 'pcs',
          status: item.status || getStatus(Number(item.stock) || 0, Number(item.min_stock) || 0)
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

  const recordStockMovement = (movementData: Omit<StockMovement, 'id' | 'timestamp'>) => {
    const newMovement: StockMovement = {
      ...movementData,
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setStockMovements(prev => [newMovement, ...prev]);
  };

  const getPackageRules = (packageName: string, inclusions?: string[]): PackageEquipmentRule[] => {
    // 1. Check custom package rules configured by admin
    if (customPackageRules[packageName] && customPackageRules[packageName].length > 0) {
      return customPackageRules[packageName];
    }
    // Match by substring/case
    const key = Object.keys(customPackageRules).find(
      (k) =>
        k.toLowerCase() === packageName.toLowerCase() ||
        packageName.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(packageName.toLowerCase())
    );
    if (key && customPackageRules[key] && customPackageRules[key].length > 0) {
      return customPackageRules[key];
    }

    // 2. Automatically derive dynamically from live warehouse items
    const dynamic = deriveDynamicPackageRules(items, inclusions);
    if (dynamic.length > 0) {
      return dynamic;
    }

    // 3. Fallback to active items if still loading
    return items.map((i) => ({
      itemName: i.name,
      category: i.category,
      type: i.category === 'Tableware' || i.name.toLowerCase().includes('chair') ? 'per_pax' : 'fixed',
      ratio: i.category === 'Tableware' || i.name.toLowerCase().includes('chair') ? 1.0 : (i.name.toLowerCase().includes('table') ? 0.1 : undefined),
      fixedCount: i.category === 'Tableware' || i.name.toLowerCase().includes('chair') ? undefined : 1,
      unit: i.unit || 'pcs',
    }));
  };

  const savePackageRules = (packageName: string, rules: PackageEquipmentRule[]) => {
    setCustomPackageRules(prev => ({
      ...prev,
      [packageName]: rules
    }));
  };

  /**
   * Calculates required inventory items dynamically based on package and guest count.
   */
  const calculatePackageEquipment = (
    packageName: string,
    pax: number,
    inclusions?: string[]
  ): EquipmentRequirement[] => {
    const rules = getPackageRules(packageName, inclusions);
    const guestCount = Math.max(1, pax || 50);

    const calculated: EquipmentRequirement[] = rules.map(rule => {
      const quantity = rule.type === 'per_pax'
        ? Math.ceil((rule.ratio || 1) * guestCount)
        : (rule.fixedCount || 1);

      const matchedItem = items.find(i => 
        i.status !== 'Archived' && 
        (i.name.toLowerCase() === rule.itemName.toLowerCase() ||
         i.name.toLowerCase().includes(rule.itemName.toLowerCase()) ||
         rule.itemName.toLowerCase().includes(i.name.toLowerCase()))
      );

      return {
        itemName: matchedItem ? matchedItem.name : rule.itemName,
        category: matchedItem ? matchedItem.category : rule.category,
        quantity,
        unit: matchedItem ? matchedItem.unit : rule.unit,
        type: rule.type,
        matchedItemId: matchedItem?.id,
        currentStock: matchedItem ? matchedItem.stock : 0,
        isAvailable: matchedItem ? matchedItem.stock >= quantity : false,
      };
    });

    // If extra inclusions are passed, dynamically ensure inclusion equipment is covered
    if (inclusions && inclusions.length > 0) {
      inclusions.forEach((inc) => {
        const lowerInc = inc.toLowerCase();
        const matchingInventoryItem = items.find(
          (i) =>
            i.status !== 'Archived' &&
            (lowerInc.includes(i.name.toLowerCase()) ||
              i.name.toLowerCase().includes(lowerInc))
        );

        if (
          matchingInventoryItem &&
          !calculated.some(
            (c) =>
              c.matchedItemId === matchingInventoryItem.id ||
              c.itemName.toLowerCase() === matchingInventoryItem.name.toLowerCase()
          )
        ) {
          calculated.push({
            itemName: matchingInventoryItem.name,
            category: matchingInventoryItem.category,
            quantity: 1,
            unit: matchingInventoryItem.unit,
            type: 'fixed',
            matchedItemId: matchingInventoryItem.id,
            currentStock: matchingInventoryItem.stock,
            isAvailable: matchingInventoryItem.stock >= 1,
          });
        }
      });
    }

    return calculated;
  };

  /**
   * Checks if there is enough inventory available for a package & pax count.
   */
  const checkInventoryAvailability = (
    packageName: string,
    pax: number,
    inclusions?: string[]
  ) => {
    const requirements = calculatePackageEquipment(packageName, pax, inclusions);
    let allAvailable = true;

    const detailedRequirements = requirements.map(req => {
      const matched = items.find(i => 
        i.status !== 'Archived' && 
        i.name.toLowerCase() === req.itemName.toLowerCase()
      );
      const availableStock = matched ? matched.stock : 0;
      const isSufficient = availableStock >= req.quantity;
      const deficit = Math.max(0, req.quantity - availableStock);

      if (!isSufficient) {
        allAvailable = false;
      }

      return {
        ...req,
        matchedItemId: matched?.id,
        availableStock,
        isAvailable: isSufficient,
        deficit
      };
    });

    return {
      isAvailable: allAvailable,
      requirements: detailedRequirements
    };
  };

  /**
   * Automatically deducts required inventory items when a booking is confirmed.
   */
  const deductBookingInventory = async (
    bookingId: string | number,
    bookingName: string,
    packageName: string,
    guestCount: number,
    inclusions?: string[]
  ): Promise<boolean> => {
    // Check if already deducted
    const alreadyDeducted = deductionRecords.some(d => String(d.bookingId) === String(bookingId));
    if (alreadyDeducted) {
      console.log(`Booking ${bookingId} inventory already deducted, skipping.`);
      return true;
    }

    const requirements = calculatePackageEquipment(packageName, guestCount, inclusions);
    const deductedItemsList: BookingDeductionRecord['items'] = [];

    // Perform deductions in Supabase and local state
    for (const req of requirements) {
      const inventoryItem = items.find(i => 
        i.status !== 'Archived' && 
        i.name.toLowerCase() === req.itemName.toLowerCase()
      );

      if (inventoryItem) {
        const prevStock = inventoryItem.stock;
        const newStock = Math.max(0, prevStock - req.quantity);
        const newStatus = inventoryItem.status === 'Archived' ? 'Archived' : getStatus(newStock, inventoryItem.minStock);

        // Update local state
        setItems(prev => prev.map(item => item.id === inventoryItem.id ? { ...item, stock: newStock, status: newStatus } : item));

        // Update Supabase
        await supabase
          .from('inventory')
          .update({ stock: newStock, status: newStatus })
          .eq('id', inventoryItem.id);

        // Record stock movement
        recordStockMovement({
          itemId: inventoryItem.id,
          itemName: inventoryItem.name,
          change: -req.quantity,
          previousStock: prevStock,
          newStock: newStock,
          type: 'Booking Deduction',
          reason: `Auto-deducted for Booking #${bookingId} (${packageName} - ${guestCount} Pax)`,
          bookingId,
          bookingName,
          user: 'System (Booking Engine)'
        });

        deductedItemsList.push({
          itemId: inventoryItem.id,
          itemName: inventoryItem.name,
          quantity: req.quantity,
          unit: req.unit
        });
      }
    }

    // Save deduction record
    const record: BookingDeductionRecord = {
      bookingId,
      bookingName,
      packageName,
      guestCount,
      deductedAt: new Date().toISOString(),
      items: deductedItemsList
    };

    setDeductionRecords(prev => [record, ...prev]);
    return true;
  };

  /**
   * Automatically returns/restores previously deducted inventory when a booking is cancelled or archived.
   */
  const restoreBookingInventory = async (
    bookingId: string | number,
    bookingName?: string
  ): Promise<boolean> => {
    const record = deductionRecords.find(d => String(d.bookingId) === String(bookingId));
    if (!record) {
      console.log(`No inventory deduction record found for booking ${bookingId}`);
      return false;
    }

    for (const item of record.items) {
      const inventoryItem = items.find(i => String(i.id) === String(item.itemId) || i.name.toLowerCase() === item.itemName.toLowerCase());
      if (inventoryItem) {
        const prevStock = inventoryItem.stock;
        const newStock = prevStock + item.quantity;
        const newStatus = inventoryItem.status === 'Archived' ? 'Archived' : getStatus(newStock, inventoryItem.minStock);

        // Update local state
        setItems(prev => prev.map(i => i.id === inventoryItem.id ? { ...i, stock: newStock, status: newStatus } : i));

        // Update Supabase
        await supabase
          .from('inventory')
          .update({ stock: newStock, status: newStatus })
          .eq('id', inventoryItem.id);

        // Record stock movement
        recordStockMovement({
          itemId: inventoryItem.id,
          itemName: inventoryItem.name,
          change: item.quantity,
          previousStock: prevStock,
          newStock: newStock,
          type: 'Booking Return',
          reason: `Restored from Cancelled Booking #${bookingId} (${record.packageName})`,
          bookingId,
          bookingName: bookingName || record.bookingName,
          user: 'System (Booking Engine)'
        });
      }
    }

    // Remove the deduction record
    setDeductionRecords(prev => prev.filter(d => String(d.bookingId) !== String(bookingId)));
    return true;
  };

  const isBookingDeducted = (bookingId: string | number): boolean => {
    return deductionRecords.some(d => String(d.bookingId) === String(bookingId));
  };

  const getAllocatedStock = (itemId: string | number): number => {
    let totalAllocated = 0;
    for (const record of deductionRecords) {
      const item = record.items.find(i => String(i.itemId) === String(itemId));
      if (item) {
        totalAllocated += item.quantity;
      }
    }
    return totalAllocated;
  };

  const addItem = async (newItem: Omit<InventoryItem, 'id' | 'status'>) => {
    const status = getStatus(newItem.stock, newItem.minStock);
    const tempId = `temp-${Date.now()}`;
    setItems(prev => [...prev, { ...newItem, id: tempId, status }]);

    const { data, error: insertError } = await supabase.from('inventory').insert([{
      name: newItem.name,
      category: newItem.category,
      stock: newItem.stock,
      min_stock: newItem.minStock,
      unit: newItem.unit,
      status: status
    }]).select();

    if (insertError) {
      console.error("Error adding item:", insertError);
      alert("Supabase Error: " + insertError.message);
    } else if (data && data[0]) {
      recordStockMovement({
        itemId: data[0].id,
        itemName: newItem.name,
        change: newItem.stock,
        previousStock: 0,
        newStock: newItem.stock,
        type: 'Restock',
        reason: 'Initial item creation',
        user: 'Admin'
      });
    }
    refreshItems(true);
  };

  const updateStock = async (
    id: string | number,
    quantity: number,
    reason = 'Manual adjustment',
    type: StockMovement['type'] = quantity > 0 ? 'Restock' : 'Manual Adjustment'
  ) => {
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return;

    const prevStock = item.stock;
    const newStock = Math.max(0, prevStock + quantity);
    const newStatus = item.status === 'Archived' ? 'Archived' : getStatus(newStock, item.minStock);

    setItems(prev => prev.map(i => String(i.id) === String(id) ? { ...i, stock: newStock, status: newStatus } : i));

    const { error: updateError } = await supabase
      .from('inventory')
      .update({ stock: newStock, status: newStatus })
      .eq('id', id);

    if (updateError) {
      console.error("Error updating stock:", updateError);
      alert("Supabase Error: " + updateError.message);
      refreshItems(true);
    } else {
      recordStockMovement({
        itemId: id,
        itemName: item.name,
        change: quantity,
        previousStock: prevStock,
        newStock: newStock,
        type,
        reason,
        user: 'Admin'
      });
    }
  };

  const archiveItem = async (id: string | number) => {
    setItems(prev => prev.map(item => String(item.id) === String(id) ? { ...item, status: 'Archived' } : item));
    
    const { error: archiveError } = await supabase.from('inventory').update({ status: 'Archived' }).eq('id', id);
    
    if (archiveError) {
      console.error("Error archiving item:", archiveError);
      alert("Supabase Error: " + archiveError.message);
      refreshItems(true);
    }
  };

  const updateItem = async (id: string | number, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => {
      if (String(item.id) === String(id)) {
        const updatedItem = { ...item, ...updates };
        if (updates.stock !== undefined || updates.minStock !== undefined) {
          updatedItem.status = updatedItem.status === 'Archived' ? 'Archived' : getStatus(updatedItem.stock, updatedItem.minStock);
        }
        return updatedItem;
      }
      return item;
    }));

    const item = items.find(i => String(i.id) === String(id));
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
    <InventoryContext.Provider value={{
      items,
      isLoading,
      error,
      stockMovements,
      deductionRecords,
      refreshItems,
      addItem,
      updateStock,
      archiveItem,
      updateItem,
      calculatePackageEquipment,
      checkInventoryAvailability,
      deductBookingInventory,
      restoreBookingInventory,
      isBookingDeducted,
      getAllocatedStock,
      recordStockMovement,
      getPackageRules,
      savePackageRules,
    }}>
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
