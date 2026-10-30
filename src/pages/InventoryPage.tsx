import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Plus,
  ChevronDown,
  Check,
  Minus,
  Equal,
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
  GripVertical,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  useInventory,
  InventoryItem,
  StockMovement,
  normalizeStockStatus,
  computeItemStatus,
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

type MiddleColumnId = "physicalStock" | "inUse" | "minStock" | "stockStatus";

const DEFAULT_COLUMN_ORDER: MiddleColumnId[] = [
  "physicalStock",
  "inUse",
  "minStock",
  "stockStatus",
];

// Widths are percentages of the space between the fixed Item and Actions columns.
// They always sum to 100 so the table fits its container and no column can be pushed out of view.
const DEFAULT_COLUMN_WIDTHS: Record<MiddleColumnId, number> = {
  physicalStock: 31,
  inUse: 23,
  minStock: 23,
  stockStatus: 23,
};

const MIN_COLUMN_PERCENT = 18;
const COL_WIDTHS_STORAGE_KEY = "inventory_monitoring_col_widths_pct_v3";

export function InventoryPage() {
  const {
    items,
    isLoading,
    addItem,
    updateStock,
    archiveItem,
    updateItem,
    getAllocatedStock,
    getOutsourcedStock,
    refreshItems,
    reconcileCompletedEvents,
  } = useInventory();

  const { bookings } = useBooking();

  // Automatically sync active confirmed bookings on page load
  useEffect(() => {
    if (bookings && bookings.length > 0) {
      reconcileCompletedEvents(bookings);
    }
  }, [bookings]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [sortStatus, setSortStatus] = useState<"asc" | "desc" | null>(null);

  // Dynamic Adjustable Columns (monitoring table only)
  const [columnOrder, setColumnOrder] = useState<MiddleColumnId[]>(() => {
    try {
      const saved = localStorage.getItem("inventory_monitoring_col_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {}
    return DEFAULT_COLUMN_ORDER;
  });

  const [columnWidths, setColumnWidths] = useState<Record<MiddleColumnId, number>>(() => {
    try {
      const saved = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          const merged = { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
          const total = DEFAULT_COLUMN_ORDER.reduce((acc, id) => acc + (Number(merged[id]) || 0), 0);
          const allAboveMin = DEFAULT_COLUMN_ORDER.every((id) => Number(merged[id]) >= MIN_COLUMN_PERCENT);
          if (Math.abs(total - 100) < 0.5 && allAboveMin) return merged;
        }
      }
    } catch {}
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [draggedCol, setDraggedCol] = useState<MiddleColumnId | null>(null);
  const [dragOverCol, setDragOverCol] = useState<MiddleColumnId | null>(null);
  const resizingColRef = useRef<{
    colId: MiddleColumnId;
    neighborId: MiddleColumnId;
    startX: number;
    startWidth: number;
    startNeighborWidth: number;
    pxPerPercent: number;
  } | null>(null);

  const resetColumns = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem("inventory_monitoring_col_order");
      localStorage.removeItem("inventory_monitoring_col_widths");
      localStorage.removeItem(COL_WIDTHS_STORAGE_KEY);
    } catch {}
  };

  const handleDragStart = (e: React.DragEvent, colId: MiddleColumnId) => {
    setDraggedCol(colId);
    e.dataTransfer.setData("text/plain", colId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetColId: MiddleColumnId) => {
    e.preventDefault();
    if (draggedCol && draggedCol !== targetColId) {
      setDragOverCol(targetColId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetColId: MiddleColumnId) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetColId) {
      setDraggedCol(null);
      setDragOverCol(null);
      return;
    }
    setColumnOrder((prev) => {
      const fromIndex = prev.indexOf(draggedCol);
      const toIndex = prev.indexOf(targetColId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const newOrder = [...prev];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggedCol);
      try {
        localStorage.setItem("inventory_monitoring_col_order", JSON.stringify(newOrder));
      } catch {}
      return newOrder;
    });
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const handleDragEnd = () => {
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, colId: MiddleColumnId) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = columnOrder.indexOf(colId);
    const neighborId = columnOrder[idx + 1];
    if (!neighborId) return;

    const th = (e.currentTarget as HTMLElement).closest("th");
    const thWidthPx = th?.getBoundingClientRect().width ?? 0;
    const pxPerPercent = thWidthPx > 0 ? thWidthPx / columnWidths[colId] : 7.5;

    resizingColRef.current = {
      colId,
      neighborId,
      startX: e.clientX,
      startWidth: columnWidths[colId],
      startNeighborWidth: columnWidths[neighborId],
      pxPerPercent,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const r = resizingColRef.current;
      if (!r) return;
      const pair = r.startWidth + r.startNeighborWidth;
      const deltaPct = (moveEvent.clientX - r.startX) / r.pxPerPercent;
      // ~136px guarantees the longest single word ("REQUIRED" / "STATUS ↑↓") + grip icon + left padding
      // still has ~20px of right clearance before the resizer bar so they never overlap.
      const minPct = Math.min(
        pair / 2,
        Math.max(MIN_COLUMN_PERCENT, Math.min(22, 136 / r.pxPerPercent))
      );
      const newWidth = Math.max(
        minPct,
        Math.min(pair - minPct, r.startWidth + deltaPct)
      );
      setColumnWidths((prev) => ({
        ...prev,
        [r.colId]: newWidth,
        [r.neighborId]: pair - newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setColumnWidths((prev) => {
        try {
          localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(prev));
        } catch {}
        return prev;
      });
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Modals & States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<number | string>(0);
  const [restockReason, setRestockReason] = useState<string>("");
  const [showReasonDropdown, setShowReasonDropdown] = useState<boolean>(false);
  const [adjustmentType, setAdjustmentType] = useState<StockMovement["type"]>("Restock");
  const [adjustMode, setAdjustMode] = useState<"add" | "deduct">("add");
  const [customReasonNote, setCustomReasonNote] = useState<string>("");
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
  const [editFormData, setEditFormData] = useState<{
    name: string;
    category: string;
    minStock: number | string;
    unit: string;
  }>({
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

    if (Number(newItem.stock) > 100000 || Number(newItem.minStock) > 100000) {
      setFormError("Stock values cannot exceed 100,000.");
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

      const REASON_PRESETS = {
    add: [
      "Supplier delivery / Purchase",
      "Returned from event/rental",
      "Spare inventory found",
      "Restock from warehouse",
    ],
    deduct: [
      "Broken during event",
      "Lost / Unreturned",
      "Damaged / Wear and tear",
      "Disposed / Expired",
    ],
  };

  const numInput = Number(restockAmount) || 0;
  const effectiveChange = useMemo(() => {
    if (!selectedItem) return 0;
    return adjustMode === "add" ? Math.abs(numInput) : -Math.abs(numInput);
  }, [adjustMode, numInput, selectedItem]);

  const calculatedNewStock = useMemo(() => {
    if (!selectedItem) return 0;
    return Math.max(0, selectedItem.stock + effectiveChange);
  }, [selectedItem, effectiveChange]);

  const previewStatus = useMemo(() => {
    if (!selectedItem) return "Normal";
    return computeItemStatus(calculatedNewStock, selectedItem.minStock, selectedItem.status);
  }, [selectedItem, calculatedNewStock]);

  // Mode switcher that auto-switches reason note to match adjustment type
  const handleSwitchAdjustMode = (newMode: "add" | "deduct") => {
    setAdjustMode(newMode);
    setFormError(null);
    setRestockReason(REASON_PRESETS[newMode][0]);
  };

  // Continuous hold-to-step quantity handlers
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  const stepQuantity = useCallback((delta: number) => {
    setRestockAmount((prev) => {
      const cur = Number(prev) || 0;
      const next = Math.max(0, Math.min(100000, cur + delta));
      return next;
    });
    setFormError(null);
  }, []);

  const startHold = useCallback((delta: number) => {
    stopHold();
    stepQuantity(delta);
    holdTimerRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        stepQuantity(delta);
      }, 75);
    }, 350);
  }, [stepQuantity, stopHold]);

  // Handler: Restock / Adjust
  const handleApplyRestockOrAdjustment = async () => {
    if (!selectedItem) return;

    if (numInput <= 0) {
      setFormError("Please enter a valid quantity greater than 0.");
      return;
    }

    if (!restockReason.trim()) {
      setFormError("Reason is required. Please type a reason or select a preset.");
      return;
    }

    if (calculatedNewStock > 100000) {
      setFormError("Total stock cannot exceed 100,000.");
      return;
    }

    const finalReason = restockReason.trim();
    const movementType: StockMovement["type"] = adjustMode === "add" ? "Restock" : "Damaged/Loss";

    await updateStock(selectedItem.id, effectiveChange, finalReason, movementType);

    await logAuditAction({
      action: adjustMode === "add" ? "Restocked Equipment" : "Deducted Equipment / Loss",
      target: selectedItem.name,
      type: "Update",
      details: `${movementType}: ${effectiveChange >= 0 ? "+" : ""}${effectiveChange} ${selectedItem.unit} (From ${selectedItem.stock} to ${calculatedNewStock}) - ${finalReason}`,
    });

    setIsRestockModalOpen(false);
    setSelectedItem(null);
    setRestockAmount(0);
    setAdjustMode("add");
    setRestockReason("");
    setShowReasonDropdown(false);
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

    if (Number(editFormData.minStock) > 100000) {
      setFormError("Min. required stock cannot exceed 100,000.");
      return;
    }

    await updateItem(selectedItem.id, {
      name: editFormData.name.trim(),
      category: editFormData.category,
      minStock: Number(editFormData.minStock) || 0,
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
      const normStatus = item.status === "Archived" ? "Archived" : computeItemStatus(item.stock, item.minStock, item.status);
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
      const valA = statusOrder[a.status === "Archived" ? "Archived" : computeItemStatus(a.stock, a.minStock, a.status)] || 5;
      const valB = statusOrder[b.status === "Archived" ? "Archived" : computeItemStatus(b.stock, b.minStock, b.status)] || 5;
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
    return activeItems.filter((i) => computeItemStatus(i.stock, i.minStock, i.status) === "Low");
  }, [activeItems]);

  const stats = useMemo(() => {
    const totalUnits = activeItems.reduce((acc, i) => acc + i.stock, 0);
    const totalAllocated = activeItems.reduce((acc, i) => acc + getAllocatedStock(i.id), 0);
    const totalOutsourced = activeItems.reduce((acc, i) => acc + getOutsourcedStock(i.id), 0);
    return {
      totalTypes: activeItems.length,
      lowStockCount: lowStockItems.length,
      totalUnits,
      totalAllocated,
      totalOutsourced,
    };
  }, [activeItems, lowStockItems, getAllocatedStock, getOutsourcedStock]);

  const renderMiddleHeader = (colId: MiddleColumnId) => {
    const isDragging = draggedCol === colId;
    const isDragOver = dragOverCol === colId;
    const isLast = columnOrder[columnOrder.length - 1] === colId;

    return (
      <th
        key={colId}
        draggable
        onDragStart={(e) => handleDragStart(e, colId)}
        onDragOver={(e) => handleDragOver(e, colId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, colId)}
        onDragEnd={handleDragEnd}
        className={cn(
          "pl-3 pr-5 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border relative select-none transition-all group/th bg-transparent break-normal",
          isDragging && "opacity-40 bg-natural-accent/10",
          isDragOver && "bg-natural-accent/15",
          colId === "stockStatus" && "cursor-pointer hover:text-natural-accent"
        )}
        onClick={
          colId === "stockStatus"
            ? () => {
                setSortStatus((prev) =>
                  prev === "asc" ? "desc" : prev === "desc" ? null : "asc"
                );
              }
            : undefined
        }
      >
        <div className="flex items-center gap-1.5">
          <span title="Drag to rearrange column order" className="shrink-0 inline-flex">
            <GripVertical className="w-3.5 h-3.5 text-natural-text-light/40 group-hover/th:text-natural-text-light cursor-grab active:cursor-grabbing" />
          </span>
          {colId === "physicalStock" && (
            <span className="whitespace-normal break-normal leading-tight">Physical Stock</span>
          )}
          {colId === "inUse" && (
            <span className="whitespace-normal break-normal leading-tight">In-Use (Events)</span>
          )}
          {colId === "minStock" && (
            <span className="whitespace-normal break-normal leading-tight">Min. Required</span>
          )}
          {colId === "stockStatus" && (
            <span className="whitespace-normal break-normal leading-tight">
              Stock{" "}
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                Status
                {sortStatus === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-natural-accent shrink-0" />
                ) : sortStatus === "desc" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-natural-accent shrink-0" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-30 shrink-0" />
                )}
              </span>
            </span>
          )}
        </div>

        {/* Resizer handle on the right edge between adjustable middle columns (header row only) */}
        {!isLast && (
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, colId)}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-natural-accent/25 flex items-center justify-center select-none group/resizer z-30 transition-colors"
            title="Drag to resize column width"
          >
            <div className="w-[1.5px] h-5 bg-natural-border group-hover/resizer:bg-natural-accent transition-colors" />
          </div>
        )}
      </th>
    );
  };

  const renderMiddleCell = (colId: MiddleColumnId, item: InventoryItem) => {
    const allocated = getAllocatedStock(item.id);
    const outsourced = getOutsourcedStock(item.id);
    const totalStock = item.stock + allocated;
    const remainingPercent =
      item.status === "Archived" || totalStock === 0
        ? 0
        : Math.min(Math.round((item.stock / totalStock) * 100), 100);
    if (colId === "physicalStock") {
      return (
        <td
          key="physicalStock"
          className="px-4 py-5.5 border-b border-natural-border/50 transition-colors break-normal align-middle"
        >
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 w-full text-xs font-bold text-natural-text-main">
              <span>
                {totalStock.toLocaleString()} {item.unit} Total
              </span>
              <span
                className={cn(
                  "text-xs font-bold",
                  allocated > 0
                    ? "text-red-500 dark:text-red-400"
                    : "text-natural-text-light/50"
                )}
              >
                {allocated > 0
                  ? `-${allocated.toLocaleString()} Deducted`
                  : "0 Deducted"}
              </span>
            </div>
            <div className="h-[7px] w-full bg-natural-bg border border-natural-border rounded-full overflow-hidden">
              {(() => {
                const s = item.status === "Archived" ? "Archived" : computeItemStatus(item.stock, item.minStock, item.status);
                return (
                  <div
                    className={cn(
                      "h-full transition-all duration-700",
                      item.status === "Archived"
                        ? "bg-gray-400"
                        : item.stock === 0
                          ? "bg-gray-300 dark:bg-gray-700"
                          : s === "Low"
                            ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                            : s === "Normal"
                              ? "bg-amber-400"
                              : remainingPercent > 50
                            ? "bg-[#6b8e23]"
                            : remainingPercent > 20
                              ? "bg-amber-400"
                              : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                    )}
                    style={{ width: `${remainingPercent}%` }}
                  />
                );
              })()}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-natural-text-light font-medium">
              <span>
                Available:{" "}
                <strong className="text-natural-text-main font-semibold">
                  {item.stock.toLocaleString()} {item.unit}
                </strong>
              </span>
              <span className="text-[10px] opacity-75">
                {remainingPercent}% on-hand
              </span>
            </div>
          </div>
        </td>
      );
    }

    if (colId === "inUse") {
      return (
        <td
          key="inUse"
          className="px-4 py-5.5 border-b border-natural-border/50 transition-colors break-normal align-middle"
        >
          <div className="flex flex-col items-start gap-1">
            {allocated > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                <Boxes className="w-3.5 h-3.5" />
                {allocated.toLocaleString()} {item.unit} In-use
              </span>
            ) : (
              <span className="text-xs text-natural-text-light/50 font-medium">
                0 {item.unit} In-use
              </span>
            )}
            {outsourced > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60"
                title="Rent from external supplier to cover shortage — not part of warehouse stock"
              >
                <ArrowUpRight className="w-3 h-3" />+{outsourced.toLocaleString()} to outsource
              </span>
            )}
          </div>
        </td>
      );
    }

    if (colId === "minStock") {
      return (
        <td
          key="minStock"
          className="px-4 py-5.5 border-b border-natural-border/50 transition-colors break-normal align-middle"
        >
          <p className="text-sm font-semibold text-natural-text-main">
            {item.minStock} {item.unit}
          </p>
        </td>
      );
    }

    if (colId === "stockStatus") {
      const s = item.status === "Archived" ? "Archived" : computeItemStatus(item.stock, item.minStock, item.status);
      return (
        <td
          key="stockStatus"
          className="px-4 py-5.5 border-b border-natural-border/50 transition-colors break-normal align-middle"
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full",
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
                "text-xs font-bold uppercase tracking-wider",
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
        </td>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Equipment Tracking & Allocation
          </h2>
          <p className="text-natural-text-light text-xs font-medium uppercase tracking-wider">
            Real-time equipment status, event allocations, and return logistics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-card p-5 bg-white dark:bg-natural-card flex items-center gap-4">
          <div className="p-3 bg-natural-bg dark:bg-natural-bg/40 rounded-xl border border-natural-border">
            <Warehouse className="w-5 h-5 text-natural-accent" />
          </div>
          <div>
            <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
              Total Item Types
            </p>
            <h4 className="text-2xl font-bold font-serif text-natural-text-main">
              {stats.totalTypes}
            </h4>
          </div>
        </div>

        <div className="glass-card p-5 bg-white dark:bg-natural-card flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/60">
            <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
              Total Units In Stock
            </p>
            <h4 className="text-2xl font-bold font-serif text-natural-text-main">
              {stats.totalUnits.toLocaleString()}
            </h4>
          </div>
        </div>

        <div className="glass-card p-5 bg-white dark:bg-natural-card flex items-center gap-4">
          <div className="p-3 bg-green-50 dark:bg-emerald-950/50 rounded-xl border border-green-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
              In-Use (Events)
            </p>
            <h4 className="text-2xl font-bold font-serif text-green-700 dark:text-emerald-400">
              {stats.totalAllocated.toLocaleString()} Units
            </h4>
          </div>
        </div>

        <div className="glass-card p-5 bg-white dark:bg-natural-card flex items-center gap-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-xl border border-orange-200 dark:border-orange-800/60">
            <ArrowUpRight className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
              Outsourced (Rent)
            </p>
            <h4 className="text-2xl font-bold font-serif text-orange-700 dark:text-orange-400">
              {stats.totalOutsourced.toLocaleString()} Units
            </h4>
          </div>
        </div>
      </div>


      {/* Low Stock Replenishment Alert Bar (If any) */}
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

              <button
                type="button"
                onClick={resetColumns}
                className="flex items-center gap-1.5 px-3 py-2 border border-natural-border rounded-lg text-xs font-bold text-natural-text-light hover:text-natural-accent hover:bg-natural-bg transition-all cursor-pointer"
                title="Reset column positions and widths to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Columns</span>
              </button>
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
                <p className="text-xs uppercase tracking-wider mt-1">
                  Adjust filters or add new equipment items to your monitoring list
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[1000px] table-fixed text-left border-collapse">
                {/* Item (left) and Actions (right) have fixed shares and never move.
                    Middle columns split the remaining space by their adjustable percentages,
                    so the table always fits the container and no column can be hidden. */}
                <colgroup>
                  <col style={{ width: "18%" }} />
                  {columnOrder.map((colId) => (
                    <col key={colId} style={{ width: `${(columnWidths[colId] * 58) / 100}%` }} />
                  ))}
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-natural-bg/30">
                    <th className="px-4 sm:px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border select-none break-normal">
                      Item & Category
                    </th>
                    {columnOrder.map((colId) => renderMiddleHeader(colId))}
                    <th className="px-4 sm:px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-natural-text-light border-b border-natural-border select-none text-right break-normal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
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
                        <td className="px-4 sm:px-6 py-5.5 border-b border-natural-border/50 transition-colors break-normal align-middle">
                          <div className="min-w-0">
                            <p className="text-base font-bold text-natural-text-main tracking-normal leading-snug">
                              {item.name}
                            </p>
                            <span className="inline-block max-w-full text-xs text-natural-text-light font-bold uppercase tracking-wider mt-1 px-2.5 py-0.5 bg-natural-bg rounded break-normal">
                              {item.category}
                            </span>
                          </div>
                        </td>

                        {columnOrder.map((colId) => renderMiddleCell(colId, item))}

                        <td className="px-4 py-5.5 border-b border-natural-border/50 text-right transition-colors align-middle">
                          <div className="flex flex-nowrap justify-end items-center gap-1.5">
                            {item.status !== "Archived" ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setRestockAmount(0);
                                    setAdjustMode("add");
                                    setAdjustmentType("Restock");
                                    setRestockReason(REASON_PRESETS.add[0]);
                                    setFormError(null);
                                    setIsRestockModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-natural-accent/10 hover:bg-natural-accent text-natural-accent hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer text-center"
                                  title="Stock Adjustment"
                                >
                                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                                  <span className="whitespace-normal break-normal leading-tight">
                                    Stock Adjustment
                                  </span>
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
                                  className="p-2 shrink-0 text-natural-text-light hover:text-natural-accent hover:bg-natural-bg rounded-lg transition-all"
                                  title="Edit Item Details"
                                >
                                  <Settings2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setItemToArchive(item.id)}
                                  className="p-2 shrink-0 text-natural-text-light hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                                  title="Archive Item"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs font-bold text-natural-text-light/60 dark:text-natural-text-light uppercase tracking-wider bg-natural-bg/50 dark:bg-natural-bg/30 px-2.5 py-1 rounded border border-natural-border/40">
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
          <div className="bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
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
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">{formError}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    value={newItem.stock ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setNewItem({ ...newItem, stock: undefined });
                        return;
                      }
                      const num = Math.min(100000, Math.max(0, Number(val)));
                      setNewItem({ ...newItem, stock: num });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                        e.preventDefault();
                      }
                    }}
                    className="w-full px-4 py-2 bg-natural-bg/50 border border-natural-border rounded-xl text-sm focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                    Min. Required Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    value={newItem.minStock ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setNewItem({ ...newItem, minStock: undefined });
                        return;
                      }
                      const num = Math.min(100000, Math.max(0, Number(val)));
                      setNewItem({ ...newItem, minStock: num });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                        e.preventDefault();
                      }
                    }}
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
          <div className="bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-natural-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif font-bold text-natural-text-main flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-natural-accent" />
                  Stock Adjustment
                </h3>
                <p className="text-xs text-natural-text-light font-medium uppercase tracking-wider mt-0.5">
                  {selectedItem.name} <span className="opacity-50">•</span> {selectedItem.category}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-natural-bg border border-natural-border text-natural-text-main">
                  On Hand: <strong>{selectedItem.stock}</strong> {selectedItem.unit}
                </span>
                <button
                  onClick={() => {
                    setIsRestockModalOpen(false);
                    setSelectedItem(null);
                    setShowReasonDropdown(false);
                    setFormError(null);
                  }}
                  className="p-1.5 hover:bg-natural-bg rounded-lg text-natural-text-light hover:text-natural-text-main transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Adjustment Type: Add or Remove */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-natural-text-light uppercase tracking-wider">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-natural-bg/60 rounded-xl border border-natural-border/70">
                  <button
                    type="button"
                    onClick={() => handleSwitchAdjustMode("add")}
                    className={cn(
                      "py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border",
                      adjustMode === "add"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-transparent border-transparent text-natural-text-main hover:bg-white dark:hover:bg-natural-card"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Stock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchAdjustMode("deduct")}
                    className={cn(
                      "py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border",
                      adjustMode === "deduct"
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-transparent border-transparent text-natural-text-main hover:bg-white dark:hover:bg-natural-card"
                    )}
                  >
                    <Minus className="w-4 h-4" />
                    <span>Remove / Loss</span>
                  </button>
                </div>
              </div>

              {/* 2. Stock Impact Preview (ABOVE QUANTITY AS REQUESTED) */}
              <div className="p-3.5 bg-natural-bg/40 border border-natural-border rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-natural-text-light uppercase font-bold tracking-wider block">
                    Current Stock
                  </span>
                  <span className="font-bold text-natural-text-main text-sm">
                    {selectedItem.stock.toLocaleString()} {selectedItem.unit}
                  </span>
                </div>
                <div className="text-center px-2">
                  <span className={cn(
                    "font-bold text-xs px-2 py-0.5 rounded-md",
                    adjustMode === "add"
                      ? "text-emerald-700 bg-emerald-500/15"
                      : "text-red-700 bg-red-500/15"
                  )}>
                    {numInput === 0 ? `0 ${selectedItem.unit}` : adjustMode === "add" ? `+${numInput} ${selectedItem.unit}` : `-${numInput} ${selectedItem.unit}`}
                  </span>
                  <span className="block text-natural-text-light/70 text-xs mt-0.5">➔</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-natural-text-light uppercase font-bold tracking-wider block">
                    New Stock After
                  </span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-bold text-natural-text-main text-sm font-serif">
                      {calculatedNewStock.toLocaleString()} {selectedItem.unit}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                        previewStatus === "High"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : previewStatus === "Normal"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : "bg-red-500/10 text-red-600 border-red-500/30"
                      )}
                    >
                      {previewStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Quantity Stepper */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-natural-text-light uppercase tracking-wider">
                  Quantity ({selectedItem.unit})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onMouseDown={() => startHold(-1)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      startHold(-1);
                    }}
                    onTouchEnd={stopHold}
                    onTouchCancel={stopHold}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-natural-bg/70 hover:bg-natural-bg border border-natural-border text-natural-text-main transition-colors cursor-pointer text-base font-bold shrink-0 select-none active:scale-95"
                    title="Decrease quantity (click or hold)"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      value={restockAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setRestockAmount("");
                          setFormError(null);
                          return;
                        }
                        const num = Number(val);
                        if (num > 100000) {
                          setRestockAmount(100000);
                          setFormError("Quantity cannot exceed 100,000.");
                          return;
                        }
                        if (num < 0) {
                          setRestockAmount(0);
                          return;
                        }
                        setRestockAmount(num);
                        setFormError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                          e.preventDefault();
                        }
                      }}
                      className="w-full h-11 px-4 bg-natural-bg/50 border border-natural-border rounded-xl text-center text-lg font-bold font-serif focus:bg-white dark:focus:bg-natural-bg focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-natural-text-light pointer-events-none">
                      {selectedItem.unit}
                    </span>
                  </div>

                  <button
                    type="button"
                    onMouseDown={() => startHold(1)}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      startHold(1);
                    }}
                    onTouchEnd={stopHold}
                    onTouchCancel={stopHold}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-natural-bg/70 hover:bg-natural-bg border border-natural-border text-natural-text-main transition-colors cursor-pointer text-base font-bold shrink-0 select-none active:scale-95"
                    title="Increase quantity (click or hold)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 4. Reason Text Box (Required, Starts Blank, Dropdown Opens Upwards) */}
              <div className="space-y-1.5 relative">
                <label className="text-[11px] font-bold text-natural-text-light uppercase tracking-wider flex items-center justify-between">
                  <span>
                    Reason / Memo Note <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[10px] font-medium text-red-500/90 lowercase">required</span>
                </label>

                {/* Combobox Textbox with Dropdown Trigger */}
                <div className="relative">
                  <input
                    type="text"
                    value={restockReason}
                    onChange={(e) => {
                      setRestockReason(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Enter reason for adjustment..."
                    className="w-full px-3.5 py-2.5 pr-10 bg-natural-bg/50 border border-natural-border rounded-xl text-xs focus:bg-white dark:focus:bg-natural-bg focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all placeholder:text-natural-text-light/50"
                  />

                  {/* Dropdown Chevron Button INSIDE the textbox */}
                  <button
                    type="button"
                    onClick={() => setShowReasonDropdown((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-natural-text-light hover:text-natural-text-main transition-colors cursor-pointer rounded-lg hover:bg-natural-bg"
                    title="Select a preset reason"
                  >
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        showReasonDropdown && "rotate-180 text-natural-accent"
                      )}
                    />
                  </button>

                  {/* Floating Dropdown Menu (OPENS UPWARDS TO PREVENT CUTOFF) */}
                  {showReasonDropdown && (
                    <>
                      {/* Transparent backdrop click-away */}
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowReasonDropdown(false)}
                      />

                      <div className="absolute left-0 right-0 bottom-full mb-1.5 z-40 bg-white dark:bg-natural-card border border-natural-border rounded-xl shadow-2xl overflow-hidden py-1 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in-50 zoom-in-95 duration-150">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-natural-text-light/70 border-b border-natural-border/40 bg-natural-bg/40">
                          Choose Preset Reason ({adjustMode === "add" ? "Adding" : "Removing"})
                        </div>
                        {REASON_PRESETS[adjustMode].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setRestockReason(opt);
                              setShowReasonDropdown(false);
                              setFormError(null);
                            }}
                            className={cn(
                              "w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer border-b border-natural-border/20 last:border-b-0",
                              restockReason === opt
                                ? "bg-natural-accent/10 text-natural-accent font-semibold"
                                : "text-natural-text-main hover:bg-natural-bg"
                            )}
                          >
                            <span>{opt}</span>
                            {restockReason === opt && (
                              <Check className="w-3.5 h-3.5 text-natural-accent shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-natural-bg/30 border-t border-natural-border flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsRestockModalOpen(false);
                  setSelectedItem(null);
                  setShowReasonDropdown(false);
                  setFormError(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-natural-border text-natural-text-light hover:bg-natural-bg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyRestockOrAdjustment}
                disabled={numInput <= 0}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                  adjustMode === "add"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {adjustMode === "add" ? `Confirm Add (+${numInput})` : `Confirm Remove (-${numInput})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ITEM DETAILS */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
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
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">{formError}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                  <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                  Min. Required Stock
                </label>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  value={editFormData.minStock}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setEditFormData({
                        ...editFormData,
                        minStock: "",
                      });
                      setFormError(null);
                      return;
                    }
                    const num = Number(val);
                    if (num > 100000) {
                      setEditFormData({
                        ...editFormData,
                        minStock: 100000,
                      });
                      setFormError("Min. required stock cannot exceed 100,000.");
                      return;
                    }
                    if (num < 0) {
                      setEditFormData({
                        ...editFormData,
                        minStock: 0,
                      });
                      return;
                    }
                    setEditFormData({
                      ...editFormData,
                      minStock: num,
                    });
                    setFormError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                      e.preventDefault();
                    }
                  }}
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
