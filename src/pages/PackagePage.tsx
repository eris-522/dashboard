import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  Package,
  Check,
  Users,
  UtensilsCrossed,
  Sparkles,
  X,
  Edit3,
  Archive,
  Trash2,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase"; // Database connection

// Feature: Defines the structure for Packages based on the Supabase table
export interface CateringPackage {
  id: string;
  name: string;
  pax: string;
  price: string;
  tag?: string;
  inclusions: string[];
  status: string;
}

export function PackagePage() {
  // Feature: State management for database arrays and UI toggles
  const [packages, setPackages] = useState<CateringPackage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [editingPackage, setEditingPackage] =
    useState<Partial<CateringPackage> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openInclusionSections, setOpenInclusionSections] = useState<string[]>([]);
  const [dynamicInclusionCategories, setDynamicInclusionCategories] = useState<Record<string, string[]>>({});
  const [addingItemToCategory, setAddingItemToCategory] = useState<string | null>(
    null,
  );
  const [newItemName, setNewItemName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [confirmAction, setConfirmAction] = useState<{
    type: "create" | "edit" | "archive" | "delete";
    itemType: "package" | "category" | "item";
    itemId?: string;
    itemName: string;
    parentCategory?: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  // Feature: Fetches packages from the database on page load
  useEffect(() => {
    fetchData();
    fetchInclusions();

    const channel = supabase
      .channel("packages-channel-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "packages" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inclusions" }, () => {
        fetchInclusions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Feature: Main database read function.
  const fetchData = async () => {
    const pkgResponse = await supabase
        .from("packages")
        .select("*")
        .order("created_at", { ascending: false });

    if (pkgResponse.error)
      console.error("Error fetching packages:", pkgResponse.error);
    else setPackages(pkgResponse.data as CateringPackage[]);
  };

  const fetchInclusions = async () => {
    const { data, error } = await supabase.from("inclusions").select("*");
    if (error) {
      console.error("Error fetching inclusions:", error);
      return;
    }
    
    const grouped: Record<string, string[]> = {};
    if (data) {
      data.forEach((row: any) => {
        if (!grouped[row.category]) grouped[row.category] = [];
        if (row.items && row.items.trim() !== "" && row.items !== "-") {
          if (!grouped[row.category].includes(row.items)) {
            grouped[row.category].push(row.items);
          }
        }
      });
    }
    setDynamicInclusionCategories(grouped);
  };

  const displayedPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        pkg.name.toLowerCase().includes(query) ||
        (pkg.tag || "").toLowerCase().includes(query);

      const matchesStatus = showArchived ? pkg.status === "Archived" : pkg.status !== "Archived";
      return matchesSearch && matchesStatus;
    });
  }, [packages, searchQuery, showArchived]);

  // Feature: Prepares the package modal for editing an existing database row
  const handleEditClick = (pkg: CateringPackage) => {
    setEditingPackage({ 
      ...pkg,
      status: pkg.status === "Active" ? "Available" : (pkg.status || "Available")
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Feature: Triggers the archive warning dialog for packages
  const handleArchiveClick = (pkg: CateringPackage) => {
    setConfirmAction({
      type: "archive",
      itemType: "package",
      itemId: pkg.id,
      itemName: pkg.name,
    });
  };

  // Feature: Resets the form to completely empty for creating a new package
  const handleCreateNew = () => {
    setEditingPackage({
      name: "",
      pax: "",
      price: "",
      inclusions: [],
      status: "Available",
      tag: "",
    });
    setIsModalOpen(true);
  };

  const handleInclusionChange = (inclusion: string, isChecked: boolean) => {
    if (!editingPackage) return;
    const currentInclusions = editingPackage.inclusions || [];
    let updatedInclusions;
    if (isChecked) {
      updatedInclusions = [...currentInclusions, inclusion];
    } else {
      updatedInclusions = currentInclusions.filter(
        (item) => item !== inclusion,
      );
    }
    setEditingPackage({
      ...editingPackage,
      inclusions: updatedInclusions,
    });
  };

  const toggleInclusionSection = (category: string) => {
    setOpenInclusionSections((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const handleAddNewItemToCategory = async (category: string) => {
    if (
      !newItemName.trim() ||
      dynamicInclusionCategories[category]?.includes(newItemName.trim())
    ) {
      setNewItemName("");
      setAddingItemToCategory(null);
      return;
    }

    const trimmedName = newItemName.trim();

    // Optimistic UI Update so the checkbox appears immediately
    setDynamicInclusionCategories((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), trimmedName],
    }));

    const { error } = await supabase.from("inclusions").insert([{
      category,
      items: trimmedName
    }]);

    if (error) {
      console.error("Error adding inclusion item:", error);
      setFormError(`Failed to save item: ${error.message}`);
      return;
    }

    // Automatically check the new item
    handleInclusionChange(trimmedName, true);
    setNewItemName("");
    setAddingItemToCategory(null);
  };

  const handleAddNewCategory = async () => {
    const trimmedCategoryName = newCategoryName.trim();
    setFormError(null);

    if (
      !trimmedCategoryName ||
      Object.keys(dynamicInclusionCategories)
        .map((k) => k.toLowerCase())
        .includes(trimmedCategoryName.toLowerCase())
    ) {
      setNewCategoryName("");
      setIsAddingCategory(false);
      return;
    }

    // Optimistic UI Update
    setDynamicInclusionCategories((prev) => ({
      ...prev,
      [trimmedCategoryName]: [],
    }));

    if (!openInclusionSections.includes(trimmedCategoryName)) {
      toggleInclusionSection(trimmedCategoryName);
    }
    setNewCategoryName("");
    setIsAddingCategory(false);

    // Insert a placeholder name alongside the category to officially establish it in the database
    const { error } = await supabase.from("inclusions").insert([{
      category: trimmedCategoryName,
      items: "-"
    }]);

    if (error) {
      console.error("Error adding inclusion category:", error);
      setFormError(`Failed to save category to database: ${error.message}`);
    }
  };

  const confirmDeleteCategory = (e: React.MouseEvent, category: string) => {
    e.stopPropagation();
    setConfirmAction({
      type: "delete",
      itemType: "category",
      itemName: category,
    });
  };

  const confirmDeleteItem = (category: string, item: string) => {
    setConfirmAction({
      type: "delete",
      itemType: "item",
      itemName: item,
      parentCategory: category,
    });
  };

  // Feature: Moves user from the package input form to the final validation step
  const handleConfirmSave = () => {
    if (editingPackage?.name) {
      const nameRegex = /^[a-zA-Z\sñÑ\-']+$/;
      if (!nameRegex.test(editingPackage.name)) {
        setFormError("Package name cannot contain numbers or special characters.");
        return;
      }
    }

    if (editingPackage?.pax) {
      const nums = editingPackage.pax.match(/\d+/g);
      if (!nums) {
        setFormError("Please enter a valid guest count.");
        return;
      }
      const hasInvalid = nums.some(n => {
        const num = parseInt(n, 10);
        return num < 10 || num > 500;
      });
      if (hasInvalid) {
        setFormError("Guest count must be between 10 and 500.");
        return;
      }
    }

    if (!editingPackage?.inclusions || editingPackage.inclusions.length < 5) {
      setFormError("Please select at least 5 inclusions for this package.");
      return;
    }

    setFormError(null);
    setIsModalOpen(false);
    setConfirmAction({
      type: editingPackage?.id ? "edit" : "create",
      itemType: "package",
      itemId: editingPackage?.id,
      itemName: editingPackage?.name || "New Package",
    });
  };

  // Feature: The core database execution function handling Insert, Update, and Archive for tables.
  const handleExecuteAction = async () => {
    if (!confirmAction) return;
    setFormError(null);

    if (confirmAction.type === "delete") {
      let packagesWereUpdated = false;

      if (confirmAction.itemType === "category") {
        const category = confirmAction.itemName;
        const itemsInCategory = dynamicInclusionCategories[category] || [];
        
        await supabase.from("inclusions").delete().eq("category", category);

        setDynamicInclusionCategories((prev) => {
          const updated = { ...prev };
          delete updated[category];
          return updated;
        });

        if (editingPackage && editingPackage.inclusions) {
          const newInclusions = editingPackage.inclusions.filter(
            (inc) => !itemsInCategory.includes(inc)
          );
          setEditingPackage({ ...editingPackage, inclusions: newInclusions });
        }

        // Remove these deleted items from all existing packages in the DB to reflect on client side
        const affectedPackages = packages.filter((pkg) => pkg.inclusions && pkg.inclusions.some((inc) => itemsInCategory.includes(inc)));
        for (const pkg of affectedPackages) {
          const updatedInclusions = pkg.inclusions.filter((inc) => !itemsInCategory.includes(inc));
          await supabase.from("packages").update({ inclusions: updatedInclusions }).eq("id", pkg.id);
          packagesWereUpdated = true;
        }
      } else if (confirmAction.itemType === "item" && confirmAction.parentCategory) {
        const category = confirmAction.parentCategory;
        const item = confirmAction.itemName;
        
        await supabase.from("inclusions").delete().eq("category", category).eq("items", item);

        setDynamicInclusionCategories((prev) => ({
          ...prev,
          [category]: prev[category].filter((i) => i !== item),
        }));

        if (editingPackage && editingPackage.inclusions?.includes(item)) {
          handleInclusionChange(item, false);
        }

        // Remove the deleted item from all existing packages in the DB to reflect on client side
        const affectedPackages = packages.filter((pkg) => pkg.inclusions && pkg.inclusions.includes(item));
        for (const pkg of affectedPackages) {
          const updatedInclusions = pkg.inclusions.filter((inc) => inc !== item);
          await supabase.from("packages").update({ inclusions: updatedInclusions }).eq("id", pkg.id);
          packagesWereUpdated = true;
        }
      }
      
      if (packagesWereUpdated) {
        await fetchData();
      }

      setConfirmAction(null);
      return;
    }

    if (confirmAction.itemType === "package") {
      if (confirmAction.type === "create") {
        // Inserts new package into the 'packages' table
        const { error } = await supabase.from("packages").insert([
          {
            name: editingPackage?.name,
            pax: editingPackage?.pax,
            price: editingPackage?.price ? String(editingPackage.price).replace(/,/g, "") : null,
            tag: editingPackage?.tag,
            inclusions: editingPackage?.inclusions || [],
            status: editingPackage?.status || "Available",
          },
        ]);
        if (error) {
          console.error("Error creating package:", error);
          setFormError(error.message);
          return;
        }
      } else if (confirmAction.type === "edit" && confirmAction.itemId) {
        // Updates existing package
        const { error } = await supabase
          .from("packages")
          .update({
            name: editingPackage?.name,
            pax: editingPackage?.pax,
            price: editingPackage?.price ? String(editingPackage.price).replace(/,/g, "") : null,
            tag: editingPackage?.tag,
            inclusions: editingPackage?.inclusions || [],
            status: editingPackage?.status || "Available",
          })
          .eq("id", confirmAction.itemId);
        if (error) {
          console.error("Error updating package:", error);
          setFormError(error.message);
          return;
        }
      } else if (confirmAction.type === "archive" && confirmAction.itemId) {
        // Archives package
        const { error } = await supabase
          .from("packages")
          .update({ status: "Archived" })
          .eq("id", confirmAction.itemId);
        if (error) {
          console.error("Error archiving package:", error);
          setFormError(error.message);
          return;
        }
      }
    }

    // Refresh UI data and reset forms
    await fetchData();
    setConfirmAction(null);
    setFormError(null);
    setEditingPackage(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Offerings Management
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Configure event bundles
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Package
        </button>
      </div>

      <div className="glass-card bg-white p-4 flex flex-col md:flex-row gap-4 items-center justify-between border border-natural-border/50 rounded-xl">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search packages by name, tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowArchived(false)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all w-full md:w-auto",
              !showArchived
                ? "bg-natural-accent text-white shadow-sm"
                : "bg-natural-bg text-natural-text-light hover:text-natural-text-main",
            )}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 w-full md:w-auto",
              showArchived
                ? "bg-natural-text-main text-white shadow-sm"
                : "bg-natural-bg text-natural-text-light hover:text-natural-text-main",
            )}
          >
            <Archive className="w-3.5 h-3.5" />
            Archived
          </button>
        </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayedPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={cn(
                "glass-card group transition-all duration-300 flex flex-col overflow-hidden",
                pkg.status === "Archived"
                  ? "bg-natural-bg/40 opacity-60 grayscale-[0.5]"
                  : "hover:border-natural-accent/30",
              )}
            >
              <div className="p-6 border-b border-natural-border/50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2.5 bg-natural-bg rounded-xl border border-natural-border transition-colors",
                        pkg.status !== "Archived" &&
                          "group-hover:bg-natural-accent/5",
                      )}
                    >
                      <Package className="w-5 h-5 text-natural-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {pkg.tag && pkg.tag !== "None" && (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                            <Sparkles className="w-2.5 h-2.5 fill-amber-600" />{" "}
                            {pkg.tag}
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter border",
                            pkg.status === "Not Available"
                              ? "bg-orange-50 text-orange-600 border-orange-100"
                              : "bg-green-50 text-green-600 border-green-100"
                          )}
                        >
                          {pkg.status === "Not Available" ? "Not Available" : "Available"}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-natural-text-main tracking-tight leading-tight">
                        {pkg.name}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEditClick(pkg)}
                  className="p-1.5 text-natural-text-light hover:text-natural-accent hover:bg-white hover:shadow-xs rounded-lg transition-all"
                  title="Edit Package"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                {pkg.status !== "Archived" ? (
                  <button
                    onClick={() => handleArchiveClick(pkg)}
                    className="p-1.5 text-natural-text-light hover:text-red-500 hover:bg-white hover:shadow-xs rounded-lg transition-all"
                    title="Archive Package"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                    ) : (
                  <span className="text-[0.6rem] font-bold text-natural-text-light/40 uppercase tracking-widest bg-natural-bg/50 px-2 py-1 rounded ml-1">
                        Archived
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-natural-text-light" />
                    <span className="text-xs font-semibold text-natural-text-main">
                      {pkg.pax} Guests
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-natural-text-light" />
                    <span className="text-xs font-bold text-natural-accent font-serif italic text-lg leading-none">
                      {pkg.price}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 bg-natural-bg/5 space-y-4">
                <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                  Inclusions
                </p>
                {pkg.inclusions && pkg.inclusions.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(dynamicInclusionCategories).map(([cat, items]) => {
                      const selectedInThisCategory = pkg.inclusions.filter((inc) => items.includes(inc));
                      if (selectedInThisCategory.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-1.5">
                          <p className="text-[0.65rem] font-bold text-natural-text-main/70 uppercase tracking-widest border-b border-natural-border/50 pb-1 mb-2">{cat}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {selectedInThisCategory.map((inc, i) => (
                              <div key={`${inc}-${i}`} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                                <span className="text-[0.7rem] font-medium text-natural-text-main/80 leading-tight">
                                  {inc}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const allCategorizedItems = Object.values(dynamicInclusionCategories).flat();
                      const uncategorized = pkg.inclusions.filter((inc) => !allCategorizedItems.includes(inc));
                      if (uncategorized.length === 0) return null;
                      return (
                        <div className="space-y-1.5">
                          <p className="text-[0.65rem] font-bold text-natural-text-main/70 uppercase tracking-widest border-b border-natural-border/50 pb-1 mb-2">Other</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {uncategorized.map((inc, i) => (
                              <div key={`uncat-${inc}-${i}`} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                                <span className="text-[0.7rem] font-medium text-natural-text-main/80 leading-tight">
                                  {inc}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-[0.75rem] font-medium text-natural-text-light/80">
                    No inclusions specified.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

      {/* Package Modal */}
      {isModalOpen && editingPackage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-natural-border">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-natural-text-main">
                {editingPackage.id ? "Edit Package" : "Create New Package"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-natural-bg rounded-lg transition-colors"
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* LEFT: input layout */}
                <div className="space-y-4">
                  <div className="border border-natural-border/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-natural-bg/10 border-b border-natural-border/50">
                      <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest">
                        Package Details
                      </p>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest col-span-1">
                          Package Name
                        </label>
                        <input
                          type="text"
                          value={editingPackage.name || ""}
                          onChange={(e) => {
                            setEditingPackage({
                              ...editingPackage,
                              name: e.target.value,
                            });
                            setFormError(null);
                          }}
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 col-span-2"
                        />
                      </div>

                      {/* Guest range (separate row) */}
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest col-span-1">
                          Guest range
                        </label>
                        <input
                          type="text"
                          value={editingPackage.pax || ""}
                          onChange={(e) =>
                            setEditingPackage({
                              ...editingPackage,
                              pax: e.target.value,
                            })
                          }
                          placeholder="e.g. 80 - 100 pax"
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 col-span-2"
                        />
                      </div>

                      {/* Price with ₱ prefix */}
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest col-span-1">
                          Price
                        </label>
                        <div className="col-span-2 w-full relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-natural-text-light">
                            ₱
                          </span>
                          <input
                            type="text"
                            value={editingPackage.price || ""}
                            onChange={(e) => {
                              let raw = e.target.value.replace(/,/g, '');
                              raw = raw.replace(/[^0-9.]/g, '');
                              const parts = raw.split('.');
                              if (parts[0]) {
                                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                              }
                              const formatted = parts.slice(0, 2).join('.');
                              setEditingPackage({
                                ...editingPackage,
                                price: formatted,
                              });
                            }}
                            placeholder="99,000"
                            className="w-full pl-8 pr-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                          />
                        </div>
                      </div>

                      {/* Status Tag dropdown */}
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest col-span-1">
                          Status Tag
                        </label>
                        <select
                          value={editingPackage.tag || ""}
                          onChange={(e) =>
                            setEditingPackage({
                              ...editingPackage,
                              tag: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 col-span-2"
                        >
                          <option value="" disabled>
                            Select status
                          </option>
                          <option value="None">None</option>
                          <option>Popular</option>
                          <option>Premium</option>
                          <option>Budget-Friendly</option>
                          <option>Kids Special</option>
                          <option>Styling Only</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-3 items-center">
                        <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest col-span-1">
                          Status
                        </label>
                        <select
                          value={editingPackage.status || "Available"}
                          onChange={(e) =>
                            setEditingPackage({
                              ...editingPackage,
                              status: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 col-span-2 cursor-pointer"
                        >
                          <option value="Available">Available</option>
                          <option value="Not Available">Not Available</option>
                          <option value="None">None</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border border-natural-border/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-natural-bg/10 border-b border-natural-border/50">
                      <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest">
                        Inclusions Checklist
                      </p>
                    </div>

                    <div className="p-4 space-y-1 max-h-96 overflow-y-auto">
                      {Object.entries(dynamicInclusionCategories).map(
                        ([category, items]) => (
                          <div
                            key={category}
                            className="border-b border-natural-border/50 last:border-b-0"
                          >
                            <div
                              onClick={() => toggleInclusionSection(category)}
                              className="w-full flex justify-between items-center py-3 text-left cursor-pointer group"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronDown
                                  className={cn(
                                    "w-4 h-4 transition-transform",
                                    openInclusionSections.includes(category) &&
                                      "rotate-180",
                                  )}
                                />
                                <span className="text-xs font-bold text-natural-text-main">
                                  {category}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => confirmDeleteCategory(e, category)}
                                className="p-1 text-natural-text-light hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete Category"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {openInclusionSections.includes(category) && (
                              <div className="pb-4 pt-2 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {items.map((item) => (
                                    <div
                                      key={item}
                                      className="flex items-center justify-between gap-2 hover:bg-natural-bg/50 p-1 rounded-md group"
                                    >
                                      <label className="flex items-center gap-2 text-xs text-natural-text-main cursor-pointer flex-1">
                                        <input
                                          type="checkbox"
                                          checked={
                                            editingPackage.inclusions?.includes(item) || false
                                          }
                                          onChange={(e) =>
                                            handleInclusionChange(
                                              item,
                                              e.target.checked,
                                            )
                                          }
                                          className="w-3.5 h-3.5 rounded border-natural-border text-natural-accent focus:ring-natural-accent/20"
                                        />
                                        {item}
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => confirmDeleteItem(category, item)}
                                        className="p-1 text-natural-text-light hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        title="Delete Item"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3">
                                  {addingItemToCategory === category ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={newItemName}
                                        onChange={(e) =>
                                          setNewItemName(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                          e.key === "Enter" &&
                                          handleAddNewItemToCategory(category)
                                        }
                                        placeholder="New item name"
                                        className="w-full px-2 py-1 bg-natural-bg border border-natural-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-natural-accent/20"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() =>
                                          handleAddNewItemToCategory(category)
                                        }
                                        className="p-1 text-green-600 hover:bg-green-50 rounded-md"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          setAddingItemToCategory(null)
                                        }
                                        className="p-1 text-red-600 hover:bg-red-50 rounded-md"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setAddingItemToCategory(category);
                                        setNewItemName("");
                                      }}
                                      className="flex items-center gap-1 text-xs font-bold text-natural-accent/80 hover:text-natural-accent"
                                    >
                                      <Plus className="w-3 h-3" /> Add Item
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                      <div className="pt-4">
                        {isAddingCategory ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newCategoryName}
                              onChange={(e) =>
                                setNewCategoryName(e.target.value)
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleAddNewCategory()
                              }
                              placeholder="New category name"
                              className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-natural-accent/20"
                              autoFocus
                            />
                            <button
                              onClick={handleAddNewCategory}
                              className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-lg"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setIsAddingCategory(false)}
                              className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setIsAddingCategory(true);
                              setNewCategoryName("");
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-natural-accent uppercase tracking-widest border-2 border-dashed border-natural-border/50 rounded-lg hover:bg-natural-accent/5 hover:border-natural-accent/50 transition-all"
                          >
                            <Plus className="w-4 h-4" /> Add Category
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: preview panel */}
                <div className="space-y-3">
                  <div className="p-4 border border-natural-border/50 rounded-xl bg-natural-bg/5">
                    <p className="text-[0.7rem] font-bold text-natural-text-light uppercase tracking-widest mb-3">
                      Package Preview
                    </p>

                    <div className="border border-natural-border/50 rounded-xl overflow-hidden bg-white">
                      <div className="p-4 bg-natural-bg/5 border-b border-natural-border/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                              {editingPackage.tag && editingPackage.tag !== "None" ? editingPackage.tag : "Tag: —"}
                            </p>
                            <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest mt-1">
                              Status: <span className={editingPackage.status === "Not Available" ? "text-orange-600" : "text-green-600"}>{editingPackage.status || "Available"}</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                              Price
                            </p>
                            <p className="text-lg font-bold text-natural-accent font-serif italic leading-none">
                              {editingPackage.price || "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <h4 className="text-base font-bold text-natural-text-main tracking-tight leading-tight">
                          {editingPackage.name || "Package Name"}
                        </h4>

                        <p className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest mt-1">
                          Guests: {editingPackage.pax || "—"}
                        </p>

                        <div className="mt-4 border border-natural-border/50 rounded-lg overflow-hidden">
                          <div className="p-3 bg-natural-bg/10 border-b border-natural-border/50">
                            <p className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                              Inclusions
                            </p>
                          </div>

                          <div className="p-3">
                            {editingPackage.inclusions &&
                            editingPackage.inclusions.length > 0 ? (
                              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                                {Object.entries(dynamicInclusionCategories).map(([cat, items]) => {
                                  const selectedInThisCategory = editingPackage.inclusions!.filter((inc) => items.includes(inc));
                                  if (selectedInThisCategory.length === 0) return null;
                                  return (
                                    <div key={cat} className="space-y-1.5">
                                      <p className="text-[0.6rem] font-bold text-natural-text-main uppercase tracking-widest border-b border-natural-border/50 pb-1 mb-2">{cat}</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                                        {selectedInThisCategory.map((inc, i) => (
                                          <div key={`${inc}-${i}`} className="flex items-start gap-2">
                                            <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                                            <span className="text-[0.7rem] font-medium text-natural-text-main/80 leading-tight">
                                              {inc}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                                {(() => {
                                  const allCategorizedItems = Object.values(dynamicInclusionCategories).flat();
                                  const uncategorized = editingPackage.inclusions!.filter((inc) => !allCategorizedItems.includes(inc));
                                  if (uncategorized.length === 0) return null;
                                  return (
                                    <div className="space-y-1.5">
                                      <p className="text-[0.6rem] font-bold text-natural-text-main uppercase tracking-widest border-b border-natural-border/50 pb-1 mb-2">Other</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                                        {uncategorized.map((inc, i) => (
                                          <div key={`uncat-${inc}-${i}`} className="flex items-start gap-2">
                                            <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                                            <span className="text-[0.7rem] font-medium text-natural-text-main/80 leading-tight">
                                              {inc}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <p className="text-[0.75rem] font-medium text-natural-text-light/80">
                                Add inclusions to see them here.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingPackage((prev) => ({
                            ...(prev || {}),
                            inclusions: [],
                          }))
                        }
                        className="px-4 py-2 text-xs font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-text-main transition-colors border border-natural-border/50 rounded-lg"
                      >
                        Clear Inclusions
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex items-center justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-natural-text-light uppercase tracking-widest hover:text-natural-text-main transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={
                  !String(editingPackage.name || "").trim() ||
                  !String(editingPackage.pax || "").trim() ||
                  !String(editingPackage.price || "").trim() ||
                  !editingPackage.tag
                }
                className="bg-natural-accent text-white px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-natural-accent/90 transition-all shadow-sm disabled:opacity-50"
              >
                {editingPackage.id ? "Save Changes" : "Create Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border relative">
            
            {(confirmAction.type === "create" || confirmAction.type === "edit") && (
              <button
                onClick={() => {
                  const actionType = confirmAction.itemType;
                  setConfirmAction(null);
                  setFormError(null);
                  if (actionType === "package") setIsModalOpen(true);
                }}
                className="absolute top-4 left-4 p-2 text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/50 rounded-full transition-colors z-10"
                title="Back to Form"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="p-8 text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg transition-transform hover:rotate-0",
                  confirmAction.type === "create"
                    ? "bg-blue-600 shadow-blue-200"
                    : confirmAction.type === "edit"
                      ? "bg-natural-accent shadow-natural-accent/20"
                      : "bg-red-600 shadow-red-200",
                )}
              >
                {confirmAction.type === "create" && (
                  <Plus className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "edit" && (
                  <Edit3 className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "archive" && (
                  <Archive className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "delete" && (
                  <Trash2 className="w-8 h-8 text-white" />
                )}
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2 capitalize">
                {confirmAction.type} {confirmAction.itemType}?
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                {confirmAction.type === "create" ? (
                  <>
                    Are you sure you want to add{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>{" "}
                    to your offerings?
                  </>
                ) : confirmAction.type === "edit" ? (
                  <>
                    You are about to update the details and pricing for{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>
                    . Continue?
                  </>
                ) : confirmAction.type === "delete" ? (
                  <>
                    Are you sure you want to permanently delete{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>
                    ? This action cannot be undone.
                  </>
                ) : (
                  <>
                    This will move{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>{" "}
                    to the archives. It will no longer be available for new
                    bookings.
                  </>
                )}
              </p>

              <div className="flex flex-col gap-3">
                {formError && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-left">
                    {formError}
                  </p>
                )}

                <button
                  onClick={handleExecuteAction}
                  className={cn(
                    "w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white transition-all shadow-md active:scale-[0.98]",
                    confirmAction.type === "create"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : confirmAction.type === "edit"
                        ? "bg-natural-accent hover:bg-natural-accent/90"
                        : "bg-red-600 hover:bg-red-700",
                  )}
                >
                  Confirm {confirmAction.type}
                </button>
                <button
                  onClick={() => {
                    setConfirmAction(null);
                    setFormError(null);
                  }}
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
