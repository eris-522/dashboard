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
  Boxes,
  RotateCcw,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase"; // Database connection
import { useInventory } from "../context/InventoryContext";
import { logAuditAction } from "../utils/auditLogger";
import { subscribeCatalogBroadcast, broadcastCatalogChange } from "../utils/liveBroadcast";
import { ImageUploadField } from "../components/ImageUploadField";

// Feature: Defines the structure for Packages based on the Supabase table
export interface CateringPackage {
  id: string;
  name: string;
  pax: string;
  price: string;
  additional_pax_price?: string;
  tag?: string;
  inclusions: string[];
  status: string;
  image_url?: string;
  category_limits?: Record<string, number>;
}

const MAX_PACKAGE_NAME_LENGTH = 60;
const MAX_PACKAGE_PAX = 500;
const MIN_PACKAGE_PAX = 10;
const MAX_PACKAGE_PAX_LENGTH = 15;
const MAX_PACKAGE_PRICE = 1_000_000;
const MAX_ADDITIONAL_PAX_PRICE = 10_000;
const MAX_CATEGORY_DISH_LIMIT = 10;
const MAX_INCLUSION_CATEGORY_LENGTH = 40;
const MAX_INCLUSION_ITEM_LENGTH = 60;

export const formatNumberWithCommas = (val?: string | number, max?: number) => {
  if (val === undefined || val === null || val === "") return "";
  const digits = String(val).replace(/,/g, "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const stripped = digits.replace(/^0+(?=\d)/, "");
  let num = parseInt(stripped, 10);
  if (isNaN(num)) return "";
  if (max !== undefined && num > max) {
    num = max;
  }
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const formatPrice = (price?: string | number) => {
  if (price === undefined || price === null || price === "") return "₱0";
  const formatted = formatNumberWithCommas(price);
  if (!formatted) return "₱0";
  return `₱${formatted}`;
};

const sanitizeGuestRangeInput = (raw: string): string => {
  let cleaned = raw.replace(/[^\d\s-]/g, "");
  const hyphenParts = cleaned.split("-");
  if (hyphenParts.length > 2) {
    cleaned = `${hyphenParts[0]}-${hyphenParts.slice(1).join("")}`;
  }
  cleaned = cleaned.replace(/\d+/g, (match) => {
    const stripped = match.replace(/^0+(?=\d)/, "");
    const num = parseInt(stripped, 10);
    if (isNaN(num)) return "";
    return String(Math.min(MAX_PACKAGE_PAX, num));
  });
  return cleaned.slice(0, MAX_PACKAGE_PAX_LENGTH);
};

export function PackagePage() {
  const { calculatePackageEquipment } = useInventory();
  // Feature: State management for database arrays and UI toggles
  const [packages, setPackages] = useState<CateringPackage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [editingPackage, setEditingPackage] =
    useState<Partial<CateringPackage> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openInclusionSections, setOpenInclusionSections] = useState<string[]>(
    [],
  );
  const [dynamicInclusionCategories, setDynamicInclusionCategories] = useState<
    Record<string, string[]>
  >({});
  const [addingItemToCategory, setAddingItemToCategory] = useState<
    string | null
  >(null);
  const [newItemName, setNewItemName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [confirmAction, setConfirmAction] = useState<{
    type: "create" | "edit" | "archive" | "unarchive" | "delete";
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

    const unsubscribe = subscribeCatalogBroadcast((key) => {
      if (key === "packages") {
        fetchData();
      } else if (key === "inclusions") {
        fetchInclusions();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Feature: Main database read function (pruned columns).
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const pkgResponse = await supabase
        .from("packages")
        .select("id, name, pax, price, additional_pax_price, tag, inclusions, status, image_url, category_limits, created_at")
        .order("created_at", { ascending: false });

      if (pkgResponse.error)
        console.error("Error fetching packages:", pkgResponse.error);
      else setPackages(pkgResponse.data as CateringPackage[]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInclusions = async () => {
    const { data, error } = await supabase
      .from("inclusions")
      .select("id, category, items")
      .not("category", "like", "__CMS_%");
    if (error) {
      console.error("Error fetching inclusions:", error);
      return;
    }

    const grouped: Record<string, string[]> = {};
    if (data) {
      data.forEach((row: any) => {
        if (row.category && !row.category.startsWith("__CMS_")) {
          if (!grouped[row.category]) grouped[row.category] = [];
          if (row.items && row.items.trim() !== "" && row.items !== "-") {
            if (!grouped[row.category].includes(row.items)) {
              grouped[row.category].push(row.items);
            }
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

      const matchesStatus = showArchived
        ? pkg.status === "Archived"
        : pkg.status !== "Archived";
      return matchesSearch && matchesStatus;
    });
  }, [packages, searchQuery, showArchived]);

  // Feature: Prepares the package modal for editing an existing database row
  const handleEditClick = (pkg: CateringPackage) => {
    setEditingPackage({
      ...pkg,
      price: pkg.price ? formatNumberWithCommas(pkg.price) : "",
      additional_pax_price: pkg.additional_pax_price
        ? formatNumberWithCommas(pkg.additional_pax_price)
        : "",
      status: pkg.status === "Active" ? "Available" : pkg.status || "Available",
      category_limits: pkg.category_limits || {},
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

  // Feature: Triggers the unarchive confirmation dialog for packages
  const handleUnarchiveClick = (pkg: CateringPackage) => {
    setConfirmAction({
      type: "unarchive",
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
      additional_pax_price: "",
      inclusions: [],
      status: "Available",
      tag: "",
      image_url: "",
      category_limits: {},
    });
    setFormError(null);
    setAddingItemToCategory(null);
    setIsAddingCategory(false);
    setNewItemName("");
    setNewCategoryName("");
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
    const trimmedName = newItemName.trim().slice(0, MAX_INCLUSION_ITEM_LENGTH);
    if (!trimmedName) {
      setNewItemName("");
      setAddingItemToCategory(null);
      return;
    }

    if (
      trimmedName.length < 2 ||
      !/^[a-zA-Z0-9À-ÿ\sñÑ&/().,\-']+$/.test(trimmedName) ||
      !/[a-zA-Z0-9À-ÿñÑ]/.test(trimmedName)
    ) {
      setFormError(
        "Inclusion item name must be 2–60 characters and contain only letters, numbers, spaces, and standard punctuation (& / ( ) . , - ').",
      );
      return;
    }

    const existsInCategory = (dynamicInclusionCategories[category] || []).some(
      (item) => item.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (existsInCategory) {
      setFormError(`"${trimmedName}" already exists in ${category}.`);
      return;
    }

    setFormError(null);

    // Optimistic UI Update so the checkbox appears immediately
    setDynamicInclusionCategories((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), trimmedName],
    }));

    const { error } = await supabase.from("inclusions").insert([
      {
        category,
        items: trimmedName,
      },
    ]);

    if (error) {
      console.error("Error adding inclusion item:", error);
      // Roll back optimistic insertion
      setDynamicInclusionCategories((prev) => ({
        ...prev,
        [category]: (prev[category] || []).filter((item) => item !== trimmedName),
      }));
      setFormError(`Failed to save item: ${error.message}`);
      return;
    }

    await logAuditAction({
      action: "Added Inclusion Item",
      target: trimmedName,
      type: "Create",
      details: `Added new inclusion item to ${category}`,
    });
    broadcastCatalogChange("inclusions");

    // Automatically check the new item
    handleInclusionChange(trimmedName, true);
    setNewItemName("");
    setAddingItemToCategory(null);
  };

  const handleAddNewCategory = async () => {
    const trimmedCategoryName = newCategoryName
      .trim()
      .slice(0, MAX_INCLUSION_CATEGORY_LENGTH);
    setFormError(null);

    if (!trimmedCategoryName) {
      setNewCategoryName("");
      setIsAddingCategory(false);
      return;
    }

    if (
      trimmedCategoryName.length < 2 ||
      !/^[a-zA-Z0-9À-ÿ\sñÑ&/().,\-']+$/.test(trimmedCategoryName) ||
      !/[a-zA-Z0-9À-ÿñÑ]/.test(trimmedCategoryName)
    ) {
      setFormError(
        "Category name must be 2–40 characters and contain only letters, numbers, spaces, and standard punctuation (& / ( ) . , - ').",
      );
      return;
    }

    if (
      Object.keys(dynamicInclusionCategories)
        .map((k) => k.toLowerCase())
        .includes(trimmedCategoryName.toLowerCase())
    ) {
      setFormError(`Category "${trimmedCategoryName}" already exists.`);
      return;
    }

    const wasSectionAlreadyOpen = openInclusionSections.includes(trimmedCategoryName);

    // Optimistic UI Update
    setDynamicInclusionCategories((prev) => ({
      ...prev,
      [trimmedCategoryName]: [],
    }));

    if (!wasSectionAlreadyOpen) {
      toggleInclusionSection(trimmedCategoryName);
    }
    setNewCategoryName("");
    setIsAddingCategory(false);

    // Insert a placeholder name alongside the category to officially establish it in the database
    const { error } = await supabase.from("inclusions").insert([
      {
        category: trimmedCategoryName,
        items: "-",
      },
    ]);

    if (error) {
      console.error("Error adding inclusion category:", error);
      // Roll back optimistic category state
      setDynamicInclusionCategories((prev) => {
        const updated = { ...prev };
        delete updated[trimmedCategoryName];
        return updated;
      });
      if (!wasSectionAlreadyOpen) {
        setOpenInclusionSections((prev) =>
          prev.filter((c) => c !== trimmedCategoryName),
        );
      }
      setFormError(`Failed to save category to database: ${error.message}`);
      return;
    }

    await logAuditAction({
      action: "Added Inclusion Category",
      target: trimmedCategoryName,
      type: "Create",
      details: `Created new inclusion category`,
    });
    broadcastCatalogChange("inclusions");
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
    const trimmedName = (editingPackage?.name || "").trim();
    if (!trimmedName) {
      setFormError("Package name is required.");
      return;
    }
    if (trimmedName.length < 2) {
      setFormError("Package name must be at least 2 characters long.");
      return;
    }
    if (trimmedName.length > MAX_PACKAGE_NAME_LENGTH) {
      setFormError(
        `Package name cannot exceed ${MAX_PACKAGE_NAME_LENGTH} characters.`,
      );
      return;
    }
    const nameRegex = /^[a-zA-Z0-9À-ÿ\sñÑ&/().,\-']+$/;
    if (!nameRegex.test(trimmedName) || !/[a-zA-Z0-9À-ÿñÑ]/.test(trimmedName)) {
      setFormError(
        "Package name can only contain letters, numbers, spaces, and standard punctuation (& / ( ) . , - ').",
      );
      return;
    }
    const normalizedCandidate = trimmedName.replace(/\s+/g, " ").toLowerCase();
    const duplicatePkg = packages.some(
      (pkg) =>
        pkg.id !== editingPackage?.id &&
        pkg.name.trim().replace(/\s+/g, " ").toLowerCase() ===
          normalizedCandidate,
    );
    if (duplicatePkg) {
      setFormError("A package with this name already exists.");
      return;
    }

    const trimmedPax = (editingPackage?.pax || "").trim();
    if (!trimmedPax || !/^\d+(\s*-\s*\d+)?$/.test(trimmedPax)) {
      setFormError(
        `Please enter a valid guest count or range (e.g. "80" or "80 - 100", between ${MIN_PACKAGE_PAX} and ${MAX_PACKAGE_PAX}).`,
      );
      return;
    }
    const nums = trimmedPax.match(/\d+/g);
    if (!nums) {
      setFormError("Please enter a valid guest count.");
      return;
    }
    const parsedNums = nums.map((n) => parseInt(n, 10));
    const hasInvalid = parsedNums.some(
      (num) => num < MIN_PACKAGE_PAX || num > MAX_PACKAGE_PAX,
    );
    if (hasInvalid) {
      setFormError(
        `Guest count must be between ${MIN_PACKAGE_PAX} and ${MAX_PACKAGE_PAX}.`,
      );
      return;
    }
    if (parsedNums.length === 2 && parsedNums[0] > parsedNums[1]) {
      setFormError("Minimum guest count cannot exceed maximum guest count.");
      return;
    }

    const numericPrice = parseInt(
      String(editingPackage?.price || "").replace(/,/g, ""),
      10,
    );
    if (
      !editingPackage?.price ||
      isNaN(numericPrice) ||
      numericPrice <= 0 ||
      numericPrice > MAX_PACKAGE_PRICE
    ) {
      setFormError(
        `Price must be between ₱1 and ₱${MAX_PACKAGE_PRICE.toLocaleString()}.`,
      );
      return;
    }

    if (editingPackage?.additional_pax_price) {
      const numericAddPrice = parseInt(
        String(editingPackage.additional_pax_price).replace(/,/g, ""),
        10,
      );
      if (
        isNaN(numericAddPrice) ||
        numericAddPrice < 0 ||
        numericAddPrice > MAX_ADDITIONAL_PAX_PRICE
      ) {
        setFormError(
          `Additional pax price must be between ₱0 and ₱${MAX_ADDITIONAL_PAX_PRICE.toLocaleString()}.`,
        );
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
      itemName: trimmedName || "New Package",
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

        const { error: delCatErr } = await supabase
          .from("inclusions")
          .delete()
          .eq("category", category);

        if (delCatErr) {
          console.error("Error deleting inclusion category:", delCatErr);
          setFormError(`Failed to delete category: ${delCatErr.message}`);
          setConfirmAction(null);
          return;
        }

        setDynamicInclusionCategories((prev) => {
          const updated = { ...prev };
          delete updated[category];
          return updated;
        });

        if (editingPackage && editingPackage.inclusions) {
          const newInclusions = editingPackage.inclusions.filter(
            (inc) => !itemsInCategory.includes(inc),
          );
          setEditingPackage({ ...editingPackage, inclusions: newInclusions });
        }

        // Remove these deleted items from all existing packages in the DB in parallel
        const affectedPackages = packages.filter(
          (pkg) =>
            pkg.inclusions &&
            pkg.inclusions.some((inc) => itemsInCategory.includes(inc)),
        );
        if (affectedPackages.length > 0) {
          const pkgResults = await Promise.all(
            affectedPackages.map((pkg) => {
              const updatedInclusions = pkg.inclusions.filter(
                (inc) => !itemsInCategory.includes(inc),
              );
              return supabase
                .from("packages")
                .update({ inclusions: updatedInclusions })
                .eq("id", pkg.id);
            }),
          );
          const failedPkg = pkgResults.find((r) => r.error);
          if (failedPkg?.error) {
            console.error("Error updating affected packages after category delete:", failedPkg.error);
            setFormError(
              `Category removed, but some packages failed to sync: ${failedPkg.error.message}`,
            );
          }
          packagesWereUpdated = pkgResults.some((r) => !r.error);
        }

        await logAuditAction({
          action: "Deleted Inclusion Category",
          target: category,
          type: "Delete",
          details: `Permanently removed category and its items`,
        });
      } else if (
        confirmAction.itemType === "item" &&
        confirmAction.parentCategory
      ) {
        const category = confirmAction.parentCategory;
        const item = confirmAction.itemName;

        const { error: delItemErr } = await supabase
          .from("inclusions")
          .delete()
          .eq("category", category)
          .eq("items", item);

        if (delItemErr) {
          console.error("Error deleting inclusion item:", delItemErr);
          setFormError(`Failed to delete item: ${delItemErr.message}`);
          setConfirmAction(null);
          return;
        }

        setDynamicInclusionCategories((prev) => ({
          ...prev,
          [category]: (prev[category] || []).filter((i) => i !== item),
        }));

        if (editingPackage && editingPackage.inclusions?.includes(item)) {
          handleInclusionChange(item, false);
        }

        // Remove the deleted item from all existing packages in the DB in parallel
        const affectedPackages = packages.filter(
          (pkg) => pkg.inclusions && pkg.inclusions.includes(item),
        );
        if (affectedPackages.length > 0) {
          const pkgResults = await Promise.all(
            affectedPackages.map((pkg) => {
              const updatedInclusions = pkg.inclusions.filter(
                (inc) => inc !== item,
              );
              return supabase
                .from("packages")
                .update({ inclusions: updatedInclusions })
                .eq("id", pkg.id);
            }),
          );
          const failedPkg = pkgResults.find((r) => r.error);
          if (failedPkg?.error) {
            console.error("Error updating affected packages after item delete:", failedPkg.error);
            setFormError(
              `Item removed, but some packages failed to sync: ${failedPkg.error.message}`,
            );
          }
          packagesWereUpdated = pkgResults.some((r) => !r.error);
        }

        await logAuditAction({
          action: "Deleted Inclusion Item",
          target: item,
          type: "Delete",
          details: `Removed item from ${category}`,
        });
      }

      broadcastCatalogChange("inclusions");
      if (packagesWereUpdated) {
        await fetchData();
        broadcastCatalogChange("packages");
      }

      setConfirmAction(null);
      return;
    }

    if (confirmAction.itemType === "package") {
      const cleanName = editingPackage?.name
        ?.trim()
        .slice(0, MAX_PACKAGE_NAME_LENGTH);
      const cleanPax = editingPackage?.pax
        ?.trim()
        .slice(0, MAX_PACKAGE_PAX_LENGTH);

      if (confirmAction.type === "create") {
        // Inserts new package into the 'packages' table
        const { error } = await supabase.from("packages").insert([
          {
            name: cleanName,
            pax: cleanPax,
            price: editingPackage?.price
              ? String(editingPackage.price).replace(/,/g, "")
              : null,
            additional_pax_price: editingPackage?.additional_pax_price
              ? String(editingPackage.additional_pax_price).replace(/,/g, "")
              : null,
            tag: editingPackage?.tag,
            inclusions: editingPackage?.inclusions || [],
            status: editingPackage?.status || "Available",
            image_url: editingPackage?.image_url || null,
            category_limits: editingPackage?.category_limits || {},
          },
        ]);
        if (error) {
          console.error("Error creating package:", error);
          setFormError(error.message);
          return;
        } else {
          await logAuditAction({
            action: "Created Package",
            target: cleanName || "New Package",
            type: "Create",
            details: `Created new catering package`,
          });
        }
      } else if (confirmAction.type === "edit" && confirmAction.itemId) {
        // Updates existing package
        const { error } = await supabase
          .from("packages")
          .update({
            name: cleanName,
            pax: cleanPax,
            price: editingPackage?.price
              ? String(editingPackage.price).replace(/,/g, "")
              : null,
            additional_pax_price: editingPackage?.additional_pax_price
              ? String(editingPackage.additional_pax_price).replace(/,/g, "")
              : null,
            tag: editingPackage?.tag,
            inclusions: editingPackage?.inclusions || [],
            status: editingPackage?.status || "Available",
            image_url: editingPackage?.image_url || null,
            category_limits: editingPackage?.category_limits || {},
          })
          .eq("id", confirmAction.itemId);
        if (error) {
          console.error("Error updating package:", error);
          setFormError(error.message);
          return;
        } else {
          await logAuditAction({
            action: "Updated Package",
            target: cleanName || "Package",
            type: "Update",
            details: `Modified package configuration`,
          });
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
        } else {
          await logAuditAction({
            action: "Archived Package",
            target: confirmAction.itemName,
            type: "Update",
            details: `Moved package to archives`,
          });
        }
      } else if (confirmAction.type === "unarchive" && confirmAction.itemId) {
        // Unarchives package back to 'Available'
        const { error } = await supabase
          .from("packages")
          .update({ status: "Available" })
          .eq("id", confirmAction.itemId);
        if (error) {
          console.error("Error unarchiving package:", error);
          setFormError(error.message);
          return;
        } else {
          await logAuditAction({
            action: "Unarchived Package",
            target: confirmAction.itemName,
            type: "Update",
            details: `Restored package from archives to active offerings`,
          });
        }
      }
    }

    // Refresh UI data, broadcast to live clients, and reset forms
    await fetchData();
    broadcastCatalogChange("packages");
    setConfirmAction(null);
    setFormError(null);
    setEditingPackage(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="glass-card bg-white dark:bg-natural-card p-4 flex flex-col lg:flex-row gap-4 items-center justify-between border border-natural-border/50 rounded-xl">
        <div className="relative w-full lg:w-80">
          <input
            type="text"
            placeholder="Search packages by name, tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-natural-bg/50 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white dark:focus:bg-natural-card transition-all shadow-xs"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => setShowArchived(false)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex-1 sm:flex-initial",
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
              "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial",
              showArchived
                ? "bg-natural-text-main text-white shadow-sm"
                : "bg-natural-bg text-natural-text-light hover:text-natural-text-main",
            )}
          >
            <Archive className="w-3.5 h-3.5" />
            Archived
          </button>
          <button
            onClick={handleCreateNew}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-natural-accent text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-natural-accent/90 transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Package
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl flex flex-col items-center justify-center py-20 text-natural-text-light px-4 text-center">
          <div className="w-8 h-8 border-4 border-natural-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-serif italic text-sm text-natural-text-light">Loading packages...</p>
        </div>
      ) : displayedPackages.length === 0 ? (
        <div className="glass-card bg-white dark:bg-natural-card border border-natural-border/60 rounded-2xl flex flex-col items-center justify-center py-20 text-natural-text-light px-4 text-center">
          {showArchived ? (
            <Archive className="w-12 h-12 mb-3 opacity-25 text-natural-accent" />
          ) : (
            <Package className="w-12 h-12 mb-3 opacity-25 text-natural-accent" />
          )}
          <p className="font-serif italic text-lg text-natural-text-main">
            {showArchived
              ? "No archived packages found"
              : searchQuery
                ? "No packages matching your search"
                : "No packages available"}
          </p>
          <p className="text-xs uppercase tracking-wider mt-1.5 text-natural-text-light">
            {searchQuery
              ? `No packages match "${searchQuery}"`
              : showArchived
                ? "There are currently no archived packages in the system"
                : "Create a new package or adjust your search filter"}
          </p>
        </div>
      ) : (
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
                        <span className="flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 px-2 py-0.5 rounded uppercase tracking-wider shadow-2xs">
                          <Sparkles className="w-3 h-3 fill-amber-600 dark:fill-amber-300 text-amber-600 dark:text-amber-300" />{" "}
                          {pkg.tag}
                        </span>
                      )}
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider border shadow-2xs",
                          pkg.status === "Not Available"
                            ? "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60"
                            : "bg-green-50 text-green-600 border-green-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
                        )}
                      >
                        {pkg.status === "Not Available"
                          ? "Not Available"
                          : "Available"}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-natural-text-main tracking-normal leading-snug mt-1">
                      {pkg.name}
                    </h3>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 transition-opacity shrink-0",
                    pkg.status === "Archived"
                      ? "opacity-100"
                      : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
                  )}
                >
                  {pkg.status !== "Archived" ? (
                    <>
                      <button
                        onClick={() => handleEditClick(pkg)}
                        className="p-2 text-natural-text-light hover:text-natural-accent hover:bg-white dark:hover:bg-natural-card hover:shadow-xs rounded-lg transition-all"
                        title="Edit Package"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleArchiveClick(pkg)}
                        className="p-2 text-natural-text-light hover:text-red-500 hover:bg-white dark:hover:bg-natural-card hover:shadow-xs rounded-lg transition-all"
                        title="Archive Package"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUnarchiveClick(pkg)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all shadow-xs"
                      title="Restore Package"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-natural-text-light shrink-0" />
                    <span className="text-sm font-semibold text-natural-text-main">
                      {pkg.pax} Guests
                    </span>
                  </div>
                  {pkg.additional_pax_price && (
                    <span className="text-xs text-natural-text-light font-medium mt-1 tracking-normal ml-6">
                      +{formatPrice(pkg.additional_pax_price)} / extra
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-natural-text-light shrink-0" />
                  <span className="text-xs font-bold text-natural-accent font-serif italic text-lg leading-none">
                    {formatPrice(pkg.price)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 flex-1 bg-natural-bg/5 space-y-4">
              <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                Inclusions
              </p>
              {pkg.inclusions && pkg.inclusions.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(dynamicInclusionCategories).map(
                    ([cat, items]) => {
                      const selectedInThisCategory = pkg.inclusions.filter(
                        (inc) => items.includes(inc),
                      );
                      if (selectedInThisCategory.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-1.5">
                          <p className="text-xs font-bold text-natural-text-main/70 uppercase tracking-wider border-b border-natural-border/50 pb-1 mb-2">
                            {cat}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {selectedInThisCategory.map((inc, i) => (
                              <div
                                key={`${inc}-${i}`}
                                className="flex items-start gap-2"
                              >
                                <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                                <span className="text-xs font-medium text-natural-text-main leading-snug">
                                  {inc}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    },
                  )}
                  {(() => {
                    const allCategorizedItems = Object.values(
                      dynamicInclusionCategories,
                    ).flat();
                    const uncategorized = pkg.inclusions.filter(
                      (inc) => !allCategorizedItems.includes(inc),
                    );
                    if (uncategorized.length === 0) return null;
                    return (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-natural-text-main/70 uppercase tracking-wider border-b border-natural-border/50 pb-1 mb-2">
                          Other
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                          {uncategorized.map((inc, i) => (
                            <div
                              key={`uncat-${inc}-${i}`}
                              className="flex items-start gap-2"
                            >
                              <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                              <span className="text-xs font-medium text-natural-text-main leading-snug">
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
                <p className="text-xs font-medium text-natural-text-light/80">
                  No inclusions specified.
                </p>
              )}
            </div>

            {/* Equipment Monitoring Link Footer */}
            <div className="px-6 py-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-t border-natural-border/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold">
                <Boxes className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>Equipment Monitoring:</span>
              </div>
              <span className="font-semibold text-natural-text-main/80 dark:text-natural-text-light">
                {calculatePackageEquipment(pkg.name, Number(pkg.pax) || 50, pkg.inclusions).length} equipment connected
              </span>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Package Modal */}
      {isModalOpen && editingPackage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2.5 sm:p-6">
          <div className="bg-white dark:bg-natural-card rounded-2xl shadow-xl w-full max-w-6xl xl:max-w-7xl max-h-[94dvh] overflow-hidden flex flex-col animate-in zoom-in duration-200 border border-natural-border">
            <div className="p-4 sm:p-6 border-b border-natural-border flex items-center justify-between shrink-0">
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

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">{formError}</p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* LEFT: input layout */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border border-natural-border/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-natural-bg/10 border-b border-natural-border/50">
                      <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                        Package Details
                      </p>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 items-start sm:items-center">
                        <div className="sm:col-span-1 flex items-center justify-between sm:block">
                          <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider block">
                            Package Name
                          </label>
                          <span className="text-[10px] text-natural-text-light/70 font-medium">
                            {(editingPackage.name || "").length}/{MAX_PACKAGE_NAME_LENGTH}
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={MAX_PACKAGE_NAME_LENGTH}
                          value={editingPackage.name || ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (/[^a-zA-Z0-9À-ÿ\sñÑ&/().,\-']/.test(raw)) {
                              setFormError(
                                "Package name can only contain letters, numbers, spaces, and standard punctuation (& / ( ) . , - ').",
                              );
                            } else if (raw.length > MAX_PACKAGE_NAME_LENGTH) {
                              setFormError(
                                `Package name cannot exceed ${MAX_PACKAGE_NAME_LENGTH} characters.`,
                              );
                            } else {
                              setFormError(null);
                            }
                            const sanitized = raw
                              .replace(/[^a-zA-Z0-9À-ÿ\sñÑ&/().,\-']/g, "")
                              .slice(0, MAX_PACKAGE_NAME_LENGTH);
                            setEditingPackage({
                              ...editingPackage,
                              name: sanitized,
                            });
                          }}
                          placeholder="e.g. Grand Wedding Package (Set A)"
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 sm:col-span-2"
                        />
                      </div>

                      {/* Guest range (separate row) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 items-start sm:items-center">
                        <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider sm:col-span-1">
                          Guest range
                        </label>
                        <input
                          type="text"
                          maxLength={MAX_PACKAGE_PAX_LENGTH}
                          value={editingPackage.pax || ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (/[^\d\s-]/.test(raw)) {
                              setFormError(
                                "Guest range can only contain numbers and a hyphen (e.g. 80 - 100).",
                              );
                            } else {
                              setFormError(null);
                            }
                            const sanitized = sanitizeGuestRangeInput(raw);
                            setEditingPackage({
                              ...editingPackage,
                              pax: sanitized,
                            });
                          }}
                          placeholder="e.g. 80 - 100 (10 to 500)"
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 sm:col-span-2"
                        />
                      </div>

                      {/* Price with ₱ prefix */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 items-start sm:items-center">
                        <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider sm:col-span-1">
                          Price
                        </label>
                        <div className="sm:col-span-2 w-full relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-natural-text-light">
                            ₱
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editingPackage.price || ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (/[^\d,]/.test(raw)) {
                                setFormError("Price can only contain numbers.");
                              } else {
                                setFormError(null);
                              }
                              setEditingPackage({
                                ...editingPackage,
                                price: formatNumberWithCommas(
                                  raw,
                                  MAX_PACKAGE_PRICE,
                                ),
                              });
                            }}
                            placeholder="e.g. 99,000 (Max 1,000,000)"
                            className="w-full pl-8 pr-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                          />
                        </div>
                      </div>

                      {/* Additional Pax Price with ₱ prefix */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 items-start sm:items-center">
                        <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider sm:col-span-1">
                          Add. Pax Price
                        </label>
                        <div className="sm:col-span-2 w-full relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-natural-text-light">
                            ₱
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editingPackage.additional_pax_price || ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (/[^\d,]/.test(raw)) {
                                setFormError(
                                  "Additional pax price can only contain numbers.",
                                );
                              } else {
                                setFormError(null);
                              }
                              setEditingPackage({
                                ...editingPackage,
                                additional_pax_price: formatNumberWithCommas(
                                  raw,
                                  MAX_ADDITIONAL_PAX_PRICE,
                                ),
                              });
                            }}
                            placeholder="e.g. 500 (Max 10,000)"
                            className="w-full pl-8 pr-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                          />
                        </div>
                      </div>

                      {/* Status Tag dropdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 items-start sm:items-center">
                        <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider sm:col-span-1">
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
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 sm:col-span-2"
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

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 items-start sm:items-center">
                        <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider sm:col-span-1">
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
                          className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 sm:col-span-2 cursor-pointer"
                        >
                          <option value="Available">Available</option>
                          <option value="Not Available">Not Available</option>
                          <option value="None">None</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <ImageUploadField
                          label="Package Image"
                          sublabel="Upload photo from device or paste image URL"
                          value={editingPackage.image_url || ""}
                          onChange={(url) =>
                            setEditingPackage({
                              ...editingPackage,
                              image_url: url,
                            })
                          }
                          aspectRatio="landscape"
                          placeholder="e.g. https://example.com/image.jpg"
                        />
                      </div>

                      {/* Category Limits */}
                      <div className="pt-3 border-t border-natural-border/50">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-natural-text-light uppercase tracking-wider block">
                            Menu Dish Limits (Customer Booking)
                          </label>
                          <span className="text-[10px] text-natural-text-light/70 font-medium">
                            Max {MAX_CATEGORY_DISH_LIMIT} per category
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            "Appetizer",
                            "Soup",
                            "Main Course",
                            "Pasta",
                            "Vegetable",
                            "Rice",
                            "Dessert",
                            "Drinks",
                          ].map((cat) => (
                            <div
                              key={cat}
                              className="flex items-center justify-between gap-2 bg-white border border-natural-border p-2 rounded-lg shadow-xs"
                            >
                              <span className="text-xs font-bold text-natural-text-main">
                                {cat}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={MAX_CATEGORY_DISH_LIMIT}
                                value={
                                  editingPackage.category_limits?.[cat] ?? 0
                                }
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "e" ||
                                    e.key === "E" ||
                                    e.key === "+" ||
                                    e.key === "-" ||
                                    e.key === "."
                                  ) {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(
                                    /[^\d]/g,
                                    "",
                                  );
                                  const stripped = digits.replace(
                                    /^0+(?=\d)/,
                                    "",
                                  );
                                  const clamped =
                                    stripped === ""
                                      ? 0
                                      : Math.min(
                                          MAX_CATEGORY_DISH_LIMIT,
                                          Math.max(
                                            0,
                                            parseInt(stripped, 10) || 0,
                                          ),
                                        );
                                  e.target.value = String(clamped);
                                  setEditingPackage((prev) => ({
                                    ...prev!,
                                    category_limits: {
                                      ...(prev?.category_limits || {}),
                                      [cat]: clamped,
                                    },
                                  }));
                                }}
                                className="w-12 px-1 py-1 text-center bg-natural-bg/50 border border-natural-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-natural-accent/20 font-bold"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-natural-border/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-natural-bg/10 border-b border-natural-border/50">
                      <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
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
                                onClick={(e) =>
                                  confirmDeleteCategory(e, category)
                                }
                                className="p-1 text-natural-text-light hover:text-red-500 hover:bg-red-50 rounded opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
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
                                            editingPackage.inclusions?.includes(
                                              item,
                                            ) || false
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
                                        onClick={() =>
                                          confirmDeleteItem(category, item)
                                        }
                                        className="p-1 text-natural-text-light hover:text-red-500 hover:bg-red-50 rounded opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0"
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
                                        maxLength={MAX_INCLUSION_ITEM_LENGTH}
                                        value={newItemName}
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          if (/[^a-zA-Z0-9À-ÿ\sñÑ&/().,\-']/.test(raw)) {
                                            setFormError(
                                              "Inclusion item can only contain letters, numbers, spaces, and standard punctuation (& / ( ) . , - ').",
                                            );
                                          } else {
                                            setFormError(null);
                                          }
                                          setNewItemName(
                                            raw
                                              .replace(/[^a-zA-Z0-9À-ÿ\sñÑ&/().,\-']/g, "")
                                              .slice(0, MAX_INCLUSION_ITEM_LENGTH),
                                          );
                                        }}
                                        onKeyDown={(e) =>
                                          e.key === "Enter" &&
                                          handleAddNewItemToCategory(category)
                                        }
                                        placeholder="New inclusion item (max 60)"
                                        className="w-full px-2 py-1 bg-natural-bg border border-natural-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-natural-accent/20"
                                        autoFocus
                                      />
                                      <button
                                        disabled={
                                          !newItemName.trim() ||
                                          newItemName.trim().length < 2
                                        }
                                        onClick={() =>
                                          handleAddNewItemToCategory(category)
                                        }
                                        className="p-1 text-green-600 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-950/40 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setAddingItemToCategory(null);
                                          setFormError(null);
                                        }}
                                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setAddingItemToCategory(category);
                                        setNewItemName("");
                                        setFormError(null);
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
                              maxLength={MAX_INCLUSION_CATEGORY_LENGTH}
                              value={newCategoryName}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (/[^a-zA-Z0-9À-ÿ\sñÑ&/().,\-']/.test(raw)) {
                                  setFormError(
                                    "Category name can only contain letters, numbers, spaces, and standard punctuation (& / ( ) . , - ').",
                                  );
                                } else {
                                  setFormError(null);
                                }
                                setNewCategoryName(
                                  raw
                                    .replace(/[^a-zA-Z0-9À-ÿ\sñÑ&/().,\-']/g, "")
                                    .slice(0, MAX_INCLUSION_CATEGORY_LENGTH),
                                );
                              }}
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleAddNewCategory()
                              }
                              placeholder="New category (max 40)"
                              className="w-full px-3 py-2 bg-natural-bg border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-natural-accent/20"
                              autoFocus
                            />
                            <button
                              disabled={
                                !newCategoryName.trim() ||
                                newCategoryName.trim().length < 2
                              }
                              onClick={handleAddNewCategory}
                              className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setIsAddingCategory(false);
                                setFormError(null);
                              }}
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
                              setFormError(null);
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
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 border border-natural-border/50 rounded-xl bg-natural-bg/5">
                    <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider mb-3">
                      Package Preview
                    </p>

                    <div className="border border-natural-border/50 rounded-xl overflow-hidden bg-white">
                      {editingPackage.image_url ? (
                        <div className="w-full h-36 bg-natural-bg border-b border-natural-border/50">
                          <img
                            src={editingPackage.image_url}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-12 bg-natural-bg border-b border-natural-border/50" />
                      )}

                      <div className="p-4 bg-natural-bg/5 border-b border-natural-border/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              {editingPackage.tag && editingPackage.tag !== "None" ? (
                                <span className="flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 px-2 py-0.5 rounded uppercase tracking-wider shadow-2xs">
                                  <Sparkles className="w-3 h-3 fill-amber-600 dark:fill-amber-300 text-amber-600 dark:text-amber-300" />{" "}
                                  {editingPackage.tag}
                                </span>
                              ) : null}
                              <span
                                className={cn(
                                  "flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border shadow-2xs",
                                  editingPackage.status === "Not Available"
                                    ? "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60"
                                    : "bg-green-50 text-green-600 border-green-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
                                )}
                              >
                                {editingPackage.status || "Available"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                              Price
                            </p>
                            <p className="text-xl font-bold text-natural-accent font-serif italic leading-none mt-1">
                              {editingPackage.price
                                ? formatPrice(editingPackage.price)
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <h4 className="text-lg font-bold text-natural-text-main tracking-normal leading-snug">
                          {editingPackage.name || "Package Name"}
                        </h4>

                        <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider mt-1.5">
                          Guests: {editingPackage.pax || "—"}
                        </p>
                        {editingPackage.additional_pax_price && (
                          <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider mt-1">
                            +{formatPrice(editingPackage.additional_pax_price)} / extra pax
                          </p>
                        )}

                        <div className="mt-4 border border-natural-border/50 rounded-lg overflow-hidden">
                          <div className="p-3 bg-natural-bg/10 border-b border-natural-border/50">
                            <p className="text-xs font-bold text-natural-text-light uppercase tracking-wider">
                              Inclusions
                            </p>
                          </div>

                          <div className="p-3">
                            {editingPackage.inclusions &&
                            editingPackage.inclusions.length > 0 ? (
                              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                                {Object.entries(dynamicInclusionCategories).map(
                                  ([cat, items]) => {
                                    const selectedInThisCategory =
                                      editingPackage.inclusions!.filter((inc) =>
                                        items.includes(inc),
                                      );
                                    if (selectedInThisCategory.length === 0)
                                      return null;
                                    return (
                                      <div key={cat} className="space-y-1.5">
                                        <p className="text-xs font-bold text-natural-text-main/70 uppercase tracking-wider border-b border-natural-border/50 pb-1 mb-2">
                                          {cat}
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                                          {selectedInThisCategory.map(
                                            (inc, i) => (
                                              <div
                                                key={`${inc}-${i}`}
                                                className="flex items-start gap-2"
                                              >
                                                <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                                                <span className="text-xs font-medium text-natural-text-main leading-snug">
                                                  {inc}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                                {(() => {
                                  const allCategorizedItems = Object.values(
                                    dynamicInclusionCategories,
                                  ).flat();
                                  const uncategorized =
                                    editingPackage.inclusions!.filter(
                                      (inc) =>
                                        !allCategorizedItems.includes(inc),
                                    );
                                  if (uncategorized.length === 0) return null;
                                  return (
                                    <div className="space-y-1.5">
                                      <p className="text-xs font-bold text-natural-text-main/70 uppercase tracking-wider border-b border-natural-border/50 pb-1 mb-2">
                                        Other
                                      </p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                                        {uncategorized.map((inc, i) => (
                                          <div
                                            key={`uncat-${inc}-${i}`}
                                            className="flex items-start gap-2"
                                          >
                                            <Check className="w-3.5 h-3.5 text-natural-accent shrink-0 mt-0.5" />
                                            <span className="text-xs font-medium text-natural-text-main leading-snug">
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
                              <p className="text-xs font-medium text-natural-text-light/80">
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

            <div className="p-4 sm:p-6 bg-natural-bg/30 border-t border-natural-border flex items-center justify-end gap-3 shrink-0">
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
          <div className="bg-white dark:bg-natural-card rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-natural-border relative">
            {(confirmAction.type === "create" ||
              confirmAction.type === "edit") && (
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
                      : confirmAction.type === "unarchive"
                        ? "bg-emerald-600 shadow-emerald-200"
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
                {confirmAction.type === "unarchive" && (
                  <RotateCcw className="w-8 h-8 text-white" />
                )}
                {confirmAction.type === "delete" && (
                  <Trash2 className="w-8 h-8 text-white" />
                )}
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2 capitalize">
                {confirmAction.type === "unarchive"
                  ? "Restore Package?"
                  : `${confirmAction.type} ${confirmAction.itemType}?`}
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
                ) : confirmAction.type === "unarchive" ? (
                  <>
                    Are you sure you want to restore{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>{" "}
                    back to active offerings?
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
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 px-4 py-2 rounded-xl text-left">
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
                        : confirmAction.type === "unarchive"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-red-600 hover:bg-red-700",
                  )}
                >
                  Confirm {confirmAction.type === "unarchive" ? "Restore" : confirmAction.type}
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
