import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  PackageSearch,
  AlertTriangle,
  ArrowUpRight,
  Warehouse,
  X,
  CheckCircle2,
  Archive,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Boxes,
  ClipboardList,
  History,
  Settings2,
  RefreshCw,
  Printer,
  Calendar,
  AlertCircle,
  Sliders,
  Sparkles,
  CheckSquare,
  Square,
  Users,
  Utensils,
  Eye,
  Check,
  Trash2,
  Save,
  RotateCcw,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  useInventory,
  InventoryItem,
  StockMovement,
  PackageEquipmentRule,
  deriveDynamicPackageRules,
} from "../context/InventoryContext";
import { useBooking } from "../context/BookingContext";
import { supabase } from "../utils/supabase";
import { logAuditAction } from "../utils/auditLogger";

const categories = [
  "Event Equipment",
  "Furniture",
  "Decor & Ceremony Items",
  "Linen & Styling",
  "Tableware",
];
const units = ["pcs", "sets", "boxes", "packs", "kg", "g", "lbs", "L", "ml"];

type TabType = "stock" | "rules" | "movements" | "packing";

export function InventoryPage() {
  const {
    items,
    isLoading,
    stockMovements,
    deductionRecords,
    addItem,
    updateStock,
    archiveItem,
    updateItem,
    calculatePackageEquipment,
    checkInventoryAvailability,
    getAllocatedStock,
    getPackageRules,
    savePackageRules,
    refreshItems,
    reconcileCompletedEvents,
  } = useInventory();

  const { bookings } = useBooking();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>("stock");

  // Reconcile status state
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const count = await reconcileCompletedEvents(bookings);
      if (count > 0) {
        setReconcileMsg(`Successfully returned supplies from ${count} completed event(s) back into inventory!`);
      } else {
        setReconcileMsg("All inventory equipment is up-to-date with active event schedules.");
      }
      setTimeout(() => setReconcileMsg(null), 4000);
    } catch (e) {
      console.error("Reconciliation error:", e);
    } finally {
      setIsReconciling(false);
    }
  };

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [sortStatus, setSortStatus] = useState<"asc" | "desc" | null>(null);

  // Modals & States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);
  const [restockReason, setRestockReason] = useState<string>("Supplier delivery / Purchase");
  const [adjustmentType, setAdjustmentType] = useState<StockMovement["type"]>("Restock");
  const [formError, setFormError] = useState<string | null>(null);
  const [itemToArchive, setItemToArchive] = useState<string | number | null>(null);

  // New Item State
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: "",
    category: "Event Equipment",
    stock: undefined,
    minStock: 10,
    unit: "pcs",
  });

  // Edit Item State
  const [editFormData, setEditFormData] = useState({
    name: "",
    category: "Event Equipment",
    minStock: 10,
    unit: "pcs",
  });

  // Dynamic Packages List from Supabase
  const [packageList, setPackageList] = useState<{ id: string | number; name: string }[]>([]);
  const [selectedPackageForSim, setSelectedPackageForSim] = useState<string>("Basic Wedding Package");
  const [simulatedPax, setSimulatedPax] = useState<number>(50);

  useEffect(() => {
    const fetchPackages = async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name")
        .neq("status", "Archived")
        .order("name", { ascending: true });

      if (data && data.length > 0) {
        setPackageList(data);
        if (!data.some((p) => p.name === selectedPackageForSim)) {
          setSelectedPackageForSim(data[0].name);
        }
      }
    };
    fetchPackages();
  }, []);

  // Editable rules state for the currently selected package
  const [activePackageRules, setActivePackageRules] = useState<PackageEquipmentRule[]>([]);
  const [isRuleEditMode, setIsRuleEditMode] = useState(false);
  const [isAddRuleModalOpen, setIsAddRuleModalOpen] = useState(false);
  const [ruleSuccessMsg, setRuleSuccessMsg] = useState<string | null>(null);

  const [newRule, setNewRule] = useState<{
    itemName: string;
    category: string;
    type: "per_pax" | "fixed";
    ratio: number;
    fixedCount: number;
    unit: string;
  }>({
    itemName: "",
    category: "Tableware",
    type: "per_pax",
    ratio: 1.0,
    fixedCount: 1,
    unit: "pcs",
  });

  useEffect(() => {
    if (selectedPackageForSim) {
      setActivePackageRules(getPackageRules(selectedPackageForSim));
    }
  }, [selectedPackageForSim, items]);

  const handleSaveRules = () => {
    savePackageRules(selectedPackageForSim, activePackageRules);
    setRuleSuccessMsg(`Equipment rules saved for "${selectedPackageForSim}"!`);
    setIsRuleEditMode(false);
    setTimeout(() => setRuleSuccessMsg(null), 4000);
  };

  const handleResetToAutoRules = () => {
    // Reset to dynamically derived rules from warehouse items
    const derived = deriveDynamicPackageRules(items);
    setActivePackageRules(derived);
    savePackageRules(selectedPackageForSim, derived);
    setRuleSuccessMsg(`Reset rules to warehouse auto-detection for "${selectedPackageForSim}"!`);
    setTimeout(() => setRuleSuccessMsg(null), 4000);
  };

  const handleDeleteRule = (index: number) => {
    const updated = activePackageRules.filter((_, idx) => idx !== index);
    setActivePackageRules(updated);
    savePackageRules(selectedPackageForSim, updated);
  };

  const handleAddRuleToPackage = () => {
    if (!newRule.itemName) return;
    const selectedInvItem = items.find((i) => i.name === newRule.itemName);
    const addedRule: PackageEquipmentRule = {
      itemName: newRule.itemName,
      category: selectedInvItem?.category || newRule.category,
      type: newRule.type,
      ratio: newRule.type === "per_pax" ? Number(newRule.ratio) || 1.0 : undefined,
      fixedCount: newRule.type === "fixed" ? Number(newRule.fixedCount) || 1 : undefined,
      unit: selectedInvItem?.unit || newRule.unit || "pcs",
    };

    const updated = [...activePackageRules.filter((r) => r.itemName.toLowerCase() !== newRule.itemName.toLowerCase()), addedRule];
    setActivePackageRules(updated);
    savePackageRules(selectedPackageForSim, updated);
    setIsAddRuleModalOpen(false);
    setNewRule({
      itemName: "",
      category: "Tableware",
      type: "per_pax",
      ratio: 1.0,
      fixedCount: 1,
      unit: "pcs",
    });
    setRuleSuccessMsg(`Added "${newRule.itemName}" to "${selectedPackageForSim}" rules!`);
    setTimeout(() => setRuleSuccessMsg(null), 3000);
  };

  // Event Packing Checklist State
  const confirmedBookings = useMemo(() => {
    return bookings.filter(
      (b) => (b.status || "Pending") === "Confirmed"
    );
  }, [bookings]);

  const [selectedBookingForPacking, setSelectedBookingForPacking] = useState<number | string>(
    confirmedBookings[0]?.id || ""
  );
  const [packedItemsMap, setPackedItemsMap] = useState<Record<string, boolean>>({});

  // Movement Log Filter
  const [movementFilterType, setMovementFilterType] = useState<string>("All");
  const [movementSearch, setMovementSearch] = useState<string>("");

  // Handler: Add Item
  const handleAddItem = async () => {
    if (
      !newItem.name ||
      !newItem.category ||
      newItem.stock === undefined ||
      newItem.minStock === undefined
    )
      return;

    const nameRegex = /^[a-zA-Z\sñÑ\-']+$/;
    if (!nameRegex.test(newItem.name)) {
      setFormError("Item name cannot contain numbers or special characters.");
      return;
    }

    await addItem({
      name: newItem.name.trim(),
      category: newItem.category,
      stock: Number(newItem.stock),
      minStock: Number(newItem.minStock),
      unit: newItem.unit || "pcs",
    });

    await logAuditAction({
      action: "Added Inventory Item",
      target: newItem.name.trim(),
      type: "Create",
      details: `Added new item to ${newItem.category} with initial stock of ${newItem.stock} ${newItem.unit || "pcs"}`,
    });

    setIsAddModalOpen(false);
    setFormError(null);
    setNewItem({
      name: "",
      category: "Event Equipment",
      stock: undefined,
      minStock: 10,
      unit: "pcs",
    });
  };

  // Handler: Restock / Adjust
  const handleApplyRestockOrAdjustment = async () => {
    if (!selectedItem) return;

    if (restockAmount === 0) {
      setFormError("Please enter a non-zero adjustment amount.");
      return;
    }

    const effectiveChange = adjustmentType === "Damaged/Loss" ? -Math.abs(restockAmount) : (adjustmentType === "Restock" ? Math.abs(restockAmount) : restockAmount);

    await updateStock(selectedItem.id, effectiveChange, restockReason, adjustmentType);

    await logAuditAction({
      action: adjustmentType === "Restock" ? "Restocked Inventory" : "Adjusted Stock",
      target: selectedItem.name,
      type: "Update",
      details: `${adjustmentType}: ${effectiveChange > 0 ? "+" : ""}${effectiveChange} ${selectedItem.unit} (${restockReason})`,
    });

    setIsRestockModalOpen(false);
    setSelectedItem(null);
    setRestockAmount(10);
    setRestockReason("Supplier delivery / Purchase");
    setAdjustmentType("Restock");
    setFormError(null);
  };

  // Handler: Edit Details
  const handleSaveEditItem = async () => {
    if (!selectedItem) return;

    if (!editFormData.name.trim()) {
      setFormError("Item name is required.");
      return;
    }

    const nameRegex = /^[a-zA-Z\sñÑ\-']+$/;
    if (!nameRegex.test(editFormData.name)) {
      setFormError("Item name cannot contain numbers or special characters.");
      return;
    }

    await updateItem(selectedItem.id, {
      name: editFormData.name.trim(),
      category: editFormData.category,
      minStock: editFormData.minStock,
      unit: editFormData.unit,
    });

    await logAuditAction({
      action: "Updated Inventory Item",
      target: editFormData.name,
      type: "Update",
      details: `Modified details for ${editFormData.name} in category ${editFormData.category}`,
    });

    setIsEditModalOpen(false);
    setSelectedItem(null);
    setFormError(null);
  };

  // Filtered Inventory Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        filterCategory === "All" ||
        item.category === filterCategory ||
        (filterCategory === "Event Equipment" && item.category === "Equipment");
      const isArchived =
        item.status === "Archived" || item.status?.toLowerCase() === "archived";
      const matchesArchiveStatus = showArchived ? isArchived : !isArchived;
      const matchesStatusFilter =
        filterStatus === "All" || item.status === filterStatus;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesArchiveStatus &&
        matchesStatusFilter
      );
    });
  }, [items, searchQuery, filterCategory, filterStatus, showArchived]);

  const sortedItems = useMemo(() => {
    if (!sortStatus) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      const statusOrder: Record<string, number> = {
        Critical: 1,
        "Low Stock": 2,
        Healthy: 3,
        Archived: 4,
      };
      const valA = statusOrder[a.status] || 5;
      const valB = statusOrder[b.status] || 5;
      if (valA < valB) return sortStatus === "asc" ? -1 : 1;
      if (valA > valB) return sortStatus === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortStatus]);

  const activeItems = useMemo(() => {
    return items.filter(
      (i) => i.status !== "Archived" && i.status?.toLowerCase() !== "archived"
    );
  }, [items]);

  const lowStockItems = useMemo(() => {
    return activeItems.filter((i) => i.status !== "Healthy");
  }, [activeItems]);

  const stats = useMemo(() => {
    const totalUnits = activeItems.reduce((acc, i) => acc + i.stock, 0);
    const totalAllocated = activeItems.reduce((acc, i) => acc + getAllocatedStock(i.id), 0);
    return {
      totalTypes: activeItems.length,
      lowStockCount: lowStockItems.length,
      totalUnits,
      totalAllocated,
    };
  }, [activeItems, lowStockItems, getAllocatedStock]);

  // Selected Booking details for packing sheet
  const selectedBookingDetails = useMemo(() => {
    return bookings.find((b) => String(b.id) === String(selectedBookingForPacking));
  }, [bookings, selectedBookingForPacking]);

  const packingList = useMemo(() => {
    if (!selectedBookingDetails) return [];
    const pkgName = selectedBookingDetails.package || "Basic Wedding Package";
    const totalPax = (selectedBookingDetails.guestCount || 50) + (selectedBookingDetails.additionalPax || 0);

    return calculatePackageEquipment(
      pkgName,
      totalPax
    );
  }, [selectedBookingDetails, calculatePackageEquipment]);

  // Filtered Stock Movements
  const filteredMovements = useMemo(() => {
    return stockMovements.filter((m) => {
      const matchesType =
        movementFilterType === "All" || m.type === movementFilterType;
      const matchesSearch =
        m.itemName.toLowerCase().includes(movementSearch.toLowerCase()) ||
        m.reason.toLowerCase().includes(movementSearch.toLowerCase()) ||
        (m.bookingName || "").toLowerCase().includes(movementSearch.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [stockMovements, movementFilterType, movementSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Inventory & Supply Management
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Connected warehouse tracking, package deductions, and event logistics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleReconcile}
            disabled={isReconciling}
            title="Reconcile Completed Events & Return Equipment"
            className="flex items-center gap-2 px-3.5 py-2.5 border border-natural-border bg-white rounded-lg text-xs font-bold text-natural-text-main hover:bg-natural-bg transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={cn("w-3.5 h-3.5 text-natural-accent", isReconciling && "animate-spin")} />
            <span>Auto-Return Check</span>
            {deductionRecords.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-natural-accent/10 text-natural-accent font-bold">
                {deductionRecords.length} Active Events
              </span>
            )}
          </button>
          <button
            onClick={() => refreshItems()}
            title="Refresh Stock Data"
            className="p-2.5 border border-natural-border bg-white rounded-lg text-natural-text-main hover:bg-natural-bg transition-all shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-natural-text-light" />
          </button>
          <button
            onClick={() => {
              setIsAddModalOpen(true);
              setFormError(null);
            }}
            className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Item
          </button>
        </div>
      </div>

      {reconcileMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 shadow-xs">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-emerald-950 font-serif">
            {reconcileMsg}
          </p>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 bg-white flex items-center gap-4">
          <div className="p-3 bg-natural-bg rounded-xl border border-natural-border">
            <Warehouse className="w-5 h-5 text-natural-accent" />
          </div>
          <div>
            <p className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
              Total Item Types
            </p>
            <h4 className="text-2xl font-bold font-serif text-natural-text-main">
              {stats.totalTypes}
            </h4>
          </div>
        </div>

        <div className="glass-card p-5 bg-white flex items-center gap-4 border-l-4 border-natural-accent">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
              Restock Needed
            </p>
            <h4 className="text-2xl font-bold font-serif text-natural-accent">
              {stats.lowStockCount} Items
            </h4>
          </div>
        </div>

        <div className="glass-card p-5 bg-white flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
              Total Units In Stock
            </p>
            <h4 className="text-2xl font-bold font-serif text-natural-text-main">
              {stats.totalUnits.toLocaleString()}
            </h4>
          </div>
        </div>

        <div className="glass-card p-5 bg-white flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
              Allocated to Events
            </p>
            <h4 className="text-2xl font-bold font-serif text-green-700">
              {stats.totalAllocated.toLocaleString()} Units
            </h4>
          </div>
        </div>
      </div>

      {/* Low Stock Replenishment Alert Bar (If any) */}
      {lowStockItems.length > 0 && !showArchived && activeTab === "stock" && (
        <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 font-serif">
                Stock Attention Required ({lowStockItems.length} items low)
              </h4>
              <p className="text-xs text-amber-900/80 mt-0.5">
                The following supplies are near or below minimum requirement:{" "}
                <span className="font-semibold">
                  {lowStockItems.map((i) => i.name).slice(0, 5).join(", ")}
                  {lowStockItems.length > 5 ? ` and ${lowStockItems.length - 5} more` : ""}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={() => {
                if (lowStockItems[0]) {
                  setSelectedItem(lowStockItems[0]);
                  setRestockAmount(Math.max(10, lowStockItems[0].minStock * 2 - lowStockItems[0].stock));
                  setAdjustmentType("Restock");
                  setRestockReason("Replenish low stock");
                  setIsRestockModalOpen(true);
                }
              }}
              className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
            >
              Quick Restock Priority
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-natural-border pb-1">
        {[
          { id: "stock", label: "Stock Control", icon: Warehouse },
          { id: "rules", label: "Package Equipment Rules & Simulator", icon: Sliders },
          { id: "movements", label: "Stock Movement History", icon: History },
          { id: "packing", label: "Event Prep & Packing Sheet", icon: ClipboardList },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
                isActive
                  ? "bg-natural-accent text-white shadow-sm"
                  : "bg-white border border-natural-border text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === "movements" && stockMovements.length > 0 && (
                <span className={cn("px-1.5 py-0.2 rounded-full text-[9px]", isActive ? "bg-white/20 text-white" : "bg-natural-bg text-natural-text-main")}>
                  {stockMovements.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: STOCK CONTROL & OVERVIEW */}
      {activeTab === "stock" && (
        <div className="glass-card bg-white overflow-hidden space-y-4">
          <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search supplies, furniture, tableware..."
                className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowArchived(false)}
                  className={cn(
                    "px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                    !showArchived
                      ? "bg-natural-accent text-white shadow-sm"
                      : "bg-natural-bg text-natural-text-light hover:text-natural-text-main"
                  )}
                >
                  Active ({activeItems.length})
                </button>
                <button
                  onClick={() => setShowArchived(true)}
                  className={cn(
                    "px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5",
                    showArchived
                      ? "bg-natural-text-main text-white shadow-sm"
                      : "bg-natural-bg text-natural-text-light hover:text-natural-text-main"
                  )}
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archived
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 border border-natural-border rounded-lg bg-white">
                <Filter className="w-3.5 h-3.5 text-natural-text-main" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="text-xs font-bold text-natural-text-main bg-transparent outline-none cursor-pointer uppercase tracking-wider"
                >
                  <option value="All">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="All">All Statuses</option>
                <option value="Healthy">Healthy</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-natural-text-light">
                <div className="w-8 h-8 border-4 border-natural-accent border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-serif italic">Loading warehouse inventory...</p>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-natural-text-light">
                <PackageSearch className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-serif italic">No inventory items found</p>
                <p className="text-[0.7rem] uppercase tracking-widest mt-1">
                  Adjust filters or add new supplies to your stock
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-natural-bg/30">
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                      Item & Category
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border text-center">
                      Physical Stock
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border text-center">
                      Allocated (Events)
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                      Min. Required
                    </th>
                    <th
                      className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border cursor-pointer hover:text-natural-accent transition-colors select-none"
                      onClick={() =>
                        setSortStatus((prev) =>
                          prev === "asc" ? "desc" : prev === "desc" ? null : "asc"
                        )
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        Stock Health
                        {sortStatus === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-natural-accent" />
                        ) : sortStatus === "desc" ? (
                          <ArrowDown className="w-3 h-3 text-natural-accent" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const allocated = getAllocatedStock(item.id);
                    const stockPercentage =
                      item.status === "Archived"
                        ? 0
                        : Math.min((item.stock / Math.max(1, item.minStock * 2)) * 100, 100);

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "transition-colors group",
                          item.status === "Archived"
                            ? "bg-natural-bg/40 opacity-60 grayscale-[0.5]"
                            : "hover:bg-natural-bg/20"
                        )}
                      >
                        <td className="px-6 py-4 border-b border-natural-border/50">
                          <div>
                            <p className="text-sm font-bold text-natural-text-main tracking-tight">
                              {item.name}
                            </p>
                            <span className="inline-block text-[0.65rem] text-natural-text-light font-bold uppercase tracking-widest mt-0.5 px-2 py-0.5 bg-natural-bg rounded">
                              {item.category}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-natural-border/50">
                          <div className="flex flex-col items-center gap-1.5 min-w-[130px]">
                            <div className="flex justify-between w-full text-[0.7rem] font-bold text-natural-text-main">
                              <span>
                                {item.stock} {item.unit}
                              </span>
                              <span className="opacity-40 text-[10px]">
                                {item.minStock > 0
                                  ? `${Math.round((item.stock / item.minStock) * 100)}%`
                                  : "100%"}
                              </span>
                            </div>
                            <div className="h-[6px] w-full bg-natural-bg border border-natural-border rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-700",
                                  item.status === "Healthy"
                                    ? "bg-[#6b8e23]"
                                    : item.status === "Low Stock"
                                      ? "bg-orange-400"
                                      : item.status === "Archived"
                                        ? "bg-gray-400"
                                        : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                )}
                                style={{ width: `${stockPercentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-natural-border/50 text-center">
                          {allocated > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Boxes className="w-3 h-3" />
                              {allocated} {item.unit}
                            </span>
                          ) : (
                            <span className="text-[10px] text-natural-text-light/50 font-medium">
                              0 {item.unit}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 border-b border-natural-border/50">
                          <p className="text-xs font-semibold text-natural-text-light">
                            {item.minStock} {item.unit}
                          </p>
                        </td>
                        <td className="px-6 py-4 border-b border-natural-border/50">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                item.status === "Healthy"
                                  ? "bg-[#6b8e23]"
                                  : item.status === "Low Stock"
                                    ? "bg-orange-400"
                                    : item.status === "Archived"
                                      ? "bg-gray-400"
                                      : "bg-red-500"
                              )}
                            />
                            <span
                              className={cn(
                                "text-[0.65rem] font-bold uppercase tracking-widest",
                                item.status === "Healthy"
                                  ? "text-[#6b8e23]"
                                  : item.status === "Low Stock"
                                    ? "text-orange-500"
                                    : item.status === "Archived"
                                      ? "text-gray-500"
                                      : "text-red-500"
                              )}
                            >
                              {item.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-natural-border/50 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {item.status !== "Archived" ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setRestockAmount(10);
                                    setAdjustmentType("Restock");
                                    setRestockReason("Supplier delivery / Purchase");
                                    setFormError(null);
                                    setIsRestockModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-natural-accent/10 hover:bg-natural-accent text-natural-accent hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="Quick Restock"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Restock</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setEditFormData({
                                      name: item.name,
                                      category: item.category,
                                      minStock: item.minStock,
                                      unit: item.unit,
                                    });
                                    setFormError(null);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="p-1.5 text-natural-text-light hover:text-natural-accent hover:bg-natural-bg rounded-lg transition-all"
                                  title="Edit Item Details"
                                >
                                  <Settings2 className="w-4 h-4" />
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
      )}

      {/* TAB 2: PACKAGE EQUIPMENT RULES & SIMULATOR */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="glass-card p-6 bg-white space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-natural-border pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-natural-text-main flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-natural-accent" />
                  Dynamic Package Equipment Manager & Simulator
                </h3>
                <p className="text-xs text-natural-text-light mt-0.5">
                  Calculates and manages required inventory supplies for any existing or future catering package.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Package:
                  </span>
                  <select
                    value={selectedPackageForSim}
                    onChange={(e) => setSelectedPackageForSim(e.target.value)}
                    className="px-4 py-2 border border-natural-border rounded-xl text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider hover:bg-natural-bg/40 transition-colors shadow-xs"
                  >
                    {packageList.length > 0 ? (
                      packageList.map((pkg) => (
                        <option key={pkg.id} value={pkg.name}>
                          {pkg.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Basic Wedding Package">Basic Wedding Package</option>
                        <option value="Classic Wedding Package">Classic Wedding Package</option>
                        <option value="Premium Wedding Package">Premium Wedding Package</option>
                        <option value="Standard Event Package">Standard Event Package</option>
                      </>
                    )}
                  </select>
                </div>

                <button
                  onClick={() => setIsAddRuleModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-natural-accent text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-natural-accent/90 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Equipment Item
                </button>

                <button
                  onClick={handleResetToAutoRules}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-natural-border text-natural-text-main hover:bg-natural-bg rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title="Reset to warehouse dynamic detection"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-natural-text-light" />
                  Auto-Detect
                </button>
              </div>
            </div>

            {ruleSuccessMsg && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 animate-in fade-in duration-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-xs font-bold text-green-800">{ruleSuccessMsg}</p>
              </div>
            )}

            {/* Interactive Pax Simulator Slider */}
            <div className="p-6 bg-natural-bg/30 border border-natural-border rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-natural-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-natural-text-main">
                    Simulate Event Guest Count (Pax):
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-serif font-bold text-natural-accent">
                    {simulatedPax}
                  </span>
                  <span className="text-xs text-natural-text-light uppercase font-bold">
                    Guests
                  </span>
                </div>
              </div>

              <input
                type="range"
                min={20}
                max={350}
                step={5}
                value={simulatedPax}
                onChange={(e) => setSimulatedPax(Number(e.target.value))}
                className="w-full accent-natural-accent h-2 bg-natural-border rounded-lg cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-natural-text-light font-bold uppercase tracking-widest">
                <span>20 Pax (Intimate)</span>
                <span>100 Pax (Classic)</span>
                <span>200 Pax (Grand)</span>
                <span>350 Pax (Large Scale)</span>
              </div>
            </div>

            {/* Live Calculation Grid */}
            {(() => {
              const check = checkInventoryAvailability(selectedPackageForSim, simulatedPax);
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-natural-text-main">
                      Dynamic Equipment Requirements for "{selectedPackageForSim}" ({check.requirements.length} Items):
                    </h4>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border",
                        check.isAvailable
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      )}
                    >
                      {check.isAvailable
                        ? "✓ Fully Available in Warehouse"
                        : "⚠️ Insufficient Stock Alert"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {check.requirements.map((req, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-4 rounded-xl border transition-all flex flex-col justify-between group",
                          req.isAvailable
                            ? "bg-white border-natural-border/70 shadow-xs"
                            : "bg-red-50/50 border-red-200 shadow-xs"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-natural-text-main">
                              {req.itemName}
                            </p>
                            <span className="text-[10px] text-natural-text-light font-bold uppercase tracking-wider">
                              {req.category} • {req.type === "per_pax" ? "Per Guest Ratio" : "Fixed Setup"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded",
                                req.isAvailable
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              )}
                            >
                              {req.isAvailable ? "OK" : `Short -${req.deficit}`}
                            </span>
                            <button
                              onClick={() => handleDeleteRule(idx)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-natural-text-light hover:text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer"
                              title="Remove item from package"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-natural-border/40 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-natural-text-light uppercase font-bold block">
                              Required for {simulatedPax} Pax
                            </span>
                            <span className="text-sm font-bold text-natural-accent">
                              {req.quantity} {req.unit}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-natural-text-light uppercase font-bold block">
                              Warehouse Stock
                            </span>
                            <span className="text-sm font-semibold text-natural-text-main">
                              {req.availableStock} {req.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENT HISTORY */}
      {activeTab === "movements" && (
        <div className="glass-card bg-white overflow-hidden space-y-4">
          <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
                placeholder="Search history by item, client, reason..."
                className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-natural-text-light">
                Type Filter:
              </span>
              <select
                value={movementFilterType}
                onChange={(e) => setMovementFilterType(e.target.value)}
                className="px-3 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="All">All Types</option>
                <option value="Booking Deduction">Booking Deductions</option>
                <option value="Booking Return">Booking Returns</option>
                <option value="Restock">Restocks</option>
                <option value="Manual Adjustment">Adjustments</option>
                <option value="Damaged/Loss">Damaged / Loss</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            {filteredMovements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-natural-text-light">
                <History className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-serif italic">No movement records recorded yet</p>
                <p className="text-[0.7rem] uppercase tracking-widest mt-1">
                  Automatic deductions and restocks will appear here in chronological order
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-natural-bg/30">
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                      Timestamp
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                      Type
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                      Item Name
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border text-center">
                      Quantity Change
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                      Stock After
                    </th>
                    <th className="px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest text-natural-text-light border-b border-natural-border">
                      Reason / Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-natural-bg/20 transition-colors">
                      <td className="px-6 py-4 border-b border-natural-border/50 text-xs text-natural-text-main font-medium">
                        {new Date(mov.timestamp).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 border-b border-natural-border/50">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                            mov.type === "Booking Deduction"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : mov.type === "Booking Return"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : mov.type === "Restock"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-gray-50 text-gray-700 border-gray-200"
                          )}
                        >
                          {mov.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-natural-border/50 text-sm font-bold text-natural-text-main">
                        {mov.itemName}
                      </td>
                      <td className="px-6 py-4 border-b border-natural-border/50 text-center">
                        <span
                          className={cn(
                            "text-sm font-bold font-serif",
                            mov.change > 0 ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {mov.change > 0 ? `+${mov.change}` : mov.change}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-natural-border/50 text-xs font-semibold text-natural-text-light">
                        {mov.newStock}
                      </td>
                      <td className="px-6 py-4 border-b border-natural-border/50 text-xs text-natural-text-main/80">
                        <p>{mov.reason}</p>
                        {mov.bookingName && (
                          <span className="text-[10px] text-natural-accent font-bold uppercase tracking-wider block mt-0.5">
                            Client: {mov.bookingName}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EVENT PREPARATION & PACKING SHEET */}
      {activeTab === "packing" && (
        <div className="space-y-6">
          <div className="glass-card p-6 bg-white space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-natural-border pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-natural-text-main flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-natural-accent" />
                  Warehouse Equipment Preparation & Packing Sheet
                </h3>
                <p className="text-xs text-natural-text-light mt-0.5">
                  Select a confirmed event to generate an interactive warehouse packing checklist.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedBookingForPacking}
                  onChange={(e) => {
                    setSelectedBookingForPacking(e.target.value);
                    setPackedItemsMap({});
                  }}
                  className="px-4 py-2 border border-natural-border rounded-xl text-xs font-bold text-natural-text-main bg-white outline-none cursor-pointer uppercase tracking-wider"
                >
                  {confirmedBookings.length === 0 ? (
                    <option value="">No confirmed bookings</option>
                  ) : (
                    confirmedBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.customerName || `Booking #${b.id}`} - {b.package || "Event"} ({b.date || "Scheduled"})
                      </option>
                    ))
                  )}
                </select>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-natural-bg hover:bg-natural-border/50 border border-natural-border rounded-xl text-xs font-bold text-natural-text-main uppercase tracking-wider transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Sheet
                </button>
              </div>
            </div>

            {selectedBookingDetails ? (
              <div className="space-y-6">
                {/* Event Summary Box */}
                <div className="p-6 bg-natural-bg/30 border border-natural-border rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-natural-text-light font-bold uppercase tracking-widest block">
                      Client Name
                    </span>
                    <span className="text-base font-serif font-bold text-natural-text-main">
                      {selectedBookingDetails.customerName || "Client"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-natural-text-light font-bold uppercase tracking-widest block">
                      Event Package
                    </span>
                    <span className="text-sm font-bold text-natural-accent">
                      {selectedBookingDetails.package || "Standard Package"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-natural-text-light font-bold uppercase tracking-widest block">
                      Guest Count
                    </span>
                    <span className="text-sm font-bold text-natural-text-main">
                      {selectedBookingDetails.guestCount || 50} Pax
                      {(selectedBookingDetails.additionalPax || 0) > 0 &&
                        ` (+${selectedBookingDetails.additionalPax} extra)`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-natural-text-light font-bold uppercase tracking-widest block">
                      Event Date & Venue
                    </span>
                    <span className="text-xs font-semibold text-natural-text-main block">
                      {selectedBookingDetails.date || "Scheduled Date"}
                    </span>
                    <span className="text-[10px] text-natural-text-light truncate block">
                      {selectedBookingDetails.venueName || "Venue"}
                    </span>
                  </div>
                </div>

                {/* Checklist Control */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-natural-text-main">
                      Packing Checklist ({packingList.length} Items):
                    </span>
                    <span className="text-[10px] font-bold text-natural-text-light bg-natural-bg px-2 py-0.5 rounded">
                      {Object.values(packedItemsMap).filter(Boolean).length} / {packingList.length} Packed
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const allPacked: Record<string, boolean> = {};
                        packingList.forEach((item) => {
                          allPacked[item.itemName] = true;
                        });
                        setPackedItemsMap(allPacked);
                      }}
                      className="text-[11px] font-bold text-natural-accent hover:underline uppercase tracking-wider"
                    >
                      Check All
                    </button>
                    <span className="text-natural-border">•</span>
                    <button
                      onClick={() => setPackedItemsMap({})}
                      className="text-[11px] font-bold text-natural-text-light hover:underline uppercase tracking-wider"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Checklist Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {packingList.map((item, i) => {
                    const isChecked = !!packedItemsMap[item.itemName];
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          setPackedItemsMap((prev) => ({
                            ...prev,
                            [item.itemName]: !prev[item.itemName],
                          }))
                        }
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between",
                          isChecked
                            ? "bg-green-50/80 border-green-200 shadow-xs"
                            : "bg-white border-natural-border hover:border-natural-accent/40 shadow-xs"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-5 h-5 rounded flex items-center justify-center transition-all",
                              isChecked
                                ? "bg-green-600 text-white"
                                : "border border-natural-border bg-natural-bg text-transparent"
                            )}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p
                              className={cn(
                                "text-sm font-bold tracking-tight",
                                isChecked
                                  ? "line-through text-green-900/60"
                                  : "text-natural-text-main"
                              )}
                            >
                              {item.itemName}
                            </p>
                            <span className="text-[10px] text-natural-text-light uppercase font-semibold">
                              {item.category}
                            </span>
                          </div>
                        </div>

                        <span
                          className={cn(
                            "text-sm font-bold font-serif px-2.5 py-1 rounded-lg",
                            isChecked
                              ? "bg-green-100 text-green-800"
                              : "bg-natural-bg text-natural-accent"
                          )}
                        >
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-natural-text-light italic">
                No confirmed event bookings found. Confirm an event in the Bookings tab to generate a prep sheet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD ITEM */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                Add New Inventory Supply
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormError(null);
                }}
                className="p-1 hover:bg-natural-bg rounded-lg"
              >
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
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Item Name
                </label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => {
                    setNewItem({ ...newItem, name: e.target.value });
                    setFormError(null);
                  }}
                  className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/10"
                  placeholder="e.g. Wine Glasses, Chafing Dishes..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Category
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Unit
                  </label>
                  <select
                    value={newItem.unit}
                    onChange={(e) =>
                      setNewItem({ ...newItem, unit: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white cursor-pointer"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    value={newItem.stock ?? ""}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        stock:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Min. Required Stock
                  </label>
                  <input
                    type="number"
                    value={newItem.minStock ?? ""}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        minStock:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormError(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!newItem.name || newItem.stock === undefined}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 disabled:opacity-50"
              >
                Create Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESTOCK / ADJUST STOCK */}
      {isRestockModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-serif font-bold text-natural-text-main">
                  Stock Adjustment
                </h3>
                <p className="text-xs text-natural-text-light font-medium uppercase tracking-wider mt-0.5">
                  {selectedItem.name} ({selectedItem.category})
                </p>
              </div>
              <button
                onClick={() => {
                  setIsRestockModalOpen(false);
                  setSelectedItem(null);
                  setFormError(null);
                }}
                className="p-1 hover:bg-natural-bg rounded-lg"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-600">{formError}</p>
                </div>
              )}

              {/* Action Type Selector */}
              <div className="space-y-1">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: "Restock", label: "Restock (+)" },
                    { type: "Damaged/Loss", label: "Damage / Loss (-)" },
                    { type: "Manual Adjustment", label: "Audit / Other" },
                  ].map((btn) => (
                    <button
                      key={btn.type}
                      type="button"
                      onClick={() => {
                        setAdjustmentType(btn.type as StockMovement["type"]);
                        if (btn.type === "Restock") setRestockReason("Supplier delivery / Purchase");
                        if (btn.type === "Damaged/Loss") setRestockReason("Broken during event");
                        if (btn.type === "Manual Adjustment") setRestockReason("Physical inventory recount");
                      }}
                      className={cn(
                        "py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                        adjustmentType === btn.type
                          ? "bg-natural-accent text-white border-natural-accent shadow-xs"
                          : "bg-natural-bg/50 border-natural-border text-natural-text-main hover:bg-white"
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Presets & Input */}
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Quantity ({selectedItem.unit})
                </label>
                <div className="flex items-center gap-2">
                  {[10, 25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRestockAmount(preset)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        restockAmount === preset
                          ? "bg-natural-accent/10 border-natural-accent text-natural-accent"
                          : "bg-natural-bg/30 border-natural-border text-natural-text-main hover:bg-white"
                      )}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-center text-lg font-bold font-serif focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/10"
                />
              </div>

              {/* Stock Preview */}
              <div className="p-3 bg-natural-bg/40 border border-natural-border rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-natural-text-light uppercase font-bold block">
                    Current Stock
                  </span>
                  <span className="font-bold text-natural-text-main">
                    {selectedItem.stock} {selectedItem.unit}
                  </span>
                </div>
                <span className="text-natural-text-light font-bold text-sm">➔</span>
                <div className="text-right">
                  <span className="text-[10px] text-natural-text-light uppercase font-bold block">
                    New Stock After
                  </span>
                  <span className="font-bold text-natural-accent text-sm">
                    {Math.max(
                      0,
                      selectedItem.stock +
                        (adjustmentType === "Damaged/Loss"
                          ? -Math.abs(restockAmount)
                          : restockAmount)
                    )}{" "}
                    {selectedItem.unit}
                  </span>
                </div>
              </div>

              {/* Reason Input */}
              <div className="space-y-1">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Reason / Memo Note
                </label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-natural-accent/10"
                  placeholder="e.g. Purchased 50 new pieces from supplier"
                />
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button
                onClick={() => {
                  setIsRestockModalOpen(false);
                  setSelectedItem(null);
                  setFormError(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyRestockOrAdjustment}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 shadow-sm"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ITEM DETAILS */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                Edit Item Details
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedItem(null);
                  setFormError(null);
                }}
                className="p-1 hover:bg-natural-bg rounded-lg"
              >
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
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Item Name
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, name: e.target.value });
                    setFormError(null);
                  }}
                  className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Category
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, category: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Unit
                  </label>
                  <select
                    value={editFormData.unit}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, unit: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white cursor-pointer"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Min. Required Stock
                </label>
                <input
                  type="number"
                  value={editFormData.minStock}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      minStock: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                />
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedItem(null);
                  setFormError(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditItem}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ARCHIVE CONFIRMATION */}
      {itemToArchive !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border relative">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-gray-700 text-white shadow-lg">
                <Archive className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                Archive Item?
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                Are you sure you want to archive{" "}
                <span className="font-bold text-natural-text-main">
                  {items.find((i) => String(i.id) === String(itemToArchive))?.name}
                </span>
                ? It will be hidden from active inventory views.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (itemToArchive !== null) {
                      const item = items.find((i) => String(i.id) === String(itemToArchive));
                      await archiveItem(itemToArchive);
                      if (item) {
                        await logAuditAction({
                          action: "Archived Inventory Item",
                          target: item.name,
                          type: "Delete",
                          details: `Moved inventory item to archives`,
                        });
                      }
                    }
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

      {/* MODAL: ADD EQUIPMENT RULE TO PACKAGE */}
      {isAddRuleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif font-bold text-natural-text-main">
                  Link Equipment to Package
                </h3>
                <p className="text-xs text-natural-text-light font-medium mt-0.5">
                  Package: <span className="font-bold text-natural-accent">{selectedPackageForSim}</span>
                </p>
              </div>
              <button
                onClick={() => setIsAddRuleModalOpen(false)}
                className="p-1 hover:bg-natural-bg rounded-lg text-natural-text-light hover:text-natural-text-main cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Warehouse Inventory Supply
                </label>
                <select
                  value={newRule.itemName}
                  onChange={(e) => {
                    const item = items.find((i) => i.name === e.target.value);
                    setNewRule({
                      ...newRule,
                      itemName: e.target.value,
                      category: item?.category || newRule.category,
                      unit: item?.unit || newRule.unit,
                      type: item?.category === "Tableware" || item?.name.toLowerCase().includes("chair") ? "per_pax" : newRule.type,
                      ratio: item?.name.toLowerCase().includes("table") ? 0.1 : 1.0,
                    });
                  }}
                  className="w-full px-4 py-2.5 bg-natural-bg/50 border border-natural-border rounded-xl text-sm font-semibold focus:bg-white cursor-pointer outline-none"
                >
                  <option value="">Select an inventory item...</option>
                  {items
                    .filter((i) => i.status !== "Archived")
                    .map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name} ({item.category} • Stock: {item.stock} {item.unit})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Deduction Calculation Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewRule({ ...newRule, type: "per_pax" })}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer",
                      newRule.type === "per_pax"
                        ? "border-natural-accent bg-natural-accent/10 text-natural-accent"
                        : "border-natural-border bg-white text-natural-text-light hover:bg-natural-bg/40"
                    )}
                  >
                    <p className="font-bold">Per Guest Ratio</p>
                    <span className="text-[10px] opacity-75 font-normal">e.g. 1 plate / guest</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRule({ ...newRule, type: "fixed" })}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer",
                      newRule.type === "fixed"
                        ? "border-natural-accent bg-natural-accent/10 text-natural-accent"
                        : "border-natural-border bg-white text-natural-text-light hover:bg-natural-bg/40"
                    )}
                  >
                    <p className="font-bold">Fixed Setup Count</p>
                    <span className="text-[10px] opacity-75 font-normal">e.g. 2 buffet tables</span>
                  </button>
                </div>
              </div>

              {newRule.type === "per_pax" ? (
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Ratio per Guest (e.g. 1 = 1 unit per pax, 0.1 = 1 per 10 pax)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={newRule.ratio}
                    onChange={(e) => setNewRule({ ...newRule, ratio: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm font-semibold focus:bg-white outline-none"
                    placeholder="e.g. 1.0"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Fixed Units to Deduct per Event
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRule.fixedCount}
                    onChange={(e) => setNewRule({ ...newRule, fixedCount: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm font-semibold focus:bg-white outline-none"
                    placeholder="e.g. 2"
                  />
                </div>
              )}
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button
                type="button"
                onClick={() => setIsAddRuleModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-natural-border text-natural-text-light hover:bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newRule.itemName}
                onClick={handleAddRuleToPackage}
                className="flex-1 bg-natural-accent text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 disabled:opacity-50 transition-all cursor-pointer"
              >
                Link to Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

