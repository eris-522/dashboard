import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  PackageSearch,
  ArrowUpRight,
  Warehouse,
  X,
  CheckCircle2,
  Archive,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Boxes,
  RefreshCw,
  Calendar,
  AlertCircle,
  Eye,
  Settings2,
  Sliders,
  RotateCcw,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  useInventory,
  InventoryItem,
  StockMovement,
  normalizeStockStatus,
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

export function InventoryPage() {
  const {
    items,
    isLoading,
    deductionRecords,
    addItem,
    updateStock,
    archiveItem,
    updateItem,
    getAllocatedStock,
    refreshItems,
    reconcileCompletedEvents,
  } = useInventory();

  const { bookings } = useBooking();

  // Reconcile status state
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const count = await reconcileCompletedEvents(bookings);
      if (count > 0) {
        setReconcileMsg(`Successfully returned equipment from ${count} completed event(s) back into equipment monitoring!`);
      } else {
        setReconcileMsg("All equipment monitoring records are up-to-date with active event schedules.");
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
      action: "Added Equipment Item",
      target: newItem.name.trim(),
      type: "Create",
      details: `Added new equipment item ${newItem.name.trim()} (${newItem.category}) with initial stock of ${newItem.stock} ${newItem.unit || "pcs"}`,
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
      action: adjustmentType === "Restock" ? "Restocked Equipment" : "Adjusted Equipment Stock",
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
      action: "Updated Equipment Item",
      target: editFormData.name,
      type: "Update",
      details: `Modified details for ${editFormData.name} in category ${editFormData.category}`,
    });

    setIsEditModalOpen(false);
    setSelectedItem(null);
    setFormError(null);
  };

  // Filtered Equipment Items
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
      const normStatus = normalizeStockStatus(item.status);
      const matchesStatusFilter =
        filterStatus === "All" ||
        normStatus === filterStatus ||
        item.status === filterStatus;

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
        Low: 1,
        Normal: 2,
        High: 3,
        Archived: 4,
        Critical: 1,
        "Low Stock": 2,
        Healthy: 3,
      };
      const valA = statusOrder[normalizeStockStatus(a.status)] || 5;
      const valB = statusOrder[normalizeStockStatus(b.status)] || 5;
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
    return activeItems.filter((i) => normalizeStockStatus(i.status) === "Low");
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



  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Equipment Tracking & Allocation
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Real-time equipment status, event allocations, and return logistics
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      {lowStockItems.length > 0 && !showArchived && (
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
                The following equipment items are near or below minimum requirement:{" "}
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

      {/* Equipment Stock Table */}
      <div className="glass-card bg-white overflow-hidden space-y-4">
          <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search equipment, furniture, tableware..."
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
                <option value="High">High</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-natural-text-light">
                <div className="w-8 h-8 border-4 border-natural-accent border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-serif italic">Loading equipment monitoring data...</p>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-natural-text-light">
                <PackageSearch className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-serif italic">No equipment items found</p>
                <p className="text-[0.7rem] uppercase tracking-widest mt-1">
                  Adjust filters or add new equipment items to your monitoring list
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
                        Stock Status
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
                              {(() => {
                                const s = normalizeStockStatus(item.status);
                                return (
                                  <div
                                    className={cn(
                                      "h-full transition-all duration-700",
                                      s === "High"
                                        ? "bg-[#6b8e23]"
                                        : s === "Normal"
                                          ? "bg-amber-400"
                                          : s === "Archived"
                                            ? "bg-gray-400"
                                            : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                    )}
                                    style={{ width: `${stockPercentage}%` }}
                                  />
                                );
                              })()}
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
                          {(() => {
                            const s = normalizeStockStatus(item.status);
                            return (
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    s === "High"
                                      ? "bg-[#6b8e23]"
                                      : s === "Normal"
                                        ? "bg-amber-400"
                                        : s === "Archived"
                                          ? "bg-gray-400"
                                          : "bg-red-500"
                                  )}
                                />
                                <span
                                  className={cn(
                                    "text-[0.65rem] font-bold uppercase tracking-widest",
                                    s === "High"
                                      ? "text-[#6b8e23]"
                                      : s === "Normal"
                                        ? "text-amber-600"
                                        : s === "Archived"
                                          ? "text-gray-500"
                                          : "text-red-500"
                                  )}
                                >
                                  {s}
                                </span>
                              </div>
                            );
                          })()}
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
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-natural-accent/10 hover:bg-natural-accent text-natural-accent hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="Stock Adjustment"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                  <span>Stock Adjustment</span>
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

      {/* MODAL: ADD ITEM */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <h3 className="text-xl font-serif font-bold text-natural-text-main">
                Add New Equipment Item
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
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: "Restock", label: "Restock (+)" },
                    { type: "Damaged/Loss", label: "Damage / Loss (-)" },
                  ].map((btn) => (
                    <button
                      key={btn.type}
                      type="button"
                      onClick={() => {
                        setAdjustmentType(btn.type as StockMovement["type"]);
                        if (btn.type === "Restock") setRestockReason("Supplier delivery / Purchase");
                        if (btn.type === "Damaged/Loss") setRestockReason("Broken during event");
                      }}
                      className={cn(
                        "py-2.5 px-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
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
                ? It will be hidden from active equipment monitoring views.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (itemToArchive !== null) {
                      const item = items.find((i) => String(i.id) === String(itemToArchive));
                      await archiveItem(itemToArchive);
                      if (item) {
                        await logAuditAction({
                          action: "Archived Equipment Item",
                          target: item.name,
                          type: "Delete",
                          details: `Moved equipment item to archives`,
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


    </div>
  );
}

export const EquipmentMonitoringPage = InventoryPage;
