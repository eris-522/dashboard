import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { BookingContext } from './BookingContext';

export interface InventoryItem {
  id: string | number;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  status: 'High' | 'Normal' | 'Low' | 'Archived' | 'Healthy' | 'Low Stock' | 'Critical';
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
  type: 'Booking Deduction' | 'Booking Return' | 'Restock' | 'Manual Adjustment' | 'Damaged/Loss' | 'Outsourced' | 'Outsourced Return';
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
    /** Units pulled from in-house (owned) stock. Only this amount is returned to the warehouse. */
    quantity: number;
    /** Units rented from an external supplier to cover a shortage. Never added to warehouse stock. */
    outsourcedQuantity?: number;
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
  restoreBookingInventory: (bookingId: string | number, bookingName?: string, reason?: string) => Promise<boolean>;
  reconcileCompletedEvents: (bookingsList?: any[]) => Promise<number>;
  completeBookingAndReturnInventory: (bookingId: string | number, bookingName?: string) => Promise<boolean>;
  reallocateReturnedStockToConfirmedBookings: (bookingsList?: any[], overrideRecords?: BookingDeductionRecord[]) => Promise<boolean>;
  isBookingDeducted: (bookingId: string | number) => boolean;
  getAllocatedStock: (itemId: string | number) => number;
  getOutsourcedStock: (itemId: string | number) => number;
  recordStockMovement: (movement: Omit<StockMovement, 'id' | 'timestamp'>) => void;
  getPackageRules: (packageName: string) => PackageEquipmentRule[];
  savePackageRules: (packageName: string, rules: PackageEquipmentRule[]) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

/**
 * Normalizes any legacy or modern status string to 'High' | 'Normal' | 'Low' | 'Archived'
 */
export const normalizeStockStatus = (status?: string): 'High' | 'Normal' | 'Low' | 'Archived' => {
  if (!status) return 'Normal';
  const s = status.toLowerCase().trim();
  if (s === 'archived') return 'Archived';
  if (s === 'critical' || s === 'low') return 'Low';
  if (s === 'low stock' || s === 'normal') return 'Normal';
  if (s === 'healthy' || s === 'high') return 'High';
  return 'Normal';
};

/**
 * Determines the stock status based on current quantity and defined minimum levels.
 */
export const getStatus = (stock: number, minStock: number): 'High' | 'Normal' | 'Low' => {
  if (stock <= 0) return 'Low';
  if (stock <= minStock * 0.5) return 'Low';
  if (stock <= minStock) return 'Normal';
  return 'High';
};

/**
 * Checks if a booking's event has concluded.
 * Returns true if:
 * 1. Event date is in the past (before today).
 * 2. Event date is today and the event start time plus estimated event duration (4-5 hours) has elapsed,
 *    or if the date is today and standard catering hours have completed.
 */
export const isBookingEventDone = (eventDateStr?: string, eventTimeStr?: string): boolean => {
  if (!eventDateStr || !eventDateStr.trim()) return false;

  try {
    const now = new Date();

    // Parse YYYY-MM-DD or standard ISO date
    const dateParts = eventDateStr.split('-').map(Number);
    if (dateParts.length < 3 || isNaN(dateParts[0]) || isNaN(dateParts[1]) || isNaN(dateParts[2])) {
      const parsed = new Date(eventDateStr);
      if (isNaN(parsed.getTime())) return false;
      return now.getTime() > parsed.getTime();
    }

    const [year, month, day] = dateParts;

    let eventEndTime: Date;
    if (eventTimeStr && eventTimeStr.trim()) {
      const timeParts = eventTimeStr.split(':').map(Number);
      const hours = isNaN(timeParts[0]) ? 0 : timeParts[0];
      const minutes = isNaN(timeParts[1]) ? 0 : timeParts[1];
      // Assume catering event concludes 5 hours after event start time
      eventEndTime = new Date(year, month - 1, day, hours + 5, minutes);
    } else {
      // Default to end of event day (23:59:59)
      eventEndTime = new Date(year, month - 1, day, 23, 59, 59);
    }

    return now.getTime() >= eventEndTime.getTime();
  } catch (e) {
    return false;
  }
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

    // 3. Tables (Dining tables -> 1 per 8-10 pax; Buffet/Cake/Gift tables -> fixed count)
    if (lowerName.includes('table')) {
      if (lowerName.includes('buffet')) {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'fixed',
          fixedCount: 2,
          unit: item.unit || 'pcs',
        });
      } else if (
        lowerName.includes('cake') ||
        lowerName.includes('gift') ||
        lowerName.includes('registration')
      ) {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'fixed',
          fixedCount: 1,
          unit: item.unit || 'pcs',
        });
      } else if (
        lowerName.includes('cocktail') ||
        lowerName.includes('high table') ||
        lowerName.includes('bar table') ||
        lowerName.includes('bistro')
      ) {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'fixed',
          fixedCount: 5,
          unit: item.unit || 'pcs',
        });
      } else {
        // Round/Dining Guest Tables -> 1 per 10 guests
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'per_pax',
          ratio: 0.1,
          unit: item.unit || 'pcs',
        });
      }
      return;
    }

    // 4. Linen & Styling (Tablecloths -> 1 per 10 pax; Napkins -> 1 per guest; Table Runners -> 1 per 10 pax)
    if (cat === 'Linen & Styling' || lowerName.includes('linen') || lowerName.includes('cloth')) {
      if (lowerName.includes('napkin')) {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'per_pax',
          ratio: 1.0,
          unit: item.unit || 'pcs',
        });
      } else if (lowerName.includes('runner') || lowerName.includes('tablecloth') || lowerName.includes('cover')) {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'per_pax',
          ratio: 0.1,
          unit: item.unit || 'pcs',
        });
      } else {
        dynamicRules.push({
          itemName: item.name,
          category: cat,
          type: 'fixed',
          fixedCount: 2,
          unit: item.unit || 'pcs',
        });
      }
      return;
    }

    // 5. Chafing Dishes & Food Warmers -> Fixed 4-6 units per event
    if (
      lowerName.includes('chafing') ||
      lowerName.includes('warmer') ||
      lowerName.includes('roll top')
    ) {
      dynamicRules.push({
        itemName: item.name,
        category: cat,
        type: 'fixed',
        fixedCount: 5,
        unit: item.unit || 'pcs',
      });
      return;
    }

    // 6. Audio/Visual, Lights, Background Props, Centerpieces
    if (
      lowerName.includes('sound') ||
      lowerName.includes('speaker') ||
      lowerName.includes('mic') ||
      lowerName.includes('light') ||
      lowerName.includes('arch') ||
      lowerName.includes('backdrop') ||
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

const monitoringBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('equipment_monitoring_channel')
  : null;

export const broadcastMonitoringUpdate = (records: BookingDeductionRecord[], currentItems: InventoryItem[]) => {
  if (monitoringBroadcast) {
    try {
      monitoringBroadcast.postMessage({
        type: 'equipment_monitoring_sync',
        deductionRecords: records,
        items: currentItems,
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('BroadcastChannel error', e);
    }
  }
  window.dispatchEvent(new CustomEvent('equipmentMonitoringUpdated', {
    detail: { deductionRecords: records, items: currentItems }
  }));
};

export function InventoryProvider({ children }: { children: ReactNode }) {
  const bookingCtx = useContext(BookingContext);
  const contextBookings = bookingCtx?.bookings;

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

  // Booking Deductions History (Auto-deduplicated)
  const [deductionRecords, setDeductionRecords] = useState<BookingDeductionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_booking_deductions');
      if (!saved) return [];
      const parsed: BookingDeductionRecord[] = JSON.parse(saved);
      const seen = new Set<string>();
      return parsed.filter(r => {
        const id = String(r.bookingId);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    } catch {
      return [];
    }
  });

  // Concurrency guard to prevent parallel double-deductions
  const pendingDeductions = useRef(new Set<string>());

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
          status: normalizeStockStatus(item.status || getStatus(Number(item.stock) || 0, Number(item.min_stock) || 0))
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

  // React to booking changes from BookingContext in real-time
  useEffect(() => {
    if (contextBookings && contextBookings.length > 0) {
      reconcileCompletedEvents(contextBookings);
    }
  }, [contextBookings]);

  useEffect(() => {
    refreshItems();

    const channelId = `inventory-sync-channel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => {
          refreshItems(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        async (payload: any) => {
          console.log("[Equipment Monitoring] Realtime booking update received:", payload);
          await refreshItems(true);
          await reconcileCompletedEvents();
        }
      )
      .subscribe();

    // Cross-tab broadcast & window event listeners
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data?.type === 'equipment_monitoring_sync') {
        if (event.data.deductionRecords) {
          setDeductionRecords(event.data.deductionRecords);
        }
        if (event.data.items) {
          setItems(event.data.items);
        }
      }
    };
    monitoringBroadcast?.addEventListener('message', handleBroadcast);

    const handleCustomEvent = (e: any) => {
      if (e.detail?.deductionRecords) {
        setDeductionRecords(e.detail.deductionRecords);
      }
      if (e.detail?.items) {
        setItems(e.detail.items);
      }
    };
    window.addEventListener('equipmentMonitoringUpdated', handleCustomEvent);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'inventory_booking_deductions' && e.newValue) {
        try {
          setDeductionRecords(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      supabase.removeChannel(channel);
      monitoringBroadcast?.removeEventListener('message', handleBroadcast);
      window.removeEventListener('equipmentMonitoringUpdated', handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const recordStockMovement = (movement: Omit<StockMovement, 'id' | 'timestamp'>) => {
    const newMovement: StockMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString()
    };
    setStockMovements(prev => [newMovement, ...prev.slice(0, 199)]);
  };

  const getPackageRules = (packageName: string): PackageEquipmentRule[] => {
    if (customPackageRules[packageName] && customPackageRules[packageName].length > 0) {
      return customPackageRules[packageName];
    }
    return deriveDynamicPackageRules(items);
  };

  const savePackageRules = (packageName: string, rules: PackageEquipmentRule[]) => {
    setCustomPackageRules(prev => ({
      ...prev,
      [packageName]: rules
    }));
  };

  const calculatePackageEquipment = (
    packageName: string,
    pax: number,
    inclusions?: string[]
  ): EquipmentRequirement[] => {
    const rules = getPackageRules(packageName);
    const calculated: EquipmentRequirement[] = [];

    for (const rule of rules) {
      let qty = 0;
      if (rule.type === 'per_pax') {
        const ratio = rule.ratio || 1.0;
        qty = Math.ceil(pax * ratio);
      } else {
        qty = rule.fixedCount || 1;
      }

      calculated.push({
        itemName: rule.itemName,
        category: rule.category,
        quantity: Math.max(1, qty),
        unit: rule.unit,
        type: rule.type
      });
    }

    return calculated;
  };

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
    const idStr = String(bookingId);

    // Prevent concurrent double-deductions
    if (pendingDeductions.current.has(idStr)) {
      console.log(`Booking ${bookingId} deduction is already in progress, skipping duplicate call.`);
      return true;
    }

    // Check if already deducted in memory or localStorage
    let existingRecords = deductionRecords;
    try {
      const saved = localStorage.getItem('inventory_booking_deductions');
      if (saved) existingRecords = JSON.parse(saved);
    } catch {}

    const alreadyDeducted = existingRecords.some(d => String(d.bookingId) === idStr);
    if (alreadyDeducted) {
      console.log(`Booking ${bookingId} inventory already deducted, skipping.`);
      return true;
    }

    pendingDeductions.current.add(idStr);

    try {
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
          // Only owned units can be pulled from the warehouse; any shortage is outsourced (rented).
          const inHouseQty = Math.min(Math.max(0, prevStock), req.quantity);
          const outsourcedQty = req.quantity - inHouseQty;
          const newStock = prevStock - inHouseQty;
          const newStatus = inventoryItem.status === 'Archived' ? 'Archived' : getStatus(newStock, inventoryItem.minStock);

          if (inHouseQty > 0) {
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
              change: -inHouseQty,
              previousStock: prevStock,
              newStock: newStock,
              type: 'Booking Deduction',
              reason: `Auto-deducted for Booking #${bookingId} (${packageName} - ${guestCount} Pax)`,
              bookingId,
              bookingName,
              user: 'System (Booking Engine)'
            });
          }

          if (outsourcedQty > 0) {
            // Logged for traceability only — warehouse stock is NOT changed.
            recordStockMovement({
              itemId: inventoryItem.id,
              itemName: inventoryItem.name,
              change: 0,
              previousStock: newStock,
              newStock: newStock,
              type: 'Outsourced',
              reason: `Outsourced ${outsourcedQty} ${req.unit} (shortage) for Booking #${bookingId} — needed ${req.quantity}, in-house ${inHouseQty}`,
              bookingId,
              bookingName,
              user: 'System (Booking Engine)'
            });
          }

          deductedItemsList.push({
            itemId: inventoryItem.id,
            itemName: inventoryItem.name,
            quantity: inHouseQty,
            outsourcedQuantity: outsourcedQty,
            unit: req.unit
          });
        }
      }

      // Save deduction record with strict deduplication
      const record: BookingDeductionRecord = {
        bookingId,
        bookingName,
        packageName,
        guestCount,
        deductedAt: new Date().toISOString(),
        items: deductedItemsList
      };

      setDeductionRecords(prev => {
        const filtered = prev.filter(r => String(r.bookingId) !== idStr);
        const next = [record, ...filtered];
        try {
          localStorage.setItem('inventory_booking_deductions', JSON.stringify(next));
        } catch {}
        return next;
      });

      return true;
    } finally {
      pendingDeductions.current.delete(idStr);
    }
  };

  /**
   * Reallocates available warehouse stock to ongoing Confirmed bookings
   * that currently have outsourced (rented) equipment requirements.
   * Priority is given chronologically to the earliest upcoming event.
   */
  const reallocateReturnedStockToConfirmedBookings = async (
    bookingsList?: any[],
    overrideRecords?: BookingDeductionRecord[]
  ): Promise<boolean> => {
    let currentBookings = bookingsList;
    if (!currentBookings || currentBookings.length === 0) {
      const { data } = await supabase
        .from('bookings')
        .select('*, packages(*), profiles(*)');
      currentBookings = data || [];
    }

    // Only active Confirmed bookings can receive reallocated equipment
    const confirmedBookings = (currentBookings || [])
      .filter((b: any) => (b.status || 'Pending') === 'Confirmed')
      .sort((a: any, b: any) => {
        const timeA = a.event_date ? new Date(a.event_date).getTime() : Infinity;
        const timeB = b.event_date ? new Date(b.event_date).getTime() : Infinity;
        return timeA - timeB;
      });

    if (confirmedBookings.length === 0) return false;

    // Fetch fresh inventory items directly from Supabase to ensure accurate live stock
    const { data: dbItems, error: invFetchErr } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true });

    if (invFetchErr || !dbItems) {
      console.error('Failed to fetch inventory for reallocation:', invFetchErr);
      return false;
    }

    const workingItems: InventoryItem[] = dbItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      stock: Number(item.stock) || 0,
      minStock: Number(item.min_stock) || 0,
      unit: item.unit || 'pcs',
      status: normalizeStockStatus(item.status || getStatus(Number(item.stock) || 0, Number(item.min_stock) || 0))
    }));

    // Determine working deduction records, reading from localStorage if overrideRecords is not passed
    let recordsSource: BookingDeductionRecord[] = overrideRecords || deductionRecords;
    if (!overrideRecords) {
      try {
        const saved = localStorage.getItem('inventory_booking_deductions');
        if (saved) recordsSource = JSON.parse(saved);
      } catch {}
    }

    let workingRecords: BookingDeductionRecord[] = recordsSource.map(rec => ({
      ...rec,
      items: rec.items.map(it => ({ ...it }))
    }));

    let didReallocate = false;
    const itemsToUpdateInDb = new Map<string | number, InventoryItem>();

    // For each confirmed booking (earliest event date first)
    for (const b of confirmedBookings) {
      const rec = workingRecords.find(r => String(r.bookingId) === String(b.id));
      if (!rec) continue;

      for (let i = 0; i < rec.items.length; i++) {
        const recItem = rec.items[i];
        const outsourced = recItem.outsourcedQuantity || 0;
        if (outsourced <= 0) continue;

        // Match inventory item
        const invItem = workingItems.find(it =>
          String(it.id) === String(recItem.itemId) ||
          it.name.toLowerCase().trim() === recItem.itemName.toLowerCase().trim()
        );

        if (!invItem || invItem.stock <= 0) continue;

        // Available warehouse units that can convert outsourced to in-house
        const shiftQty = Math.min(invItem.stock, outsourced);
        if (shiftQty <= 0) continue;

        const prevStock = invItem.stock;
        const newStock = prevStock - shiftQty;
        invItem.stock = newStock;
        invItem.status = invItem.status === 'Archived' ? 'Archived' : getStatus(newStock, invItem.minStock);

        recItem.quantity += shiftQty;
        recItem.outsourcedQuantity = outsourced - shiftQty;

        itemsToUpdateInDb.set(invItem.id, invItem);
        didReallocate = true;

        // Log Stock Movement for audit trail
        recordStockMovement({
          itemId: invItem.id,
          itemName: invItem.name,
          change: -shiftQty,
          previousStock: prevStock,
          newStock: newStock,
          type: 'Booking Deduction',
          reason: `Auto-reallocated from completed event returned supplies to ongoing Confirmed Booking #${rec.bookingId} (${rec.bookingName}) — converted ${shiftQty} outsourced units to in-house`,
          bookingId: rec.bookingId,
          bookingName: rec.bookingName,
          user: 'System (Equipment Monitoring Reconciler)'
        });

        recordStockMovement({
          itemId: invItem.id,
          itemName: invItem.name,
          change: 0,
          previousStock: newStock,
          newStock: newStock,
          type: 'Outsourced Return',
          reason: `Outsourced rental reduced by ${shiftQty} ${recItem.unit} for Booking #${rec.bookingId} as warehouse supplies became available from completed event`,
          bookingId: rec.bookingId,
          bookingName: rec.bookingName,
          user: 'System (Equipment Monitoring Reconciler)'
        });
      }
    }

    if (didReallocate) {
      // 1. Update all affected items in Supabase
      for (const invItem of itemsToUpdateInDb.values()) {
        await supabase
          .from('inventory')
          .update({ stock: invItem.stock, status: invItem.status })
          .eq('id', invItem.id);
      }

      // 2. Update React local states
      setItems(workingItems);
      setDeductionRecords(workingRecords);

      // 3. Persist to localStorage
      try {
        localStorage.setItem('inventory_booking_deductions', JSON.stringify(workingRecords));
      } catch (e) {
        console.error('Failed to save deduction records to localStorage', e);
      }

      // 4. Broadcast across tabs and windows
      broadcastMonitoringUpdate(workingRecords, workingItems);
    }

    return didReallocate;
  };

  /**
   * Automatically returns/restores previously deducted inventory when a booking is completed, cancelled, or archived,
   * and automatically reallocates returned supplies to ongoing Confirmed bookings to reduce outsourced shortages.
   */
  const restoreBookingInventory = async (
    bookingId: string | number,
    bookingName?: string,
    reason?: string
  ): Promise<boolean> => {
    // Read latest from localStorage or state
    let records = deductionRecords;
    try {
      const saved = localStorage.getItem('inventory_booking_deductions');
      if (saved) records = JSON.parse(saved);
    } catch {}

    const record = records.find(d => String(d.bookingId) === String(bookingId));
    if (!record) {
      console.log(`No inventory deduction record found for booking ${bookingId}`);
      return false;
    }

    let updatedItems = [...items];

    for (const item of record.items) {
      const inventoryItem = updatedItems.find(i => String(i.id) === String(item.itemId) || i.name.toLowerCase() === item.itemName.toLowerCase());
      if (!inventoryItem) continue;

      // Only the in-house portion returns to the warehouse.
      if (item.quantity > 0) {
        const prevStock = inventoryItem.stock;
        const newStock = prevStock + item.quantity;
        const newStatus = inventoryItem.status === 'Archived' ? 'Archived' : getStatus(newStock, inventoryItem.minStock);

        inventoryItem.stock = newStock;
        inventoryItem.status = newStatus;

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
          reason: reason || `Restored from Concluded Booking #${bookingId} (${record.packageName})`,
          bookingId,
          bookingName: bookingName || record.bookingName,
          user: 'System (Equipment Monitoring Reconciler)'
        });
      }

      // Outsourced units go back to the supplier — warehouse stock is NOT changed.
      if ((item.outsourcedQuantity || 0) > 0) {
        recordStockMovement({
          itemId: inventoryItem.id,
          itemName: inventoryItem.name,
          change: 0,
          previousStock: inventoryItem.stock,
          newStock: inventoryItem.stock,
          type: 'Outsourced Return',
          reason: `${item.outsourcedQuantity} ${item.unit} returned to external supplier (Booking #${bookingId}) — not added to warehouse stock`,
          bookingId,
          bookingName: bookingName || record.bookingName,
          user: 'System (Equipment Monitoring Reconciler)'
        });
      }
    }

    // Remove the deduction record
    const updatedRecords = records.filter(d => String(d.bookingId) !== String(bookingId));
    setDeductionRecords(updatedRecords);
    try {
      localStorage.setItem('inventory_booking_deductions', JSON.stringify(updatedRecords));
    } catch {}

    // Broadcast immediate return
    broadcastMonitoringUpdate(updatedRecords, updatedItems);

    // Immediately reallocate returned warehouse supplies to any ongoing Confirmed bookings that have outsourced items!
    await reallocateReturnedStockToConfirmedBookings(undefined, updatedRecords);

    return true;
  };

  /**
   * Automatically checks all deducted bookings, purges duplicates and orphan records,
   * restores items from concluded or deleted bookings to equipment monitoring,
   * and synchronizes active Confirmed bookings.
   */
  const reconcileCompletedEvents = async (bookingsList?: any[]): Promise<number> => {
    let currentBookings = bookingsList;
    if (!currentBookings || currentBookings.length === 0) {
      const { data } = await supabase
        .from('bookings')
        .select('*, packages(*), profiles(*)');
      currentBookings = data || [];
    }

    let restoredCount = 0;

    // 0. Auto-deduplicate deductionRecords by bookingId
    // If duplicate copies exist for the same booking, keep only the latest one and purge duplicates
    let rawRecords = deductionRecords;
    try {
      const saved = localStorage.getItem('inventory_booking_deductions');
      if (saved) rawRecords = JSON.parse(saved);
    } catch {}

    const seenIds = new Set<string>();
    const deduplicatedRecords: BookingDeductionRecord[] = [];
    const duplicateCopiesToPurge: BookingDeductionRecord[] = [];

    for (const record of rawRecords) {
      const idStr = String(record.bookingId);
      if (seenIds.has(idStr)) {
        duplicateCopiesToPurge.push(record);
      } else {
        seenIds.add(idStr);
        deduplicatedRecords.push(record);
      }
    }

    if (duplicateCopiesToPurge.length > 0) {
      console.warn(`[Inventory] Found and purged ${duplicateCopiesToPurge.length} duplicate deduction records.`);
    }

    // 1. Process records: Restore completed/cancelled/archived bookings, and purge orphaned deleted bookings!
    const cleanedRecords: BookingDeductionRecord[] = [];

    for (const record of deduplicatedRecords) {
      const matchedBooking = currentBookings.find((b: any) => String(b.id) === String(record.bookingId));

      // If the booking was deleted from Supabase completely:
      if (!matchedBooking) {
        console.warn(`[Inventory] Booking #${record.bookingId} no longer exists in database. Restoring stock and purging orphan record.`);
        for (const item of record.items) {
          if (item.quantity > 0) {
            const invItem = items.find(i => String(i.id) === String(item.itemId) || i.name.toLowerCase() === item.itemName.toLowerCase());
            if (invItem) {
              const newStock = invItem.stock + item.quantity;
              invItem.stock = newStock;
              invItem.status = invItem.status === 'Archived' ? 'Archived' : getStatus(newStock, invItem.minStock);
              await supabase.from('inventory').update({ stock: newStock, status: invItem.status }).eq('id', invItem.id);
            }
          }
        }
        restoredCount++;
        continue; // Do not keep this orphan record in cleanedRecords!
      }

      const bookingStatus = matchedBooking.status || 'Pending';
      const isDone = bookingStatus === 'Completed' || bookingStatus === 'Cancelled' || bookingStatus === 'Archived';

      if (isDone) {
        console.log(`Booking #${record.bookingId} (${record.bookingName}) has status ${bookingStatus}. Restoring equipment...`);

        const success = await restoreBookingInventory(
          record.bookingId,
          record.bookingName,
          `Booking marked ${bookingStatus} - Equipment returned to equipment monitoring`
        );

        if (success) {
          restoredCount++;
        }
      } else {
        cleanedRecords.push(record);
      }
    }

    // Update deductionRecords state & localStorage with deduplicated & cleaned records
    setDeductionRecords(cleanedRecords);
    try {
      localStorage.setItem('inventory_booking_deductions', JSON.stringify(cleanedRecords));
    } catch {}

    // 2. Ensure every Confirmed booking has an active deduction record in deductionRecords!
    const confirmedBookings = currentBookings.filter((b: any) => (b.status || 'Pending') === 'Confirmed');
    for (const b of confirmedBookings) {
      const alreadyHas = cleanedRecords.some((d) => String(d.bookingId) === String(b.id));
      if (!alreadyHas) {
        const pkgName = b.packages?.name || b.package || b.packageName || 'Event Package';
        const guestCount = Number(b.guest_count ?? b.guestCount ?? 50);
        const additionalPax = Number(b.additional_pax ?? b.additionalPax ?? 0);
        const totalPax = guestCount + additionalPax;
        const inclusions = b.packages?.inclusions || b.inclusions || [];
        await deductBookingInventory(
          b.id,
          b.profiles?.name || b.profiles?.full_name || b.customerName || 'Client',
          pkgName,
          totalPax,
          inclusions
        );
      }
    }

    // 3. Harmonize existing confirmed booking records with current dynamic rules (e.g. Cocktail-high tables fixed at 5)
    for (const rec of cleanedRecords) {
      const b = confirmedBookings.find(cb => String(cb.id) === String(rec.bookingId));
      if (!b) continue;
      const pkgName = b.packages?.name || b.package || b.packageName || 'Event Package';
      const guestCount = Number(b.guest_count ?? b.guestCount ?? 50);
      const additionalPax = Number(b.additional_pax ?? b.additionalPax ?? 0);
      const totalPax = guestCount + additionalPax;
      const inclusions = b.packages?.inclusions || b.inclusions || [];
      const expectedReqs = calculatePackageEquipment(pkgName, totalPax, inclusions);

      let recordModified = false;
      for (const req of expectedReqs) {
        const it = rec.items.find(item => item.itemName.toLowerCase().trim() === req.itemName.toLowerCase().trim());
        if (it) {
          const currentTotal = it.quantity + (it.outsourcedQuantity || 0);
          if (currentTotal !== req.quantity) {
            const inHouse = Math.min(it.quantity, req.quantity);
            it.quantity = inHouse;
            it.outsourcedQuantity = Math.max(0, req.quantity - inHouse);
            recordModified = true;
          }
        } else {
          const invItem = items.find(i => i.status !== 'Archived' && i.name.toLowerCase().trim() === req.itemName.toLowerCase().trim());
          const available = invItem ? Math.max(0, invItem.stock) : 0;
          const inHouse = Math.min(available, req.quantity);
          rec.items.push({
            itemId: invItem?.id || req.itemName,
            itemName: req.itemName,
            quantity: inHouse,
            outsourcedQuantity: Math.max(0, req.quantity - inHouse),
            unit: req.unit
          });
          recordModified = true;
        }
      }
      if (rec.guestCount !== totalPax) {
        rec.guestCount = totalPax;
        recordModified = true;
      }
      if (recordModified) {
        setDeductionRecords([...cleanedRecords]);
        try {
          localStorage.setItem('inventory_booking_deductions', JSON.stringify(cleanedRecords));
        } catch {}
        broadcastMonitoringUpdate(cleanedRecords, items);
      }
    }

    // 4. Reallocate available warehouse supplies to ongoing confirmed bookings
    await reallocateReturnedStockToConfirmedBookings(currentBookings, cleanedRecords);

    // 5. Broadcast real-time sync across all windows & components
    broadcastMonitoringUpdate(cleanedRecords, items);

    return restoredCount;
  };

  /**
   * Manually marks a booking as Completed and restores all allocated equipment.
   */
  const completeBookingAndReturnInventory = async (
    bookingId: string | number,
    bookingName?: string
  ): Promise<boolean> => {
    // 1. Update status in Supabase
    await supabase
      .from('bookings')
      .update({ status: 'Completed' })
      .eq('id', bookingId);

    // 2. Restore equipment if deducted
    if (isBookingDeducted(bookingId)) {
      await restoreBookingInventory(
        bookingId,
        bookingName,
        `Event Completed - All equipment returned to equipment monitoring (Booking #${bookingId})`
      );
    }
    return true;
  };

  // Run automatic reconciliation and active booking sync periodically
  useEffect(() => {
    if (!isLoading && items.length > 0) {
      reconcileCompletedEvents();
    }

    const interval = setInterval(() => {
      reconcileCompletedEvents();
    }, 300000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [isLoading, items.length]);

  const isBookingDeducted = (bookingId: string | number): boolean => {
    return deductionRecords.some(d => String(d.bookingId) === String(bookingId));
  };

  const getAllocatedStock = (itemId: string | number): number => {
    const targetItem = items.find(it => String(it.id) === String(itemId));
    let totalAllocated = 0;
    for (const record of deductionRecords) {
      const item = record.items.find(i => 
        String(i.itemId) === String(itemId) ||
        (targetItem && i.itemName.toLowerCase().trim() === targetItem.name.toLowerCase().trim())
      );
      if (item) {
        totalAllocated += item.quantity;
      }
    }
    return totalAllocated;
  };

  const getOutsourcedStock = (itemId: string | number): number => {
    const targetItem = items.find(it => String(it.id) === String(itemId));
    let totalOutsourced = 0;
    for (const record of deductionRecords) {
      const item = record.items.find(i => 
        String(i.itemId) === String(itemId) ||
        (targetItem && i.itemName.toLowerCase().trim() === targetItem.name.toLowerCase().trim())
      );
      if (item) {
        totalOutsourced += item.outsourcedQuantity || 0;
      }
    }
    return totalOutsourced;
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
      if (quantity > 0) {
        setTimeout(() => {
          reallocateReturnedStockToConfirmedBookings();
        }, 100);
      }
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
      reconcileCompletedEvents,
      completeBookingAndReturnInventory,
      reallocateReturnedStockToConfirmedBookings,
      isBookingDeducted,
      getAllocatedStock,
      getOutsourcedStock,
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

// Aliases for Equipment Monitoring
export const useEquipmentMonitoring = useInventory;
export const EquipmentMonitoringProvider = InventoryProvider;
export type EquipmentItem = InventoryItem;
