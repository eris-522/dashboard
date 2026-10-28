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
  calculatePackageEquipment: (packageName: string, pax: number, inclusions?: string[], currentItemsList?: InventoryItem[], corkageData?: any) => EquipmentRequirement[];
  checkInventoryAvailability: (packageName: string, pax: number, inclusions?: string[]) => {
    isAvailable: boolean;
    requirements: (EquipmentRequirement & { availableStock: number; deficit: number })[];
  };
  deductBookingInventory: (bookingId: string | number, bookingName: string, packageName: string, guestCount: number, inclusions?: string[], corkageData?: any) => Promise<boolean>;
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
 * Accurately computes item status: preserves 'Archived' if archived, otherwise calculates based on stock vs minStock.
 */
export const computeItemStatus = (
  stock: number,
  minStock: number,
  rawStatus?: string
): 'High' | 'Normal' | 'Low' | 'Archived' => {
  if (rawStatus && rawStatus.toLowerCase().trim() === 'archived') {
    return 'Archived';
  }
  return getStatus(stock, minStock);
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

const mapDbRowToDeductionRecord = (row: any): BookingDeductionRecord => ({
  bookingId: row.booking_id,
  bookingName: row.booking_name || 'Client',
  packageName: row.package_name || 'Event Package',
  guestCount: Number(row.guest_count) || 0,
  deductedAt: row.deducted_at || new Date().toISOString(),
  items: Array.isArray(row.items) ? row.items : []
});

const mapDbRowToStockMovement = (row: any): StockMovement => ({
  id: row.id,
  itemId: row.item_id,
  itemName: row.item_name,
  change: Number(row.change) || 0,
  previousStock: Number(row.previous_stock) || 0,
  newStock: Number(row.new_stock) || 0,
  type: row.type as StockMovement['type'],
  reason: row.reason || '',
  bookingId: row.booking_id || undefined,
  bookingName: row.booking_name || undefined,
  timestamp: row.timestamp || new Date().toISOString(),
  user: row.user_name || 'System'
});

export function InventoryProvider({ children }: { children: ReactNode }) {
  const bookingCtx = useContext(BookingContext);
  const contextBookings = bookingCtx?.bookings;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stock Movement History (Backed by Supabase `inventory_stock_movements`)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // Booking Deductions (Backed by Supabase `inventory_deductions`)
  const [deductionRecords, setDeductionRecords] = useState<BookingDeductionRecord[]>([]);

  // Custom Package Equipment Rules (Backed by Supabase `inventory_package_rules`)
  const [customPackageRules, setCustomPackageRules] = useState<Record<string, PackageEquipmentRule[]>>({});

  // Concurrency guards to prevent parallel double-deductions or overlapping reconciliations
  const pendingDeductions = useRef(new Set<string>());
  const isReconcilingRef = useRef(false);
  const hasLoadedInitialDataRef = useRef(false);

  const fetchDeductionsFromDb = async (): Promise<BookingDeductionRecord[]> => {
    const { data, error: err } = await supabase
      .from('inventory_deductions')
      .select('*')
      .order('deducted_at', { ascending: false });

    if (err) {
      console.error('Error fetching inventory_deductions from Supabase:', err.message);
      return deductionRecords;
    }

    const mapped = (data || []).map(mapDbRowToDeductionRecord);
    setDeductionRecords(mapped);
    return mapped;
  };

  const upsertDeductionInDb = async (record: BookingDeductionRecord): Promise<void> => {
    const { error: err } = await supabase
      .from('inventory_deductions')
      .upsert({
        booking_id: String(record.bookingId),
        booking_name: record.bookingName,
        package_name: record.packageName,
        guest_count: record.guestCount,
        deducted_at: record.deductedAt,
        items: record.items,
        updated_at: new Date().toISOString()
      }, { onConflict: 'booking_id' });

    if (err) {
      console.error('Error upserting inventory_deductions in Supabase:', err.message);
    }
  };

  const deleteDeductionFromDb = async (bookingId: string | number): Promise<void> => {
    const { error: err } = await supabase
      .from('inventory_deductions')
      .delete()
      .eq('booking_id', String(bookingId));

    if (err) {
      console.error('Error deleting from inventory_deductions in Supabase:', err.message);
    }
  };

  const fetchMovementsFromDb = async (): Promise<void> => {
    const { data, error: err } = await supabase
      .from('inventory_stock_movements')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);

    if (!err && data) {
      setStockMovements(data.map(mapDbRowToStockMovement));
    }
  };

  const fetchPackageRulesFromDb = async (): Promise<void> => {
    const { data, error: err } = await supabase
      .from('inventory_package_rules')
      .select('*');

    if (!err && data) {
      const rulesMap: Record<string, PackageEquipmentRule[]> = {};
      for (const row of data) {
        if (row.package_name && Array.isArray(row.rules)) {
          rulesMap[row.package_name] = row.rules;
        }
      }
      setCustomPackageRules(rulesMap);
    }
  };

  const refreshItems = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [invRes, dedRes, movRes, rulesRes] = await Promise.all([
        supabase.from('inventory').select('*').order('name', { ascending: true }),
        supabase.from('inventory_deductions').select('*').order('deducted_at', { ascending: false }),
        supabase.from('inventory_stock_movements').select('*').order('timestamp', { ascending: false }).limit(200),
        supabase.from('inventory_package_rules').select('*')
      ]);

      if (invRes.error) {
        throw invRes.error;
      }

      if (invRes.data) {
        const mapped: InventoryItem[] = invRes.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          stock: Number(item.stock) || 0,
          minStock: Number(item.min_stock) || 0,
          unit: item.unit || 'pcs',
          status: computeItemStatus(Number(item.stock) || 0, Number(item.min_stock) || 0, item.status)
        }));
        setItems(mapped);
      }

      if (!dedRes.error && dedRes.data) {
        setDeductionRecords(dedRes.data.map(mapDbRowToDeductionRecord));
      }

      if (!movRes.error && movRes.data) {
        setStockMovements(movRes.data.map(mapDbRowToStockMovement));
      }

      if (!rulesRes.error && rulesRes.data) {
        const rulesMap: Record<string, PackageEquipmentRule[]> = {};
        for (const row of rulesRes.data) {
          if (row.package_name && Array.isArray(row.rules)) {
            rulesMap[row.package_name] = row.rules;
          }
        }
        setCustomPackageRules(rulesMap);
      }

      hasLoadedInitialDataRef.current = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error("Error fetching inventory:", msg);
      setError(msg);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // React to booking changes from BookingContext in real-time once initial Supabase load finishes
  useEffect(() => {
    if (hasLoadedInitialDataRef.current && contextBookings && contextBookings.length > 0) {
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
        { event: "*", schema: "public", table: "inventory_deductions" },
        () => {
          fetchDeductionsFromDb();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_stock_movements" },
        () => {
          fetchMovementsFromDb();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_package_rules" },
        () => {
          fetchPackageRulesFromDb();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        async () => {
          await refreshItems(true);
          await reconcileCompletedEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const recordStockMovement = (movement: Omit<StockMovement, 'id' | 'timestamp'>) => {
    const newMovement: StockMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString()
    };
    setStockMovements(prev => [newMovement, ...prev.slice(0, 199)]);

    supabase
      .from('inventory_stock_movements')
      .insert([{
        id: newMovement.id,
        item_id: String(newMovement.itemId),
        item_name: newMovement.itemName,
        change: newMovement.change,
        previous_stock: newMovement.previousStock,
        new_stock: newMovement.newStock,
        type: newMovement.type,
        reason: newMovement.reason,
        booking_id: newMovement.bookingId !== undefined ? String(newMovement.bookingId) : null,
        booking_name: newMovement.bookingName || null,
        timestamp: newMovement.timestamp,
        user_name: newMovement.user
      }])
      .then(({ error: err }) => {
        if (err) console.error('Failed to persist stock movement to Supabase:', err.message);
      });
  };

  const getPackageRules = (packageName: string, currentItemsList?: InventoryItem[]): PackageEquipmentRule[] => {
    if (customPackageRules[packageName] && customPackageRules[packageName].length > 0) {
      return customPackageRules[packageName];
    }
    return deriveDynamicPackageRules(currentItemsList || items);
  };

  const savePackageRules = (packageName: string, rules: PackageEquipmentRule[]) => {
    setCustomPackageRules(prev => ({
      ...prev,
      [packageName]: rules
    }));

    supabase
      .from('inventory_package_rules')
      .upsert({
        package_name: packageName,
        rules,
        updated_at: new Date().toISOString()
      }, { onConflict: 'package_name' })
      .then(({ error: err }) => {
        if (err) console.error('Failed to save package rules to Supabase:', err.message);
      });
  };

  const calculatePackageEquipment = (
    packageName: string,
    pax: number,
    inclusions?: string[],
    currentItemsList?: InventoryItem[],
    corkageData?: {
      hasLechonTable?: boolean;
      alcoholicBeveragesCount?: number;
      outsideFoodCount?: number;
    }
  ): EquipmentRequirement[] => {
    const rules = getPackageRules(packageName, currentItemsList);
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

    // Auto-allocate extra equipment based on contract Corkage additions (Term 8):
    if (corkageData) {
      const extraChafing = (corkageData.hasLechonTable ? 1 : 0) + (Number(corkageData.outsideFoodCount) || 0);
      const extraGlasses = (Number(corkageData.alcoholicBeveragesCount) || 0) * 4; // Glassware service per bottle
      const extraPlates = corkageData.hasLechonTable ? 50 : 0; // 50 small plates for lechon setup

      if (extraChafing > 0) {
        const chafing = calculated.find(r => r.itemName.toLowerCase().includes('chafing') || r.itemName.toLowerCase().includes('warmer'));
        if (chafing) {
          chafing.quantity += extraChafing;
        } else {
          calculated.push({
            itemName: 'Chafing dishes',
            category: 'Event Equipment',
            quantity: 5 + extraChafing,
            unit: 'pcs',
            type: 'fixed'
          });
        }
      }

      if (extraGlasses > 0) {
        const glasses = calculated.find(r => r.itemName.toLowerCase() === 'glassware' || r.itemName.toLowerCase().includes('glass'));
        if (glasses) {
          glasses.quantity += extraGlasses;
        } else {
          calculated.push({
            itemName: 'Glassware',
            category: 'Tableware',
            quantity: extraGlasses,
            unit: 'pcs',
            type: 'fixed'
          });
        }
      }

      if (extraPlates > 0) {
        const plates = calculated.find(r => r.itemName.toLowerCase() === 'plates');
        if (plates) {
          plates.quantity += extraPlates;
        }
      }

      if (corkageData.hasLechonTable) {
        const buffetTable = calculated.find(r => r.itemName.toLowerCase().includes('buffet'));
        if (buffetTable) {
          buffetTable.quantity += 1;
        }
      }
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
   * Always checks and persists directly against Supabase `inventory_deductions`.
   */
  const deductBookingInventory = async (
    bookingId: string | number,
    bookingName: string,
    packageName: string,
    guestCount: number,
    inclusions?: string[],
    corkageData?: any
  ): Promise<boolean> => {
    const idStr = String(bookingId);

    // Prevent concurrent double-deductions
    if (pendingDeductions.current.has(idStr)) {
      return true;
    }

    pendingDeductions.current.add(idStr);

    try {
      // 1. Check directly in Supabase `inventory_deductions` to guarantee single source of truth across all origins/devices
      const { data: existingRow, error: checkErr } = await supabase
        .from('inventory_deductions')
        .select('*')
        .eq('booking_id', idStr)
        .maybeSingle();

      if (!checkErr && existingRow) {
        await fetchDeductionsFromDb();
        return true;
      }

      // 2. Fetch fresh inventory items from Supabase so we never deduct from stale state
      const { data: freshInvData, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .order('name', { ascending: true });

      if (invErr || !freshInvData || freshInvData.length === 0) {
        return false;
      }

      const freshItems: InventoryItem[] = freshInvData.map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        stock: Number(item.stock) || 0,
        minStock: Number(item.min_stock) || 0,
        unit: item.unit || 'pcs',
        status: computeItemStatus(Number(item.stock) || 0, Number(item.min_stock) || 0, item.status)
      }));

      const requirements = calculatePackageEquipment(packageName, guestCount, inclusions, freshItems, corkageData);
      const deductedItemsList: BookingDeductionRecord['items'] = [];

      // Prepare deduction record and reserve in Supabase `inventory_deductions`
      for (const req of requirements) {
        const inventoryItem = freshItems.find(i => 
          i.status !== 'Archived' && 
          i.name.toLowerCase() === req.itemName.toLowerCase()
        );

        if (inventoryItem) {
          const prevStock = inventoryItem.stock;
          const inHouseQty = Math.min(Math.max(0, prevStock), req.quantity);
          const outsourcedQty = req.quantity - inHouseQty;

          deductedItemsList.push({
            itemId: inventoryItem.id,
            itemName: inventoryItem.name,
            quantity: inHouseQty,
            outsourcedQuantity: outsourcedQty,
            unit: req.unit
          });
        }
      }

      const record: BookingDeductionRecord = {
        bookingId: idStr,
        bookingName,
        packageName,
        guestCount,
        deductedAt: new Date().toISOString(),
        items: deductedItemsList
      };

      // 3. Persist the deduction record in Supabase FIRST so no other tab/device can double-deduct
      await upsertDeductionInDb(record);

      // 4. Perform stock updates in Supabase
      for (const deducted of deductedItemsList) {
        const inventoryItem = freshItems.find(i => String(i.id) === String(deducted.itemId));
        if (!inventoryItem) continue;

        const prevStock = inventoryItem.stock;
        const inHouseQty = deducted.quantity;
        const outsourcedQty = deducted.outsourcedQuantity || 0;
        const newStock = Math.max(0, prevStock - inHouseQty);
        const newStatus = inventoryItem.status === 'Archived' ? 'Archived' : getStatus(newStock, inventoryItem.minStock);

        inventoryItem.stock = newStock;
        inventoryItem.status = newStatus;

        if (inHouseQty > 0) {
          await supabase
            .from('inventory')
            .update({ stock: newStock, status: newStatus })
            .eq('id', inventoryItem.id);

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
          recordStockMovement({
            itemId: inventoryItem.id,
            itemName: inventoryItem.name,
            change: 0,
            previousStock: newStock,
            newStock: newStock,
            type: 'Outsourced',
            reason: `Outsourced ${outsourcedQty} ${deducted.unit} (shortage) for Booking #${bookingId} — needed ${inHouseQty + outsourcedQty}, in-house ${inHouseQty}`,
            bookingId,
            bookingName,
            user: 'System (Booking Engine)'
          });
        }
      }

      setItems(freshItems);
      await fetchDeductionsFromDb();
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

    const confirmedBookings = (currentBookings || [])
      .filter((b: any) => (b.status || 'Pending') === 'Confirmed')
      .sort((a: any, b: any) => {
        const timeA = a.event_date ? new Date(a.event_date).getTime() : Infinity;
        const timeB = b.event_date ? new Date(b.event_date).getTime() : Infinity;
        return timeA - timeB;
      });

    if (confirmedBookings.length === 0) return false;

    const { data: dbItems, error: invFetchErr } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true });

    if (invFetchErr || !dbItems) {
      return false;
    }

    const workingItems: InventoryItem[] = dbItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      stock: Number(item.stock) || 0,
      minStock: Number(item.min_stock) || 0,
      unit: item.unit || 'pcs',
      status: computeItemStatus(Number(item.stock) || 0, Number(item.min_stock) || 0, item.status)
    }));

    let recordsSource: BookingDeductionRecord[] = overrideRecords || await fetchDeductionsFromDb();

    const workingRecords: BookingDeductionRecord[] = recordsSource.map(rec => ({
      ...rec,
      items: rec.items.map(it => ({ ...it }))
    }));

    let didReallocate = false;
    const itemsToUpdateInDb = new Map<string | number, InventoryItem>();
    const recordsToUpdateInDb = new Map<string, BookingDeductionRecord>();

    for (const b of confirmedBookings) {
      const rec = workingRecords.find(r => String(r.bookingId) === String(b.id));
      if (!rec) continue;

      for (let i = 0; i < rec.items.length; i++) {
        const recItem = rec.items[i];
        const outsourced = recItem.outsourcedQuantity || 0;
        if (outsourced <= 0) continue;

        const invItem = workingItems.find(it =>
          String(it.id) === String(recItem.itemId) ||
          it.name.toLowerCase().trim() === recItem.itemName.toLowerCase().trim()
        );

        if (!invItem || invItem.stock <= 0) continue;

        const shiftQty = Math.min(invItem.stock, outsourced);
        if (shiftQty <= 0) continue;

        const prevStock = invItem.stock;
        const newStock = prevStock - shiftQty;
        invItem.stock = newStock;
        invItem.status = invItem.status === 'Archived' ? 'Archived' : getStatus(newStock, invItem.minStock);

        recItem.quantity += shiftQty;
        recItem.outsourcedQuantity = outsourced - shiftQty;

        itemsToUpdateInDb.set(invItem.id, invItem);
        recordsToUpdateInDb.set(String(rec.bookingId), rec);
        didReallocate = true;

        recordStockMovement({
          itemId: invItem.id,
          itemName: invItem.name,
          change: -shiftQty,
          previousStock: prevStock,
          newStock: newStock,
          type: 'Booking Deduction',
          reason: `Auto-reallocated from warehouse supplies to ongoing Confirmed Booking #${rec.bookingId} (${rec.bookingName}) — converted ${shiftQty} outsourced units to in-house`,
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
          reason: `Outsourced rental reduced by ${shiftQty} ${recItem.unit} for Booking #${rec.bookingId} as warehouse supplies became available`,
          bookingId: rec.bookingId,
          bookingName: rec.bookingName,
          user: 'System (Equipment Monitoring Reconciler)'
        });
      }
    }

    if (didReallocate) {
      for (const invItem of itemsToUpdateInDb.values()) {
        await supabase
          .from('inventory')
          .update({ stock: invItem.stock, status: invItem.status })
          .eq('id', invItem.id);
      }

      for (const rec of recordsToUpdateInDb.values()) {
        await upsertDeductionInDb(rec);
      }

      setItems(workingItems);
      setDeductionRecords(workingRecords);
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
    const idStr = String(bookingId);

    // 1. Read directly from Supabase `inventory_deductions`
    const { data: dbRow, error: fetchErr } = await supabase
      .from('inventory_deductions')
      .select('*')
      .eq('booking_id', idStr)
      .maybeSingle();

    if (fetchErr || !dbRow) {
      return false;
    }

    const record = mapDbRowToDeductionRecord(dbRow);

    // 2. Delete the deduction record from Supabase FIRST so no other tab/device can double-restore
    await deleteDeductionFromDb(idStr);

    // 3. Fetch fresh inventory items from Supabase
    const { data: freshInvData } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true });

    const updatedItems: InventoryItem[] = (freshInvData || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      stock: Number(item.stock) || 0,
      minStock: Number(item.min_stock) || 0,
      unit: item.unit || 'pcs',
      status: computeItemStatus(Number(item.stock) || 0, Number(item.min_stock) || 0, item.status)
    }));

    for (const item of record.items) {
      const inventoryItem = updatedItems.find(
        i => String(i.id) === String(item.itemId) || i.name.toLowerCase() === item.itemName.toLowerCase()
      );
      if (!inventoryItem) continue;

      if (item.quantity > 0) {
        const prevStock = inventoryItem.stock;
        const newStock = prevStock + item.quantity;
        const newStatus = inventoryItem.status === 'Archived' ? 'Archived' : getStatus(newStock, inventoryItem.minStock);

        inventoryItem.stock = newStock;
        inventoryItem.status = newStatus;

        await supabase
          .from('inventory')
          .update({ stock: newStock, status: newStatus })
          .eq('id', inventoryItem.id);

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

    setItems(updatedItems);
    const updatedRecords = await fetchDeductionsFromDb();

    // Reallocate returned warehouse supplies to any ongoing Confirmed bookings that have outsourced items
    await reallocateReturnedStockToConfirmedBookings(undefined, updatedRecords);

    return true;
  };

  /**
   * Automatically checks all deducted bookings in Supabase `inventory_deductions`,
   * restores items from concluded or deleted bookings, and synchronizes active Confirmed bookings.
   */
  const reconcileCompletedEvents = async (_bookingsList?: any[]): Promise<number> => {
    if (isReconcilingRef.current) {
      return 0;
    }

    isReconcilingRef.current = true;
    try {
      // Use provided bookings list if available to avoid redundant egress, otherwise fetch minimal required columns
      const fetchBookingsPromise = (_bookingsList && _bookingsList.length > 0)
        ? Promise.resolve({ data: _bookingsList, error: null })
        : supabase.from('bookings').select('id, status, guest_count, additional_pax, packages(name, inclusions), profiles(name)');

      const [bookingsRes, deductionsRes, invRes] = await Promise.all([
        fetchBookingsPromise,
        supabase.from('inventory_deductions').select('*').order('deducted_at', { ascending: false }),
        supabase.from('inventory').select('*').order('name', { ascending: true })
      ]);

      if (bookingsRes.error || deductionsRes.error || invRes.error) {
        return 0;
      }

      const currentBookings = bookingsRes.data || [];
      let currentRecords = (deductionsRes.data || []).map(mapDbRowToDeductionRecord);
      const currentInvItems: InventoryItem[] = (invRes.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        stock: Number(item.stock) || 0,
        minStock: Number(item.min_stock) || 0,
        unit: item.unit || 'pcs',
        status: computeItemStatus(Number(item.stock) || 0, Number(item.min_stock) || 0, item.status)
      }));

      if (currentInvItems.length === 0) {
        return 0;
      }

      let restoredCount = 0;

      // 1. Restore completed/cancelled/archived bookings, and purge orphaned deleted bookings
      for (const record of currentRecords) {
        const matchedBooking = currentBookings.find((b: any) => String(b.id) === String(record.bookingId));

        if (!matchedBooking) {
          const success = await restoreBookingInventory(
            record.bookingId,
            record.bookingName,
            `Booking #${record.bookingId} removed from database - Equipment returned to equipment monitoring`
          );
          if (success) restoredCount++;
          continue;
        }

        const bookingStatus = matchedBooking.status || 'Pending';
        const isDone = bookingStatus === 'Completed' || bookingStatus === 'Cancelled' || bookingStatus === 'Archived';

        if (isDone) {
          const success = await restoreBookingInventory(
            record.bookingId,
            record.bookingName,
            `Booking marked ${bookingStatus} - Equipment returned to equipment monitoring`
          );
          if (success) restoredCount++;
        }
      }

      // Refresh records from Supabase after any restorations
      currentRecords = await fetchDeductionsFromDb();

      // 2. Ensure every Confirmed booking has an active deduction record in Supabase
      const confirmedBookings = currentBookings.filter((b: any) => (b.status || 'Pending') === 'Confirmed');
      let anyNewDeduction = false;
      for (const b of confirmedBookings) {
        const alreadyHas = currentRecords.some((d) => String(d.bookingId) === String(b.id));
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
          anyNewDeduction = true;
        }
      }

      if (anyNewDeduction) {
        currentRecords = await fetchDeductionsFromDb();
      }

      // 3. Harmonize existing confirmed booking records with current dynamic rules or updated pax counts
      for (const rec of currentRecords) {
        const b = confirmedBookings.find(cb => String(cb.id) === String(rec.bookingId));
        if (!b) continue;
        const pkgName = b.packages?.name || b.package || b.packageName || 'Event Package';
        const guestCount = Number(b.guest_count ?? b.guestCount ?? 50);
        const additionalPax = Number(b.additional_pax ?? b.additionalPax ?? 0);
        const totalPax = guestCount + additionalPax;
        const inclusions = b.packages?.inclusions || b.inclusions || [];
        const corkage = (b as any).corkage_info || (b as any).logistics_info?.corkage || null;
        const expectedReqs = calculatePackageEquipment(pkgName, totalPax, inclusions, currentInvItems, corkage);

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
            const invItem = currentInvItems.find(i => i.status !== 'Archived' && i.name.toLowerCase().trim() === req.itemName.toLowerCase().trim());
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
          await upsertDeductionInDb(rec);
        }
      }

      // 4. Reallocate available warehouse supplies to ongoing confirmed bookings
      await reallocateReturnedStockToConfirmedBookings(currentBookings, currentRecords);

      return restoredCount;
    } finally {
      isReconcilingRef.current = false;
    }
  };

  /**
   * Manually marks a booking as Completed and restores all allocated equipment.
   */
  const completeBookingAndReturnInventory = async (
    bookingId: string | number,
    bookingName?: string
  ): Promise<boolean> => {
    await supabase
      .from('bookings')
      .update({ status: 'Completed' })
      .eq('id', bookingId);

    await restoreBookingInventory(
      bookingId,
      bookingName,
      `Event Completed - All equipment returned to equipment monitoring (Booking #${bookingId})`
    );
    return true;
  };

  // Run automatic reconciliation and active booking sync periodically
  useEffect(() => {
    if (!isLoading && items.length > 0 && hasLoadedInitialDataRef.current) {
      reconcileCompletedEvents();
    }

    const interval = setInterval(() => {
      if (hasLoadedInitialDataRef.current) {
        reconcileCompletedEvents();
      }
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
