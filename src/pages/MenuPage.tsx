import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Utensils,
  Zap,
  Clock,
  Star,
  X,
  Edit3,
  Archive,
  Trash2,
  Check,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";

// Defines the structure of a menu item based on the Supabase table
export interface MenuItem {
  id: string;
  name: string;
  category: string;
  sub_category?: string;
  status: string;
}

const categories = [
  "All",
  "Main Course",
  "Appetizers",
  "Pasta",
  "Desserts",
  "Beverages",
  "Archived",
];

export function MenuPage() {
  // State management for UI and Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedSections, setExpandedSections] = useState<string[]>(["Beef"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Main Course",
    sub_category: "",
    status: "Available",
  });

  const [confirmAction, setConfirmAction] = useState<{
    type: "create" | "edit" | "archive";
    itemId?: string;
    itemName: string;
  } | null>(null);

  // Automatically fetches the menu items from the database when the page loads
  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Queries the 'menu_items' table in Supabase and updates the local state
  const fetchMenuItems = async () => {
    const { data, error } = await supabase.from("menu_items").select("*");
    if (error) {
      console.error("Error fetching menu items:", error.message);
    } else if (data) {
      setMenuItems(data as MenuItem[]);
    }
  };

  /**
   * Filters the displayed menu items based on the selected category and search input.
   * Excludes 'Archived' items from standard views.
   */
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.sub_category || "").toLowerCase().includes(query);

      if (activeCategory === "Archived") {
        return item.status === "Archived" && matchesSearch;
      }

      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;

      const isNotArchived = item.status !== "Archived";
      return matchesCategory && matchesSearch && isNotArchived;
    });
  }, [activeCategory, searchQuery, menuItems]);

  // Prepares the UI form for adding a completely new menu item
  const handleAddClick = () => {
    setEditingItem(null);
    setFormData({ name: "", category: "Main Course", sub_category: "", status: "Available" });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Populates the UI form with the data of an existing item so it can be edited
  const handleEditClick = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({ 
      name: item.name, 
      category: item.category,
      sub_category: item.sub_category || "",
      status: item.status === "Active" ? "Available" : (item.status || "Available"),
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Opens the confirmation dialogue specifically for archiving an item
  const handleArchiveClick = (item: MenuItem) => {
    setConfirmAction({
      type: "archive",
      itemId: item.id,
      itemName: item.name,
    });
  };

  // Transitions the user from the input form to the final validation check before altering the database
  const handleConfirmSave = () => {
    // Prevent names with numbers or special characters (allows letters, spaces, hyphens, apostrophes, and ñ)
    const nameRegex = /^[a-zA-Z\sñÑ\-']+$/;
    if (!nameRegex.test(formData.name)) {
      setFormError("Dish name cannot contain numbers or special characters.");
      return;
    }

    const candidate = normalizeDishName(formData.name);
    const duplicate = menuItems.some(
      (item) => item.id !== editingItem?.id && normalizeDishName(item.name) === candidate
    );
    if (duplicate) {
      setFormError("A dish with this name already exists in the catalog.");
      return;
    }

    setFormError(null);
    setIsModalOpen(false);
    setConfirmAction({
      type: editingItem ? "edit" : "create",
      itemId: editingItem?.id,
      itemName: formData.name || "New Dish",
    });
  };

  const normalizeDishName = (name: string) =>
    name.trim().replace(/\s+/g, " ").toLowerCase();

  const [formError, setFormError] = useState<string | null>(null);

  // The core database execution function. Handles Insert, Update, and Archive operations directly to Supabase.
  const handleExecuteAction = async (addAnother: boolean = false) => {
    if (!confirmAction) return;
    setFormError(null);

    if (confirmAction.type === "create") {
      // Inserts a new row into the menu_items table
      const { error } = await supabase.from("menu_items").insert([
        {
          name: formData.name,
          category: formData.category,
          sub_category: ["Main Course", "Appetizers"].includes(formData.category) ? formData.sub_category : null,
          status: formData.status || "Available",
        },
      ]);
      if (error) {
        console.error("Error adding item:", error.message);
        setFormError("Failed to add dish.");
        return;
      }
    } else if (confirmAction.type === "edit" && confirmAction.itemId) {
      // Updates an existing row in the menu_items table using its unique ID
      const { error } = await supabase
        .from("menu_items")
        .update({
          name: formData.name,
          category: formData.category,
          sub_category: ["Main Course", "Appetizers"].includes(formData.category) ? formData.sub_category : null,
          status: formData.status,
        })
        .eq("id", confirmAction.itemId);
      if (error) {
        console.error("Error updating item:", error.message);
        setFormError("Failed to update dish.");
        return;
      }
    } else if (confirmAction.type === "archive" && confirmAction.itemId) {
      // Changes the status of an item to 'Archived' so it no longer appears in active views
      const { error } = await supabase
        .from("menu_items")
        .update({
          status: "Archived",
        })
        .eq("id", confirmAction.itemId);
      if (error) {
        console.error("Error archiving item:", error.message);
        setFormError("Failed to archive dish.");
        return;
      }
    }

    // Refreshes the UI data from the database and resets the form states
    await fetchMenuItems();
    
    if (addAnother) {
      setConfirmAction(null);
      setFormData({ name: "", category: formData.category, sub_category: formData.sub_category, status: "Available" }); // Keep same category selected for bulk adding
      setFormError(null);
      setIsModalOpen(true);
    } else {
      setConfirmAction(null);
      setEditingItem(null);
      setFormData({ name: "", category: "Main Course", sub_category: "", status: "Available" });
    }
  };

  const renderDishCard = (item: MenuItem) => (
    <div
      key={item.id}
      className={cn(
        "p-6 hover:bg-natural-bg/10 transition-all flex flex-col group relative",
        item.status === "Archived" &&
          "bg-natural-bg/40 opacity-60 grayscale-[0.5]",
      )}
    >
      <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status !== "Archived" ? (
          <>
            <button
              onClick={() => handleEditClick(item)}
              className="p-1.5 text-natural-text-light hover:text-natural-accent hover:bg-white hover:shadow-xs rounded-lg transition-all"
              title="Edit Dish"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleArchiveClick(item)}
              className="p-1.5 text-natural-text-light hover:text-red-500 hover:bg-white hover:shadow-xs rounded-lg transition-all"
              title="Archive Dish"
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

      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-natural-bg border border-natural-border rounded-xl">
          <Utensils className="w-6 h-6 text-natural-accent opacity-70" />
        </div>
      </div>

      <div className="mb-2">
        <p className="text-[0.6rem] font-bold text-natural-accent uppercase tracking-[0.15em] mb-1">
          {item.category}
        </p>
        <h4 className="text-base font-bold text-natural-text-main tracking-tight leading-snug">
          {item.name}
        </h4>
      </div>

      <div className="mt-auto pt-6 flex items-center justify-between">
        <span className="text-[0.65rem] font-bold text-natural-text-light/60 uppercase tracking-widest">
          ID: #{item.id.substring(0, 8)}
        </span>
        <span
          className={cn(
            "text-[0.65rem] font-bold px-2 py-0.5 rounded border uppercase tracking-wider whitespace-nowrap",
            item.status === "Archived"
              ? "text-gray-500 bg-gray-50 border-gray-200"
              : item.status === "Not Available"
                ? "text-orange-600 bg-orange-50 border-orange-100"
                : "text-green-600 bg-green-50 border-green-100",
          )}
        >
          {item.status === "Active" ? "Available" : (item.status || "Available")}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">
            Menu Catalog
          </h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">
            Design and manage your catering selections
          </p>
        </div>

        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 bg-natural-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New Dish
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
            }}
            className={cn(
              "px-4 py-1.5 rounded-full text-[0.7rem] font-bold uppercase tracking-widest transition-all whitespace-nowrap border",
              activeCategory === cat
                ? "bg-natural-accent text-white border-natural-accent shadow-sm"
                : "bg-white text-natural-text-light border-natural-border hover:bg-natural-bg",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="glass-card bg-white overflow-hidden shadow-sm border border-natural-border/50">
        <div className="p-4 border-b border-natural-border flex flex-col md:flex-row gap-4 items-center justify-between bg-natural-bg/5">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search dishes or ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-natural-text-light" />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
              {filteredItems.length} Dishes Found
            </span>
          </div>
        </div>

      {["Desserts", "Beverages", "Pasta"].includes(activeCategory) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-natural-border bg-white border-t border-natural-border">
            {filteredItems.map(renderDishCard)}
            {filteredItems.length === 0 && (
              <div className="col-span-full p-20 text-center">
                <Utensils className="w-12 h-12 text-natural-text-light/20 mx-auto mb-4" />
                <p className="text-natural-text-light font-medium">
                  No dishes found matching your criteria.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-natural-border">
            {(() => {
              let sectionsConfig: { title: string, match: (i: MenuItem) => boolean }[] = [];
              if (activeCategory === "Main Course") {
                sectionsConfig = [
                  { title: "Beef", match: (i: MenuItem) => i.sub_category === "Beef" },
                  { title: "Pork", match: (i: MenuItem) => i.sub_category === "Pork" },
                  { title: "Chicken", match: (i: MenuItem) => i.sub_category === "Chicken" },
                  { title: "Fish & Shrimp", match: (i: MenuItem) => i.sub_category === "Fish & Shrimp" },
                  { title: "Rice", match: (i: MenuItem) => i.sub_category === "Rice" },
                  { title: "Other Dishes", match: (i: MenuItem) => !["Beef", "Pork", "Chicken", "Fish & Shrimp", "Rice"].includes(i.sub_category || "") }
                ];
              } else if (activeCategory === "Appetizers") {
                sectionsConfig = [
                  { title: "Appetizer", match: (i: MenuItem) => i.sub_category === "Appetizer" },
                  { title: "Vegetables", match: (i: MenuItem) => i.sub_category === "Vegetables" },
                  { title: "Soup", match: (i: MenuItem) => i.sub_category === "Soup" },
                  { title: "Other Dishes", match: (i: MenuItem) => !["Appetizer", "Vegetables", "Soup"].includes(i.sub_category || "") }
                ];
              } else {
                sectionsConfig = [
                  { title: "Beef", match: (i: MenuItem) => i.sub_category === "Beef" && i.category === "Main Course" },
                  { title: "Pork", match: (i: MenuItem) => i.sub_category === "Pork" && i.category === "Main Course" },
                  { title: "Chicken", match: (i: MenuItem) => i.sub_category === "Chicken" && i.category === "Main Course" },
                  { title: "Fish & Shrimp", match: (i: MenuItem) => i.sub_category === "Fish & Shrimp" && i.category === "Main Course" },
                  { title: "Rice", match: (i: MenuItem) => i.sub_category === "Rice" && i.category === "Main Course" },
                  { title: "Appetizer", match: (i: MenuItem) => i.sub_category === "Appetizer" && i.category === "Appetizers" },
                  { title: "Vegetables", match: (i: MenuItem) => i.sub_category === "Vegetables" && i.category === "Appetizers" },
                  { title: "Soup", match: (i: MenuItem) => i.sub_category === "Soup" && i.category === "Appetizers" },
                  { title: "Pasta", match: (i: MenuItem) => i.category === "Pasta" },
                  { title: "Desserts", match: (i: MenuItem) => i.category === "Desserts" },
                  { title: "Beverages", match: (i: MenuItem) => i.category === "Beverages" },
                  { title: "Other Dishes", match: (i: MenuItem) => 
                      (!["Beef", "Pork", "Chicken", "Fish & Shrimp", "Rice"].includes(i.sub_category || "") && i.category === "Main Course") || 
                      (!["Appetizer", "Vegetables", "Soup"].includes(i.sub_category || "") && i.category === "Appetizers") ||
                      (!["Main Course", "Appetizers", "Desserts", "Beverages", "Pasta"].includes(i.category))
                  }
                ];
              }

              return sectionsConfig.map(({ title, match }) => {
                const sectionItems = filteredItems.filter(match);
                if (sectionItems.length === 0 && title === "Other Dishes") return null;
                
                const isExpanded = expandedSections.includes(title);
                
                return (
                  <div key={title} className="flex flex-col bg-white">
                    <button
                      onClick={() => {
                        setExpandedSections(prev => 
                          prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
                        )
                      }}
                      className="flex items-center justify-between p-4 bg-natural-bg/5 hover:bg-natural-bg/10 transition-colors w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-natural-text-main text-lg">{title}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-natural-bg border border-natural-border text-[10px] font-bold text-natural-text-light">
                          {sectionItems.length}
                        </span>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 text-natural-text-light transition-transform", isExpanded && "rotate-180")} />
                    </button>
                    
                    {isExpanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-natural-border border-t border-natural-border">
                        {sectionItems.map(renderDishCard)}
                        {sectionItems.length === 0 && (
                          <div className="col-span-full p-12 text-center">
                            <Utensils className="w-8 h-8 text-natural-text-light/20 mx-auto mb-3" />
                            <p className="text-sm text-natural-text-light font-medium italic">
                              No {title.toLowerCase()} found in this section.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {filteredItems.length === 0 && (
              <div className="p-20 text-center bg-white">
                <Utensils className="w-12 h-12 text-natural-text-light/20 mx-auto mb-4" />
                <p className="text-natural-text-light font-medium">
                  No dishes found matching your criteria.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-natural-border">
            <div className="p-6 border-b border-natural-border flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-natural-text-main">
                {editingItem ? "Edit Dish" : "Add New Dish"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-natural-bg rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-natural-text-light" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-600">{formError}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Dish Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setFormError(null);
                  }}
                  placeholder="e.g. Adobo Special"
                  className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => {
                    const newCategory = e.target.value;
                    setFormData({ 
                      ...formData, 
                      category: newCategory,
                      sub_category: ""
                    });
                  }}
                  className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all font-medium"
                >
                  {categories
                    .filter((c) => c !== "All" && c !== "Archived")
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>
              </div>

              {["Main Course", "Appetizers"].includes(formData.category) && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Sub Category
                  </label>
                  <select
                    value={formData.sub_category}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_category: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all font-medium"
                  >
                    <option value="" disabled>Select a sub category</option>
                    {formData.category === "Main Course" && (
                      <>
                        <option value="Beef">Beef</option>
                        <option value="Pork">Pork</option>
                        <option value="Chicken">Chicken</option>
                        <option value="Fish & Shrimp">Fish & Shrimp</option>
                        <option value="Rice">Rice</option>
                      </>
                    )}
                    {formData.category === "Appetizers" && (
                      <>
                        <option value="Appetizer">Appetizer</option>
                        <option value="Vegetables">Vegetables</option>
                        <option value="Soup">Soup</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {editingItem && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">
                    Availability Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/20 transition-all font-medium cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="Not Available">Not Available</option>
                  </select>
                </div>
              )}
            </div>

            <div className="p-6 bg-natural-bg/30 border-t border-natural-border flex items-center justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-[0.65rem] font-bold text-natural-text-light uppercase tracking-[0.2em] hover:text-natural-text-main transition-colors mr-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={!formData.name || (["Main Course", "Appetizers"].includes(formData.category) && !formData.sub_category)}
                className="bg-natural-accent text-white px-6 py-2.5 rounded-xl text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-natural-accent/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingItem ? "Save Changes" : "Add Dish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-natural-border relative">
            {(confirmAction.type === "create" || confirmAction.type === "edit") && (
              <button
                onClick={() => {
                  setConfirmAction(null);
                  setFormError(null);
                  setIsModalOpen(true);
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
              </div>

              <h3 className="text-xl font-serif font-bold text-natural-text-main mb-2">
                {confirmAction.type === "create"
                  ? "Add to Catalog?"
                  : confirmAction.type === "edit"
                    ? "Update Dish?"
                    : "Archive Dish?"}
              </h3>

              <p className="text-sm text-natural-text-light mb-8 leading-relaxed">
                {confirmAction.type === "create" ? (
                  <>
                    Are you sure you want to add{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>{" "}
                    to your menu catalog?
                  </>
                ) : confirmAction.type === "edit" ? (
                  <>
                    You are about to update the details for{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>
                    . Continue?
                  </>
                ) : (
                  <>
                    This will move{" "}
                    <span className="font-bold text-natural-text-main">
                      {confirmAction.itemName}
                    </span>{" "}
                    to the archives. It will no longer appear in the active
                    catalog.
                  </>
                )}
              </p>

              <div className="flex flex-col gap-3">
                {formError && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-left">
                    {formError}
                  </p>
                )}

                {confirmAction.type === "create" ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleExecuteAction(false)}
                      className="flex-1 py-3 rounded-xl text-[0.65rem] font-bold uppercase tracking-[0.1em] text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all shadow-sm active:scale-[0.98]"
                    >
                      Confirm & Close
                    </button>
                    <button
                      onClick={() => handleExecuteAction(true)}
                      className="flex-1 py-3 rounded-xl text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md active:scale-[0.98]"
                    >
                      Confirm & Add Another
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleExecuteAction(false)}
                    className={cn(
                      "w-full py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-white transition-all shadow-md active:scale-[0.98]",
                      confirmAction.type === "edit"
                        ? "bg-natural-accent hover:bg-natural-accent/90"
                        : "bg-red-600 hover:bg-red-700"
                    )}
                  >
                    Confirm {confirmAction.type}
                  </button>
                )}
                <button
                  onClick={() => {
                    const wasCreateOrEdit = confirmAction.type === "create" || confirmAction.type === "edit";
                    setConfirmAction(null);
                    setFormError(null);
                    if (wasCreateOrEdit) setIsModalOpen(true);
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
