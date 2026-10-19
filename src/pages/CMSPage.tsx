import React, { useState, useEffect, useMemo } from "react";
import {
  Globe,
  Sparkles,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit3,
  Star,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Layers,
  Heart,
  Award,
  Shield,
  Utensils,
  Image as ImageIcon,
  Quote,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  ChevronRight,
  UploadCloud,
  Download,
  Info,
  Maximize2,
  Minimize2,
  Package,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";
import { useUser } from "../context/UserContext";
import { ImageUploadField } from "../components/ImageUploadField";
import {
  FullCMSData,
  DEFAULT_CMS_DATA,
  fetchCMSContent,
  saveCMSSection,
  PillarItem,
  TestimonialItem,
  FAQItem,
  ProcessStep,
  WhyUsHighlight,
  PackageCMSItem,
  PackagesCMS,
  MenuCMSItem,
  MenuCMS,
} from "../utils/cms";

const AVAILABLE_PILLAR_ICONS = [
  { name: "Sparkles", icon: Sparkles },
  { name: "Heart", icon: Heart },
  { name: "Award", icon: Award },
  { name: "Shield", icon: Shield },
  { name: "Utensils", icon: Utensils },
  { name: "Star", icon: Star },
  { name: "Clock", icon: Clock },
];

const PRESET_HERO_IMAGES = [
  {
    label: "Elegant Dining Table",
    url: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=2000",
  },
  {
    label: "Grand Wedding Reception",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=2000",
  },
  {
    label: "Culinary Plating Art",
    url: "https://images.unsplash.com/photo-1547825407-2d060104b7f8?auto=format&fit=crop&q=80&w=2000",
  },
  {
    label: "Luxury Gourmet Buffet",
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=2000",
  },
];

const PRESET_PACKAGE_IMAGES = [
  {
    label: "Rustic Garden Wedding",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200",
  },
  {
    label: "Grand Ballroom Reception",
    url: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=1200",
  },
  {
    label: "Gourmet Plated Banquet",
    url: "https://images.unsplash.com/photo-1547825407-2d060104b7f8?auto=format&fit=crop&q=80&w=1200",
  },
  {
    label: "Luxury Buffet Presentation",
    url: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=1200",
  },
  {
    label: "Modern Intimate Gathering",
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=1200",
  },
  {
    label: "Cocktail & Canapés Station",
    url: "https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&q=80&w=1200",
  },
];

const PRESET_MENU_IMAGES = [
  {
    label: "Artisan Roast Beef",
    url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800",
  },
  {
    label: "Pan-Seared Salmon",
    url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=800",
  },
  {
    label: "Truffle Penne Pasta",
    url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=800",
  },
  {
    label: "Gourmet Charcuterie",
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800",
  },
  {
    label: "Mango Panna Cotta",
    url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800",
  },
  {
    label: "Herb-Crusted Chicken",
    url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&q=80&w=800",
  },
];

export function CMSPage() {
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<
    "hero" | "packages" | "menu" | "about" | "contact" | "testimonials" | "process" | "faqs"
  >("hero");
  const [previewPage, setPreviewPage] = useState<
    "hero" | "packages" | "menu" | "about" | "contact" | "testimonials" | "process" | "faqs"
  >("hero");
  const [cmsData, setCmsData] = useState<FullCMSData>(DEFAULT_CMS_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | "";
    text: string;
  }>({ type: "", text: "" });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState<
    "save" | "reset"
  >("save");
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);

  // Form local states for active section
  const [heroForm, setHeroForm] = useState(DEFAULT_CMS_DATA.hero);
  const [announcementForm, setAnnouncementForm] = useState(
    DEFAULT_CMS_DATA.announcement
  );
  const [packagesForm, setPackagesForm] = useState(DEFAULT_CMS_DATA.packages);
  const [dbPackages, setDbPackages] = useState<any[]>([]);
  const [menuForm, setMenuForm] = useState(DEFAULT_CMS_DATA.menu);
  const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("All");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [aboutForm, setAboutForm] = useState(DEFAULT_CMS_DATA.about);
  const [contactForm, setContactForm] = useState(DEFAULT_CMS_DATA.contact);
  const [testimonialsForm, setTestimonialsForm] = useState(
    DEFAULT_CMS_DATA.testimonials
  );
  const [processForm, setProcessForm] = useState(DEFAULT_CMS_DATA.process);
  const [faqsForm, setFaqsForm] = useState(DEFAULT_CMS_DATA.faqs);

  // Modal for editing/adding dynamic items
  const [editingPillarIndex, setEditingPillarIndex] = useState<number | null>(
    null
  );
  const [editingTestimonial, setEditingTestimonial] =
    useState<TestimonialItem | null>(null);
  const [editingFAQ, setEditingFAQ] = useState<FAQItem | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchCMSContent();
    setCmsData(data);
    setHeroForm(data.hero);
    setAnnouncementForm(data.announcement);
    setPackagesForm(data.packages || DEFAULT_CMS_DATA.packages);
    setMenuForm(data.menu || DEFAULT_CMS_DATA.menu);
    setAboutForm(data.about);
    setContactForm(data.contact);
    setTestimonialsForm(data.testimonials);
    setProcessForm(data.process);
    setFaqsForm(data.faqs);

    // Also load live packages from Supabase packages table (pruned columns)
    try {
      const { data: pkgs } = await supabase
        .from("packages")
        .select("id, name, tag, price, pax, image_url")
        .neq("status", "Archived");
      if (pkgs && pkgs.length > 0) {
        setDbPackages(pkgs);
      }
    } catch (e) {
      console.warn("Error fetching db packages for CMS:", e);
    }

    // Also load live menu items from Supabase menu_items table (pruned columns)
    try {
      const { data: dishes } = await supabase
        .from("menu_items")
        .select("id, name, category, sub_category, image_url")
        .neq("status", "Archived");
      if (dishes && dishes.length > 0) {
        setDbMenuItems(dishes);
      }
    } catch (e) {
      console.warn("Error fetching db menu items for CMS:", e);
    }

    setIsLoading(false);
  };

  const displayPackages = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        price?: string;
        pax?: string;
        tag?: string;
        image?: string;
        image_url?: string;
      }
    >();

    // 1. Default presets
    (DEFAULT_CMS_DATA.packages.items || []).forEach((item) => {
      map.set(item.name.toLowerCase(), { ...item });
    });

    // 2. CMS configured items
    (packagesForm.items || []).forEach((item) => {
      const key = item.name.toLowerCase();
      const existing = map.get(key);
      map.set(key, { ...existing, ...item });
    });

    // 3. Database packages from Supabase
    dbPackages.forEach((pkg) => {
      const key = pkg.name.toLowerCase();
      const existing = map.get(key);
      const customImg =
        packagesForm.packageImages?.[pkg.id] ||
        packagesForm.packageImages?.[pkg.name] ||
        existing?.image ||
        pkg.image_url ||
        "";
      map.set(key, {
        id: pkg.id,
        name: pkg.name,
        price: pkg.price || existing?.price,
        pax: pkg.pax || existing?.pax,
        tag: pkg.tag || existing?.tag,
        image: customImg,
      });
    });

    return Array.from(map.values());
  }, [dbPackages, packagesForm]);

  const displayMenuItems = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        category: string;
        sub_category?: string;
        description?: string;
        image?: string;
        image_url?: string;
      }
    >();

    // 1. Default presets
    (DEFAULT_CMS_DATA.menu.items || []).forEach((item) => {
      map.set(item.name.toLowerCase(), { ...item });
    });

    // 2. CMS configured items
    (menuForm.items || []).forEach((item) => {
      const key = item.name.toLowerCase();
      const existing = map.get(key);
      map.set(key, { ...existing, ...item });
    });

    // 3. Database menu items from Supabase
    dbMenuItems.forEach((item) => {
      const key = item.name.toLowerCase();
      const existing = map.get(key);
      const customImg =
        menuForm.menuImages?.[item.id] ||
        menuForm.menuImages?.[item.name] ||
        existing?.image ||
        item.image_url ||
        "";
      map.set(key, {
        id: item.id,
        name: item.name,
        category: item.category || existing?.category || "Main Course",
        sub_category: item.sub_category,
        description:
          item.description || existing?.description || item.sub_category || "",
        image: customImg,
        image_url: item.image_url,
      });
    });

    return Array.from(map.values());
  }, [dbMenuItems, menuForm]);

  const filteredMenuItems = useMemo(() => {
    return displayMenuItems.filter((item) => {
      const matchesCategory =
        selectedMenuCategory === "All" ||
        item.category.toLowerCase() === selectedMenuCategory.toLowerCase();
      const matchesSearch =
        !menuSearchQuery ||
        item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(menuSearchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [displayMenuItems, selectedMenuCategory, menuSearchQuery]);

  const handleUpdatePackageImage = (
    pkgId: string,
    pkgName: string,
    newUrl: string
  ) => {
    setPackagesForm((prev) => {
      const updatedImages = {
        ...(prev.packageImages || {}),
        [pkgId]: newUrl,
        [pkgName]: newUrl,
      };

      const existingIndex = (prev.items || []).findIndex(
        (item) =>
          item.id === pkgId ||
          item.name.toLowerCase() === pkgName.toLowerCase()
      );

      let updatedItems = [...(prev.items || [])];
      if (existingIndex >= 0) {
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          image: newUrl,
        };
      } else {
        updatedItems.push({
          id: pkgId || `pkg-${Date.now()}`,
          name: pkgName,
          image: newUrl,
        });
      }

      return {
        ...prev,
        packageImages: updatedImages,
        items: updatedItems,
      };
    });
  };

  const handleUpdateMenuImage = (
    itemId: string,
    itemName: string,
    newUrl: string
  ) => {
    setMenuForm((prev) => {
      const updatedImages = {
        ...(prev.menuImages || {}),
        [itemId]: newUrl,
        [itemName]: newUrl,
      };

      const existingIndex = (prev.items || []).findIndex(
        (item) =>
          item.id === itemId ||
          item.name.toLowerCase() === itemName.toLowerCase()
      );

      let updatedItems = [...(prev.items || [])];
      if (existingIndex >= 0) {
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          image: newUrl,
        };
      } else {
        updatedItems.push({
          id: itemId || `menu-${Date.now()}`,
          name: itemName,
          category: "Main Course",
          image: newUrl,
        });
      }

      return {
        ...prev,
        menuImages: updatedImages,
        items: updatedItems,
      };
    });
  };

  const handleSaveCurrentSection = async () => {
    setIsSaving(true);
    setSaveStatus({ type: "", text: "" });
    const userName = currentUser?.name || "Admin User";

    try {
      if (activeTab === "hero") {
        await saveCMSSection("hero", heroForm, userName);
        await saveCMSSection("announcement", announcementForm, userName);
        setCmsData((prev) => ({
          ...prev,
          hero: heroForm,
          announcement: announcementForm,
        }));
      } else if (activeTab === "packages") {
        await saveCMSSection("packages", packagesForm, userName);
        try {
          if (packagesForm.packageImages) {
            for (const [key, imgUrl] of Object.entries(packagesForm.packageImages)) {
              if (imgUrl) {
                await supabase
                  .from("packages")
                  .update({ image_url: imgUrl })
                  .or(`id.eq.${key},name.eq.${key}`);
              }
            }
          }
        } catch (e) {
          console.warn("Could not sync image_url directly to packages table:", e);
        }
        setCmsData((prev) => ({ ...prev, packages: packagesForm }));
      } else if (activeTab === "menu") {
        await saveCMSSection("menu", menuForm, userName);
        try {
          if (menuForm.menuImages) {
            for (const [key, imgUrl] of Object.entries(menuForm.menuImages)) {
              if (imgUrl) {
                await supabase
                  .from("menu_items")
                  .update({ image_url: imgUrl })
                  .or(`id.eq.${key},name.eq.${key}`);
              }
            }
          }
        } catch (e) {
          console.warn("Could not sync image_url directly to menu_items table:", e);
        }
        setCmsData((prev) => ({ ...prev, menu: menuForm }));
      } else if (activeTab === "about") {
        await saveCMSSection("about", aboutForm, userName);
        setCmsData((prev) => ({ ...prev, about: aboutForm }));
      } else if (activeTab === "contact") {
        await saveCMSSection("contact", contactForm, userName);
        setCmsData((prev) => ({ ...prev, contact: contactForm }));
      } else if (activeTab === "testimonials") {
        await saveCMSSection("testimonials", testimonialsForm, userName);
        setCmsData((prev) => ({ ...prev, testimonials: testimonialsForm }));
      } else if (activeTab === "process") {
        await saveCMSSection("process", processForm, userName);
        setCmsData((prev) => ({ ...prev, process: processForm }));
      } else if (activeTab === "faqs") {
        await saveCMSSection("faqs", faqsForm, userName);
        setCmsData((prev) => ({ ...prev, faqs: faqsForm }));
      }

      setSaveStatus({
        type: "success",
        text: `${activeTab.toUpperCase()} section updated and published successfully!`,
      });
      setShowConfirmModal(false);
      setTimeout(() => setSaveStatus({ type: "", text: "" }), 3000);
    } catch (err: any) {
      setSaveStatus({
        type: "error",
        text: err.message || "Failed to save section.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetCurrentSection = async () => {
    if (activeTab === "hero") {
      setHeroForm(DEFAULT_CMS_DATA.hero);
      setAnnouncementForm(DEFAULT_CMS_DATA.announcement);
    } else if (activeTab === "packages") {
      setPackagesForm(DEFAULT_CMS_DATA.packages);
    } else if (activeTab === "menu") {
      setMenuForm(DEFAULT_CMS_DATA.menu);
    } else if (activeTab === "about") {
      setAboutForm(DEFAULT_CMS_DATA.about);
    } else if (activeTab === "contact") {
      setContactForm(DEFAULT_CMS_DATA.contact);
    } else if (activeTab === "testimonials") {
      setTestimonialsForm(DEFAULT_CMS_DATA.testimonials);
    } else if (activeTab === "process") {
      setProcessForm(DEFAULT_CMS_DATA.process);
    } else if (activeTab === "faqs") {
      setFaqsForm(DEFAULT_CMS_DATA.faqs);
    }
    setShowConfirmModal(false);
    setSaveStatus({
      type: "success",
      text: `${activeTab.toUpperCase()} reset to default presets. Click Save to publish.`,
    });
    setTimeout(() => setSaveStatus({ type: "", text: "" }), 3000);
  };

  const tabs = [
    {
      id: "hero",
      label: "Hero & Banner",
      icon: Sparkles,
      desc: "Header, tagline, main hero imagery, and announcement bar",
    },
    {
      id: "packages",
      label: "Packages & Imagery",
      icon: Package,
      desc: "Package cover photos, collections header, and showcase styling",
    },
    {
      id: "menu",
      label: "Menu & Culinary",
      icon: Utensils,
      desc: "Dish presentation photos, menu categories, and selection header",
    },
    {
      id: "about",
      label: "About & Story",
      icon: FileText,
      desc: "Brand heritage, legacy story, and pillars of excellence",
    },
    {
      id: "contact",
      label: "Contact & Info",
      icon: Phone,
      desc: "Office hours, address, phone, email, maps, and social channels",
    },
    {
      id: "testimonials",
      label: "Reviews & Quotes",
      icon: MessageSquare,
      desc: "Customer testimonials, star ratings, and featured review",
    },
    {
      id: "process",
      label: "How It Works",
      icon: Layers,
      desc: "Step-by-step booking journey and guidance",
    },
    {
      id: "faqs",
      label: "FAQs",
      icon: HelpCircle,
      desc: "Customer inquiries and help accordion items",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-natural-accent animate-pulse">
          <Globe className="w-8 h-8 animate-spin" />
          <p className="text-xs uppercase tracking-widest font-bold">
            Loading Content Management System...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-natural-accent/10 text-natural-accent">
              <Globe className="w-5 h-5" />
            </span>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-natural-text-main">
              Customer Website CMS
            </h2>
          </div>
          <p className="text-natural-text-light text-[0.75rem] md:text-[0.8rem] font-medium uppercase tracking-wider mt-1">
            Real-time management for customer-facing pages & promotional assets
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer shrink-0",
              showLivePreview
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30 ring-2 ring-amber-500/20"
                : "border-natural-border hover:bg-natural-bg/50 text-natural-text-main"
            )}
          >
            {showLivePreview ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {showLivePreview ? "Hide Preview" : "Live Preview"}
          </button>

          <button
            onClick={() => {
              setConfirmActionType("reset");
              setShowConfirmModal(true);
            }}
            title="Reset current tab to defaults"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-natural-text-light hover:text-red-500 border border-natural-border hover:bg-natural-bg/50 transition-all cursor-pointer shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={() => {
              setConfirmActionType("save");
              setShowConfirmModal(true);
            }}
            className="flex items-center gap-2 bg-natural-accent text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-natural-accent/90 transition-all shadow-md cursor-pointer active:scale-95 shrink-0"
          >
            <Save className="w-4 h-4" />
            Publish Changes
          </button>
        </div>
      </div>

      {/* Save Status Toast */}
      {saveStatus.text && (
        <div
          className={cn(
            "p-4 rounded-xl text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2 duration-300",
            saveStatus.type === "error"
              ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
              : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800"
          )}
        >
          <div className="flex items-center gap-2">
            {saveStatus.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{saveStatus.text}</span>
          </div>
          <button
            onClick={() => setSaveStatus({ type: "", text: "" })}
            className="p-1 hover:opacity-70 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main CMS Layout - 3-Column Responsive Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Navigation Tabs */}
        <aside className="w-full lg:w-52 xl:w-60 shrink-0">
          <div className="glass-card overflow-hidden sticky top-6">
            <div className="p-4 border-b border-natural-border/50 bg-natural-bg/30">
              <span className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                CMS Sections
              </span>
            </div>
            <nav className="p-2 space-y-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setPreviewPage(tab.id as any);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 p-3.5 rounded-xl text-left transition-all cursor-pointer group",
                      isActive
                        ? "bg-natural-accent text-white shadow-xs"
                        : "text-natural-text-main hover:bg-natural-bg/60 border border-transparent"
                    )}
                  >
                    <tab.icon
                      className={cn(
                        "w-5 h-5 shrink-0 mt-0.5",
                        isActive
                          ? "text-white"
                          : "text-natural-accent group-hover:scale-110 transition-transform"
                      )}
                    />
                    <div>
                      <p className="text-xs font-bold tracking-wide">
                        {tab.label}
                      </p>
                      <p
                        className={cn(
                          "text-[10px] line-clamp-1 mt-0.5",
                          isActive ? "text-white/80" : "text-natural-text-light"
                        )}
                      >
                        {tab.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-natural-border/50 bg-natural-bg/10 text-[10px] text-natural-text-light space-y-1">
              <div className="flex items-center gap-1 font-semibold text-natural-accent">
                <Info className="w-3.5 h-3.5" />
                <span>Real-Time Sync</span>
              </div>
              <p>
                Published modifications sync immediately with the live customer
                portal.
              </p>
            </div>
          </div>
        </aside>

        {/* Content Editor Panel */}
        <div className="flex-1 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: HERO & ANNOUNCEMENT */}
          {/* ========================================================================= */}
          {activeTab === "hero" && (
            <div className="space-y-6">
              {/* Announcement Bar Toggle Card */}
              <div className="glass-card p-6 border-l-4 border-l-amber-500 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="text-sm font-bold text-natural-text-main uppercase tracking-wider">
                        Top Announcement Banner
                      </h3>
                      <p className="text-[11px] text-natural-text-light">
                        Display a prominent alert or holiday promotion banner at
                        the very top of the customer website.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={announcementForm.enabled}
                      onChange={(e) =>
                        setAnnouncementForm({
                          ...announcementForm,
                          enabled: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-natural-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {announcementForm.enabled && (
                  <div className="pt-4 border-t border-natural-border/50 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                        Banner Message
                      </label>
                      <input
                        type="text"
                        value={announcementForm.message}
                        onChange={(e) =>
                          setAnnouncementForm({
                            ...announcementForm,
                            message: e.target.value,
                          })
                        }
                        placeholder="e.g., Now accepting Christmas & New Year bookings! Inquire early for prime dates."
                        className="w-full px-3.5 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                        Action Link Text
                      </label>
                      <input
                        type="text"
                        value={announcementForm.linkText}
                        onChange={(e) =>
                          setAnnouncementForm({
                            ...announcementForm,
                            linkText: e.target.value,
                          })
                        }
                        placeholder="Book Now"
                        className="w-full px-3.5 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Hero Section Card */}
              <div className="glass-card p-8 space-y-6">
                <div className="border-b border-natural-border pb-4">
                  <h3 className="text-lg font-serif font-bold text-natural-text-main">
                    Hero Section Configuration
                  </h3>
                  <p className="text-xs text-natural-text-light">
                    Controls the primary welcoming visual and headlines that
                    greet visitors on the customer home page.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Top Badge / Tagline
                    </label>
                    <input
                      type="text"
                      value={heroForm.tagline}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, tagline: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-sm text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Main Title (Line 1)
                    </label>
                    <input
                      type="text"
                      value={heroForm.title}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, title: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-sm text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Main Title Italic (Line 2)
                    </label>
                    <input
                      type="text"
                      value={heroForm.titleItalic}
                      onChange={(e) =>
                        setHeroForm({
                          ...heroForm,
                          titleItalic: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-sm text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Subtitle / Supporting Note
                    </label>
                    <input
                      type="text"
                      value={heroForm.subtitle}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, subtitle: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-sm text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                    />
                  </div>
                </div>

                {/* Call-to-Action Buttons */}
                <div className="pt-4 border-t border-natural-border space-y-4">
                  <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider block">
                    Call-to-Action Buttons
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-xl bg-natural-bg/20 border border-natural-border space-y-3">
                      <p className="text-[10px] font-bold text-natural-accent uppercase tracking-widest">
                        Primary CTA Button (Gold Gradient)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-bold text-natural-text-light uppercase">
                            Label
                          </label>
                          <input
                            type="text"
                            value={heroForm.primaryBtnText}
                            onChange={(e) =>
                              setHeroForm({
                                ...heroForm,
                                primaryBtnText: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs text-natural-text-main"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-natural-text-light uppercase">
                            Target Route
                          </label>
                          <input
                            type="text"
                            value={heroForm.primaryBtnLink}
                            onChange={(e) =>
                              setHeroForm({
                                ...heroForm,
                                primaryBtnLink: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs text-natural-text-main"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-natural-bg/20 border border-natural-border space-y-3">
                      <p className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                        Secondary CTA Button (Outline)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-bold text-natural-text-light uppercase">
                            Label
                          </label>
                          <input
                            type="text"
                            value={heroForm.secondaryBtnText}
                            onChange={(e) =>
                              setHeroForm({
                                ...heroForm,
                                secondaryBtnText: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs text-natural-text-main"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-natural-text-light uppercase">
                            Target Route
                          </label>
                          <input
                            type="text"
                            value={heroForm.secondaryBtnLink}
                            onChange={(e) =>
                              setHeroForm({
                                ...heroForm,
                                secondaryBtnLink: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs text-natural-text-main"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hero Background Image */}
                <div className="pt-4 border-t border-natural-border space-y-4">
                  <ImageUploadField
                    label="Hero Backdrop Photography"
                    sublabel="High-resolution web landscape image recommended (1920x1080)"
                    value={heroForm.backgroundImage}
                    onChange={(url) =>
                      setHeroForm({
                        ...heroForm,
                        backgroundImage: url,
                      })
                    }
                    presets={PRESET_HERO_IMAGES}
                    aspectRatio="wide"
                    placeholder="https://images.unsplash.com/..."
                  />

                  {/* Live Thumbnail Preview */}
                  {heroForm.backgroundImage && (
                    <div className="relative aspect-[21/9] max-h-48 rounded-xl overflow-hidden border border-natural-border shadow-inner">
                      <img
                        src={heroForm.backgroundImage}
                        alt="Hero preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-4 text-white">
                        <span className="text-[9px] uppercase tracking-widest text-amber-300 font-bold">
                          {heroForm.tagline}
                        </span>
                        <h4 className="text-lg font-serif font-bold">
                          {heroForm.title}{" "}
                          <span className="italic">{heroForm.titleItalic}</span>
                        </h4>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: PACKAGES & IMAGERY */}
          {/* ========================================================================= */}
          {activeTab === "packages" && (
            <div className="glass-card p-8 space-y-8">
              <div className="border-b border-natural-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-natural-accent/10 text-natural-accent">
                    <Package className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-serif font-bold text-natural-text-main">
                    Catering Packages & Showcase Imagery
                  </h3>
                </div>
                <p className="text-xs text-natural-text-light mt-1">
                  Customize the packages intro narrative and assign high-resolution cover photos for each package collection. Photos can be uploaded directly from your computer, drag & dropped, or picked from curated presets.
                </p>
              </div>

              {/* Section Header Controls */}
              <div className="p-6 rounded-xl border border-natural-border bg-natural-bg/20 space-y-4">
                <div className="flex items-center gap-2 border-b border-natural-border/60 pb-3">
                  <FileText className="w-4 h-4 text-natural-accent" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-natural-text-main">
                    Package Catalog Header & Subtitle
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Header Subtitle
                    </label>
                    <input
                      type="text"
                      value={packagesForm.headerSubtitle}
                      onChange={(e) =>
                        setPackagesForm({
                          ...packagesForm,
                          headerSubtitle: e.target.value,
                        })
                      }
                      placeholder="Exclusive Collections"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Header Title
                    </label>
                    <input
                      type="text"
                      value={packagesForm.headerTitle}
                      onChange={(e) =>
                        setPackagesForm({
                          ...packagesForm,
                          headerTitle: e.target.value,
                        })
                      }
                      placeholder="Catering"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Title Italic Highlight
                    </label>
                    <input
                      type="text"
                      value={packagesForm.headerTitleItalic}
                      onChange={(e) =>
                        setPackagesForm({
                          ...packagesForm,
                          headerTitleItalic: e.target.value,
                        })
                      }
                      placeholder="Packages"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main font-serif italic"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Section Description
                  </label>
                  <textarea
                    rows={2}
                    value={packagesForm.description}
                    onChange={(e) =>
                      setPackagesForm({
                        ...packagesForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="From intimate gatherings to grand celebrations, find the perfect curation for your event's specific needs and scale."
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main leading-relaxed"
                  />
                </div>
              </div>

              {/* Package Imagery Cards */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-natural-border pb-3">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-natural-text-main flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-natural-accent" />
                      Package Cover Photos ({displayPackages.length})
                    </h4>
                    <p className="text-xs text-natural-text-light mt-0.5">
                      Assign distinct presentation photography for each catering offering. These photos sync live to both the Home page showcase and the /packages catalog.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {displayPackages.map((pkg, idx) => {
                    const currentImg =
                      packagesForm.packageImages?.[pkg.id] ||
                      packagesForm.packageImages?.[pkg.name] ||
                      pkg.image ||
                      pkg.image_url ||
                      "";

                    return (
                      <div
                        key={pkg.id || idx}
                        className="p-6 rounded-2xl border border-natural-border/80 bg-white/40 dark:bg-white/[0.02] shadow-sm hover:shadow-md transition-all space-y-4"
                      >
                        {/* Package Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-natural-border/60 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-base font-serif font-bold text-natural-text-main uppercase tracking-wider">
                                {pkg.name}
                              </h4>
                              {pkg.tag && pkg.tag.toLowerCase() !== "none" && (
                                <span className="bg-amber-400 text-black px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-sm">
                                  {pkg.tag}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-natural-text-light">
                              <span className="text-natural-accent font-semibold">
                                {pkg.price ? `₱ ${pkg.price}` : "Custom Pricing"}
                              </span>
                              <span>•</span>
                              <span>{pkg.pax ? `${pkg.pax} Guests` : "Flexible Pax"}</span>
                            </div>
                          </div>

                          {currentImg && (
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="w-16 h-10 rounded-md overflow-hidden border border-natural-border/80 shadow-inner bg-black/40">
                                <img
                                  src={currentImg}
                                  alt={pkg.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src =
                                      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600";
                                  }}
                                />
                              </div>
                              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Image Active
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Image Upload Field */}
                        <ImageUploadField
                          label={`Cover Photo for "${pkg.name}"`}
                          sublabel="Upload a photo from your computer, drag & drop, or paste an image link."
                          value={currentImg}
                          onChange={(url) =>
                            handleUpdatePackageImage(pkg.id, pkg.name, url)
                          }
                          presets={PRESET_PACKAGE_IMAGES}
                          aspectRatio="video"
                          placeholder="https://images.unsplash.com/..."
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-6 border-t border-natural-border flex items-center justify-between gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmActionType("reset");
                    setShowConfirmModal(true);
                  }}
                  className="px-4 py-2 border border-natural-border rounded-xl text-xs font-bold text-natural-text-light hover:text-red-500 hover:border-red-300 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Packages to Default
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmActionType("save");
                    setShowConfirmModal(true);
                  }}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-natural-accent text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 shadow-lg shadow-natural-accent/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Save Packages & Imagery
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: MENU & CULINARY */}
          {/* ========================================================================= */}
          {activeTab === "menu" && (
            <div className="glass-card p-8 space-y-8">
              <div className="border-b border-natural-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-natural-accent/10 text-natural-accent">
                    <Utensils className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-serif font-bold text-natural-text-main">
                    Menu & Culinary Presentation Showcase
                  </h3>
                </div>
                <p className="text-xs text-natural-text-light mt-1">
                  Customize the menu page narrative and assign high-resolution presentation photography for each dish across your culinary categories.
                </p>
              </div>

              {/* Section Header Controls */}
              <div className="p-6 rounded-xl border border-natural-border bg-natural-bg/20 space-y-4">
                <div className="flex items-center gap-2 border-b border-natural-border/60 pb-3">
                  <FileText className="w-4 h-4 text-natural-accent" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-natural-text-main">
                    Menu Page Header & Subtitle
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Header Subtitle
                    </label>
                    <input
                      type="text"
                      value={menuForm.headerSubtitle}
                      onChange={(e) =>
                        setMenuForm({
                          ...menuForm,
                          headerSubtitle: e.target.value,
                        })
                      }
                      placeholder="Roxan Policarpio Catering"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Header Title
                    </label>
                    <input
                      type="text"
                      value={menuForm.headerTitle}
                      onChange={(e) =>
                        setMenuForm({
                          ...menuForm,
                          headerTitle: e.target.value,
                        })
                      }
                      placeholder="Curated"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Title Italic Highlight
                    </label>
                    <input
                      type="text"
                      value={menuForm.headerTitleItalic}
                      onChange={(e) =>
                        setMenuForm({
                          ...menuForm,
                          headerTitleItalic: e.target.value,
                        })
                      }
                      placeholder="Selection"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main font-serif italic"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Section Description
                  </label>
                  <textarea
                    rows={2}
                    value={menuForm.description}
                    onChange={(e) =>
                      setMenuForm({
                        ...menuForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Explore our dynamic culinary offerings crafted with passion, artful presentation, and the finest ingredients."
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main leading-relaxed"
                  />
                </div>
              </div>

              {/* Menu Dishes Imagery Manager */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-natural-border pb-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-natural-text-main flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-natural-accent" />
                      Culinary Presentation Photos ({filteredMenuItems.length} of {displayMenuItems.length})
                    </h4>
                    <p className="text-xs text-natural-text-light mt-0.5">
                      Assign distinct presentation photos for each dish. Changes reflect live on the customer /menu sliders.
                    </p>
                  </div>

                  {/* Search input */}
                  <div className="w-full sm:w-64">
                    <input
                      type="text"
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      placeholder="Search dishes or categories..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {[
                    "All",
                    "Main Course",
                    "Appetizers",
                    "Pasta",
                    "Desserts",
                    "Beverages",
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedMenuCategory(cat)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase transition-all shrink-0 cursor-pointer",
                        selectedMenuCategory.toLowerCase() === cat.toLowerCase()
                          ? "bg-natural-accent text-white shadow-sm"
                          : "bg-natural-bg/40 text-natural-text-light hover:text-natural-text-main hover:bg-natural-bg/70"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Dishes Grid */}
                <div className="grid grid-cols-1 gap-6">
                  {filteredMenuItems.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-natural-border rounded-xl bg-natural-bg/10">
                      <Utensils className="w-8 h-8 text-natural-text-light mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-natural-text-light uppercase tracking-wider">
                        No dishes found matching "{menuSearchQuery || selectedMenuCategory}".
                      </p>
                    </div>
                  ) : (
                    filteredMenuItems.map((dish, idx) => {
                      const currentImg =
                        menuForm.menuImages?.[dish.id] ||
                        menuForm.menuImages?.[dish.name] ||
                        dish.image ||
                        dish.image_url ||
                        "";

                      return (
                        <div
                          key={dish.id || idx}
                          className="p-6 rounded-2xl border border-natural-border/80 bg-white/40 dark:bg-white/[0.02] shadow-sm hover:shadow-md transition-all space-y-4"
                        >
                          {/* Dish Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-natural-border/60 pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-serif font-bold text-natural-text-main uppercase tracking-wider">
                                  {dish.name}
                                </h4>
                                <span className="bg-natural-accent/15 text-natural-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded">
                                  {dish.category}
                                </span>
                                {dish.sub_category && (
                                  <span className="bg-black/10 dark:bg-white/10 text-natural-text-light px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded">
                                    {dish.sub_category}
                                  </span>
                                )}
                              </div>
                              {dish.description && (
                                <p className="text-xs text-natural-text-light line-clamp-1">
                                  {dish.description}
                                </p>
                              )}
                            </div>

                            {currentImg && (
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="w-16 h-10 rounded-md overflow-hidden border border-natural-border/80 shadow-inner bg-black/40">
                                  <img
                                    src={currentImg}
                                    alt={dish.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=600";
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Image Active
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Image Upload Field */}
                          <ImageUploadField
                            label={`Presentation Photo for "${dish.name}"`}
                            sublabel="Upload a photo from your computer, drag & drop, or paste an image link."
                            value={currentImg}
                            onChange={(url) =>
                              handleUpdateMenuImage(dish.id, dish.name, url)
                            }
                            presets={PRESET_MENU_IMAGES}
                            aspectRatio="video"
                            placeholder="https://images.unsplash.com/photo-..."
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-6 border-t border-natural-border flex items-center justify-between gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmActionType("reset");
                    setShowConfirmModal(true);
                  }}
                  className="px-4 py-2 border border-natural-border rounded-xl text-xs font-bold text-natural-text-light hover:text-red-500 hover:border-red-300 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Menu to Default
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmActionType("save");
                    setShowConfirmModal(true);
                  }}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-natural-accent text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 shadow-lg shadow-natural-accent/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Save Menu & Imagery
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ABOUT & STORY */}
          {/* ========================================================================= */}
          {activeTab === "about" && (
            <div className="glass-card p-8 space-y-8">
              <div className="border-b border-natural-border pb-4">
                <h3 className="text-lg font-serif font-bold text-natural-text-main">
                  About Page & Brand Legacy Narrative
                </h3>
                <p className="text-xs text-natural-text-light">
                  Customize the story, culinary heritage, core pillars, and
                  imagery for the customer About page.
                </p>
              </div>

              {/* Header Titles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Header Subtitle
                  </label>
                  <input
                    type="text"
                    value={aboutForm.headerSubtitle}
                    onChange={(e) =>
                      setAboutForm({
                        ...aboutForm,
                        headerSubtitle: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Header Title Main
                  </label>
                  <input
                    type="text"
                    value={aboutForm.headerTitle}
                    onChange={(e) =>
                      setAboutForm({
                        ...aboutForm,
                        headerTitle: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Header Title Highlight (Gold Italic)
                  </label>
                  <input
                    type="text"
                    value={aboutForm.headerTitleItalic}
                    onChange={(e) =>
                      setAboutForm({
                        ...aboutForm,
                        headerTitleItalic: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>
              </div>

              {/* Legacy Story Narrative */}
              <div className="pt-4 border-t border-natural-border space-y-4">
                <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider block">
                  Heritage Story Narrative
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Section Tagline
                    </label>
                    <input
                      type="text"
                      value={aboutForm.storyTagline}
                      onChange={(e) =>
                        setAboutForm({
                          ...aboutForm,
                          storyTagline: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Story Main Headline Quote
                    </label>
                    <input
                      type="text"
                      value={aboutForm.storyHeadline}
                      onChange={(e) =>
                        setAboutForm({
                          ...aboutForm,
                          storyHeadline: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Paragraph 1 (Origins & Passion)
                  </label>
                  <textarea
                    rows={3}
                    value={aboutForm.storyParagraph1}
                    onChange={(e) =>
                      setAboutForm({
                        ...aboutForm,
                        storyParagraph1: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Paragraph 2 (Growth & Milestones)
                  </label>
                  <textarea
                    rows={3}
                    value={aboutForm.storyParagraph2}
                    onChange={(e) =>
                      setAboutForm({
                        ...aboutForm,
                        storyParagraph2: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
                  />
                </div>

                <ImageUploadField
                  label="Story Feature Image"
                  sublabel="High-resolution photography showcasing the culinary team, venue, or banquet feast"
                  value={aboutForm.storyImage}
                  onChange={(url) =>
                    setAboutForm({
                      ...aboutForm,
                      storyImage: url,
                    })
                  }
                  aspectRatio="video"
                  placeholder="Paste image link or upload a file from your device..."
                />
              </div>

              {/* Pillars of Excellence Manager */}
              <div className="pt-4 border-t border-natural-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider block">
                      Pillars of Excellence (Core Values)
                    </span>
                    <p className="text-[10px] text-natural-text-light">
                      Key strengths highlighted in the Foundations section of
                      the About page.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAboutForm({
                        ...aboutForm,
                        pillars: [
                          ...aboutForm.pillars,
                          {
                            title: "New Pillar",
                            description:
                              "Describe this core value and standard of service.",
                            icon: "Star",
                          },
                        ],
                      });
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-natural-accent hover:opacity-80 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Pillar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {aboutForm.pillars.map((pillar, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-4 rounded-xl border border-natural-border bg-natural-bg/20 space-y-3 relative group"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const updated = aboutForm.pillars.filter(
                            (_, i) => i !== pIdx
                          );
                          setAboutForm({ ...aboutForm, pillars: updated });
                        }}
                        className="absolute top-3 right-3 text-natural-text-light hover:text-red-500 p-1 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                        title="Delete Pillar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        <select
                          value={pillar.icon}
                          onChange={(e) => {
                            const updated = [...aboutForm.pillars];
                            updated[pIdx].icon = e.target.value;
                            setAboutForm({ ...aboutForm, pillars: updated });
                          }}
                          className="px-2 py-1 text-xs font-bold bg-white dark:bg-black/40 border border-natural-border rounded text-natural-accent"
                        >
                          {AVAILABLE_PILLAR_ICONS.map((ico) => (
                            <option key={ico.name} value={ico.name}>
                              {ico.name} Icon
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-natural-text-light uppercase">
                          Title
                        </label>
                        <input
                          type="text"
                          value={pillar.title}
                          onChange={(e) => {
                            const updated = [...aboutForm.pillars];
                            updated[pIdx].title = e.target.value;
                            setAboutForm({ ...aboutForm, pillars: updated });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs font-bold text-natural-text-main"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-natural-text-light uppercase">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          value={pillar.description}
                          onChange={(e) => {
                            const updated = [...aboutForm.pillars];
                            updated[pIdx].description = e.target.value;
                            setAboutForm({ ...aboutForm, pillars: updated });
                          }}
                          className="w-full p-2 bg-white dark:bg-black/20 border border-natural-border rounded text-[11px] text-natural-text-main"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CONTACT & INFO */}
          {/* ========================================================================= */}
          {activeTab === "contact" && (
            <div className="glass-card p-8 space-y-8">
              <div className="border-b border-natural-border pb-4">
                <h3 className="text-lg font-serif font-bold text-natural-text-main">
                  Contact Coordinates & Business Logistics
                </h3>
                <p className="text-xs text-natural-text-light">
                  Update public phone numbers, catering headquarters address,
                  social links, and Google Maps embed.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-natural-accent" />
                    <span>Primary Contact Hotline</span>
                  </label>
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-natural-accent" />
                    <span>Inquiry Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-natural-accent" />
                    <span>Kitchen & Office Address</span>
                  </label>
                  <input
                    type="text"
                    value={contactForm.address}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        address: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-natural-accent" />
                    <span>Office / Operating Hours</span>
                  </label>
                  <input
                    type="text"
                    value={contactForm.officeHours}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        officeHours: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>
              </div>

              {/* Social Media Links */}
              <div className="pt-4 border-t border-natural-border space-y-4">
                <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider block">
                  Social Media & Messaging Links
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Facebook Page URL
                    </label>
                    <input
                      type="url"
                      value={contactForm.facebookUrl}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          facebookUrl: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Instagram Profile URL
                    </label>
                    <input
                      type="url"
                      value={contactForm.instagramUrl}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          instagramUrl: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Messenger Chat Link
                    </label>
                    <input
                      type="url"
                      value={contactForm.messengerUrl}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          messengerUrl: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                </div>
              </div>

              {/* Google Maps Embed */}
              <div className="pt-4 border-t border-natural-border space-y-4">
                <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider block">
                  Google Maps Location Embed
                </span>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Google Maps Iframe Embed Source URL
                  </label>
                  <input
                    type="url"
                    value={contactForm.mapEmbedUrl}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        mapEmbedUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main font-mono text-[11px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Location Banner Note
                  </label>
                  <input
                    type="text"
                    value={contactForm.locationNote}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        locationNote: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>
              </div>

              {/* Why Us Feature Images */}
              <div className="pt-4 border-t border-natural-border space-y-4">
                <div>
                  <span className="text-[11px] font-bold text-natural-text-main uppercase tracking-wider block">
                    "Why Us" Feature Photography
                  </span>
                  <p className="text-[10px] text-natural-text-light">
                    Visual showcase imagery displayed in the Why Us section of the customer portal.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ImageUploadField
                    label="Why Us Showcase Image 1"
                    value={contactForm.whyUsImage1}
                    onChange={(url) =>
                      setContactForm({
                        ...contactForm,
                        whyUsImage1: url,
                      })
                    }
                    aspectRatio="landscape"
                    placeholder="Upload or paste image link..."
                  />
                  <ImageUploadField
                    label="Why Us Showcase Image 2"
                    value={contactForm.whyUsImage2}
                    onChange={(url) =>
                      setContactForm({
                        ...contactForm,
                        whyUsImage2: url,
                      })
                    }
                    aspectRatio="landscape"
                    placeholder="Upload or paste image link..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: REVIEWS & TESTIMONIALS */}
          {/* ========================================================================= */}
          {activeTab === "testimonials" && (
            <div className="glass-card p-8 space-y-8">
              <div className="flex items-center justify-between border-b border-natural-border pb-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-natural-text-main">
                    Customer Reviews & Testimonials
                  </h3>
                  <p className="text-xs text-natural-text-light">
                    Manage client reviews. Exactly one active review can be
                    flagged as "Featured" for the spotlight on the home page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newItem: TestimonialItem = {
                      id: `test-${Date.now()}`,
                      author: "New Client",
                      role: "Wedding / Corporate Client",
                      quote:
                        "The catering was outstanding and our guests loved the entire setup.",
                      rating: 5,
                      featured: false,
                      active: true,
                    };
                    setTestimonialsForm({
                      ...testimonialsForm,
                      items: [...testimonialsForm.items, newItem],
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-natural-accent text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Review
                </button>
              </div>

              <div className="space-y-4">
                {testimonialsForm.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={cn(
                      "p-5 rounded-xl border transition-all space-y-3",
                      item.featured
                        ? "border-amber-500/50 bg-amber-500/5 ring-2 ring-amber-500/20"
                        : "border-natural-border bg-natural-bg/20"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-natural-accent/10 flex items-center justify-center text-natural-accent font-bold text-xs">
                          {item.author ? item.author[0] : "C"}
                        </div>
                        <div>
                          <input
                            type="text"
                            value={item.author}
                            onChange={(e) => {
                              const updated = [...testimonialsForm.items];
                              updated[idx].author = e.target.value;
                              setTestimonialsForm({
                                ...testimonialsForm,
                                items: updated,
                              });
                            }}
                            className="font-bold text-sm bg-transparent border-b border-transparent hover:border-natural-border focus:border-natural-accent focus:outline-none text-natural-text-main"
                            placeholder="Client Name"
                          />
                          <input
                            type="text"
                            value={item.role}
                            onChange={(e) => {
                              const updated = [...testimonialsForm.items];
                              updated[idx].role = e.target.value;
                              setTestimonialsForm({
                                ...testimonialsForm,
                                items: updated,
                              });
                            }}
                            className="text-[10px] text-natural-text-light block bg-transparent border-b border-transparent hover:border-natural-border focus:border-natural-accent focus:outline-none"
                            placeholder="Event Type (e.g. Wedding Client)"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Rating Selector */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => {
                                const updated = [...testimonialsForm.items];
                                updated[idx].rating = star;
                                setTestimonialsForm({
                                  ...testimonialsForm,
                                  items: updated,
                                });
                              }}
                              className="cursor-pointer text-amber-400 hover:scale-110 transition-transform"
                            >
                              <Star
                                className="w-4 h-4"
                                fill={
                                  star <= item.rating ? "currentColor" : "none"
                                }
                              />
                            </button>
                          ))}
                        </div>

                        {/* Featured Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = testimonialsForm.items.map(
                              (t, i) => ({
                                ...t,
                                featured: i === idx,
                              })
                            );
                            setTestimonialsForm({
                              ...testimonialsForm,
                              items: updated,
                            });
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all",
                            item.featured
                              ? "bg-amber-500 text-black font-bold"
                              : "border border-natural-border text-natural-text-light hover:text-natural-accent"
                          )}
                        >
                          {item.featured ? "★ Featured Spotlight" : "Set Spotlight"}
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = testimonialsForm.items.filter(
                              (_, i) => i !== idx
                            );
                            setTestimonialsForm({
                              ...testimonialsForm,
                              items: updated,
                            });
                          }}
                          className="text-natural-text-light hover:text-red-500 p-1 cursor-pointer"
                          title="Delete review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-natural-text-light uppercase">
                        Review Quote
                      </label>
                      <textarea
                        rows={2}
                        value={item.quote}
                        onChange={(e) => {
                          const updated = [...testimonialsForm.items];
                          updated[idx].quote = e.target.value;
                          setTestimonialsForm({
                            ...testimonialsForm,
                            items: updated,
                          });
                        }}
                        className="w-full p-2.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs italic text-natural-text-main"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: PROCESS */}
          {/* ========================================================================= */}
          {activeTab === "process" && (
            <div className="glass-card p-8 space-y-8">
              <div className="border-b border-natural-border pb-4">
                <h3 className="text-lg font-serif font-bold text-natural-text-main">
                  The Process ("How It Works" Steps)
                </h3>
                <p className="text-xs text-natural-text-light">
                  Guides prospective clients through the 3-step catering
                  reservation workflow on the Home page.
                </p>
              </div>

              <div className="space-y-4">
                {processForm.steps.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-5 rounded-xl border border-natural-border bg-natural-bg/20 grid grid-cols-1 md:grid-cols-4 gap-4 items-start"
                  >
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-natural-text-light uppercase">
                        Step Number
                      </label>
                      <input
                        type="text"
                        value={step.number}
                        onChange={(e) => {
                          const updated = [...processForm.steps];
                          updated[sIdx].number = e.target.value;
                          setProcessForm({ ...processForm, steps: updated });
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-sm font-bold text-natural-accent font-serif"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-natural-text-light uppercase">
                          Step Title
                        </label>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => {
                            const updated = [...processForm.steps];
                            updated[sIdx].title = e.target.value;
                            setProcessForm({ ...processForm, steps: updated });
                          }}
                          className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main uppercase tracking-wider"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-natural-text-light uppercase">
                          Step Explanation
                        </label>
                        <textarea
                          rows={2}
                          value={step.text}
                          onChange={(e) => {
                            const updated = [...processForm.steps];
                            updated[sIdx].text = e.target.value;
                            setProcessForm({ ...processForm, steps: updated });
                          }}
                          className="w-full p-2.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: FAQS */}
          {/* ========================================================================= */}
          {activeTab === "faqs" && (
            <div className="glass-card p-8 space-y-8">
              <div className="flex items-center justify-between border-b border-natural-border pb-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-natural-text-main">
                    Frequently Asked Questions (FAQs)
                  </h3>
                  <p className="text-xs text-natural-text-light">
                    Manage common questions and policies for customer inquiries.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newItem: FAQItem = {
                      id: `faq-${Date.now()}`,
                      question: "What is your cancellation or refund policy?",
                      answer:
                        "Bookings can be rescheduled up to 14 days before the event date without penalty.",
                      category: "Policies",
                      active: true,
                    };
                    setFaqsForm({
                      ...faqsForm,
                      items: [...faqsForm.items, newItem],
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-natural-accent text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add FAQ
                </button>
              </div>

              <div className="space-y-4">
                {faqsForm.items.map((faq, fIdx) => (
                  <div
                    key={faq.id || fIdx}
                    className="p-5 rounded-xl border border-natural-border bg-natural-bg/20 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={faq.category}
                          onChange={(e) => {
                            const updated = [...faqsForm.items];
                            updated[fIdx].category = e.target.value;
                            setFaqsForm({ ...faqsForm, items: updated });
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white dark:bg-black/30 border border-natural-border rounded text-natural-accent uppercase tracking-wider"
                        >
                          <option value="Booking">Booking</option>
                          <option value="Menu">Menu & Tasting</option>
                          <option value="Logistics">Logistics & Venues</option>
                          <option value="Policies">Policies & Payment</option>
                        </select>

                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => {
                            const updated = [...faqsForm.items];
                            updated[fIdx].question = e.target.value;
                            setFaqsForm({ ...faqsForm, items: updated });
                          }}
                          className="flex-1 font-bold text-xs bg-white dark:bg-black/20 border border-natural-border rounded-lg px-3 py-1.5 text-natural-text-main"
                          placeholder="Question title"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = faqsForm.items.filter(
                            (_, i) => i !== fIdx
                          );
                          setFaqsForm({ ...faqsForm, items: updated });
                        }}
                        className="text-natural-text-light hover:text-red-500 p-1 cursor-pointer"
                        title="Delete FAQ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-natural-text-light uppercase">
                        Answer Explanation
                      </label>
                      <textarea
                        rows={2}
                        value={faq.answer}
                        onChange={(e) => {
                          const updated = [...faqsForm.items];
                          updated[fIdx].answer = e.target.value;
                          setFaqsForm({ ...faqsForm, items: updated });
                        }}
                        className="w-full p-2.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {/* ========================================================================= */}
      {/* UPPER RIGHT STICKY LIVE PREVIEW PANEL */}
      {/* ========================================================================= */}
      {showLivePreview && (
        <aside className="w-full lg:w-[380px] xl:w-[460px] 2xl:w-[520px] shrink-0 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto custom-scrollbar p-4 sm:p-5 rounded-2xl bg-black border border-white/20 shadow-2xl text-white space-y-4 animate-in slide-in-from-right-4 duration-300">
          {/* Preview Header Toolbar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Live Simulation
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowFullPreviewModal(true)}
                className="flex items-center gap-1 text-[9px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-2 py-1 rounded transition-colors cursor-pointer"
                title="Expand to Fullscreen View"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Expand</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLivePreview(false)}
                className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                title="Hide Preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Page Preview Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {[
              { id: "hero", label: "Hero", icon: Globe },
              { id: "packages", label: "Packages", icon: Package },
              { id: "menu", label: "Menu", icon: Utensils },
              { id: "about", label: "About", icon: Sparkles },
              { id: "contact", label: "Contact", icon: Phone },
              { id: "testimonials", label: "Reviews", icon: Star },
              { id: "process", label: "Process", icon: Layers },
              { id: "faqs", label: "FAQs", icon: HelpCircle },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreviewPage(p.id as any)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer",
                  previewPage === p.id
                    ? "bg-amber-400 text-black shadow-md font-extrabold"
                    : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
                )}
              >
                <p.icon className="w-3 h-3" />
                {p.label}
              </button>
            ))}
          </div>

          {/* 1. HERO PREVIEW - Fully Visible & Non-Clipped */}
          {previewPage === "hero" && (
            <div className="space-y-3.5">
              {announcementForm.enabled && (
                <div className="p-2.5 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 text-black text-center text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 rounded-md shadow-md">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="line-clamp-2">{announcementForm.message}</span>
                  {announcementForm.linkText && (
                    <span className="underline ml-1 font-extrabold shrink-0">{announcementForm.linkText} →</span>
                  )}
                </div>
              )}

              <div className="relative min-h-[300px] rounded-xl overflow-hidden flex flex-col justify-center items-center text-center p-5 border border-white/15 bg-[#070707] shadow-xl">
                <img
                  src={heroForm.backgroundImage}
                  alt="Live Hero"
                  className="absolute inset-0 w-full h-full object-cover opacity-35"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="relative z-10 space-y-2.5 max-w-sm w-full">
                  <span className="inline-block text-[9px] uppercase tracking-[0.2em] font-extrabold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-3 py-1 rounded-full shadow-sm">
                    {heroForm.tagline || "Tagline"}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-serif text-white leading-snug font-bold">
                    {heroForm.title || "Headline"}{" "}
                    <span className="italic block text-amber-300 font-normal text-lg sm:text-xl">
                      {heroForm.titleItalic}
                    </span>
                  </h2>
                  <p className="text-[10px] text-white/80 leading-relaxed max-w-xs mx-auto line-clamp-3">
                    {heroForm.subtitle}
                  </p>
                  <div className="flex gap-2 justify-center pt-2 flex-wrap">
                    <span className="bg-amber-400 text-black px-4 py-1.5 font-bold uppercase text-[9px] tracking-widest rounded shadow-md">
                      {heroForm.primaryBtnText || "Inquire Now"}
                    </span>
                    <span className="border border-white/40 text-white px-4 py-1.5 font-bold uppercase text-[9px] tracking-widest rounded bg-white/5">
                      {heroForm.secondaryBtnText || "View Menu"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PACKAGES PREVIEW */}
          {previewPage === "packages" && (
            <div className="space-y-4">
              <div className="text-center p-3 border-b border-white/10">
                <span className="text-amber-400 text-[9px] tracking-[0.3em] font-bold uppercase block mb-1">
                  {packagesForm.headerSubtitle || "Exclusive Collections"}
                </span>
                <h4 className="text-lg font-serif text-white font-bold leading-tight">
                  {packagesForm.headerTitle || "Catering"}{" "}
                  <span className="italic text-amber-300 font-normal">
                    {packagesForm.headerTitleItalic || "Packages"}
                  </span>
                </h4>
                <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1 line-clamp-2">
                  {packagesForm.description || "From intimate gatherings to grand celebrations..."}
                </p>
              </div>

              <div className="space-y-3">
                {displayPackages.map((pkg, idx) => {
                  const img =
                    packagesForm.packageImages?.[pkg.id] ||
                    packagesForm.packageImages?.[pkg.name] ||
                    pkg.image ||
                    pkg.image_url ||
                    "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600";
                  return (
                    <div
                      key={pkg.id || idx}
                      className="rounded-lg overflow-hidden border border-white/10 bg-white/5 shadow-md flex flex-col"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-black/60">
                        {pkg.tag && pkg.tag.toLowerCase() !== "none" && (
                          <span className="absolute top-2 left-2 z-10 bg-amber-400 text-black px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded-sm shadow">
                            {pkg.tag}
                          </span>
                        )}
                        <img
                          src={img}
                          alt={pkg.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600";
                          }}
                        />
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between items-baseline gap-2">
                          <h5 className="text-xs font-serif font-bold text-white uppercase tracking-wider line-clamp-1">
                            {pkg.name}
                          </h5>
                          <span className="text-amber-400 font-serif text-xs font-bold shrink-0">
                            {pkg.price ? `₱ ${pkg.price}` : "Custom"}
                          </span>
                        </div>
                        <p className="text-[9px] text-white/60 tracking-wider mt-0.5">
                          {pkg.pax ? `${pkg.pax} Guests` : "Flexible Pax"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MENU PREVIEW */}
          {previewPage === "menu" && (
            <div className="space-y-4">
              <div className="text-center p-3 border-b border-white/10">
                <span className="text-amber-400 text-[9px] tracking-[0.3em] font-bold uppercase block mb-1">
                  {menuForm.headerSubtitle || "Roxan Policarpio Catering"}
                </span>
                <h4 className="text-lg font-serif text-white font-bold leading-tight">
                  {menuForm.headerTitle || "Curated"}{" "}
                  <span className="italic text-amber-300 font-normal">
                    {menuForm.headerTitleItalic || "Selection"}
                  </span>
                </h4>
                <p className="text-[9px] text-white/50 uppercase tracking-widest mt-1 line-clamp-2">
                  {menuForm.description || "Explore our dynamic culinary offerings..."}
                </p>
              </div>

              <div className="space-y-3">
                {displayMenuItems.slice(0, 4).map((dish, idx) => {
                  const img =
                    menuForm.menuImages?.[dish.id] ||
                    menuForm.menuImages?.[dish.name] ||
                    dish.image ||
                    dish.image_url ||
                    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=600";
                  return (
                    <div
                      key={dish.id || idx}
                      className="rounded-lg overflow-hidden border border-white/10 bg-white/5 shadow-md flex items-center gap-3 p-2.5"
                    >
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-black/60 shrink-0">
                        <img
                          src={img}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=600";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
                          {dish.category}
                        </span>
                        <h5 className="text-xs font-serif font-bold text-white uppercase tracking-wider truncate">
                          {dish.name}
                        </h5>
                        {dish.description && (
                          <p className="text-[9px] text-white/50 line-clamp-1 mt-0.5">
                            {dish.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. ABOUT PAGE PREVIEW */}
          {previewPage === "about" && (
            <div className="space-y-5 bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
              <div className="text-center pb-3 border-b border-white/10">
                <span className="text-amber-400 text-[9px] tracking-[0.3em] font-bold uppercase block mb-1">
                  {aboutForm.headerSubtitle}
                </span>
                <h3 className="text-xl font-serif text-white font-bold">
                  {aboutForm.headerTitle}{" "}
                  <span className="italic text-amber-400 font-normal">{aboutForm.headerTitleItalic}</span>
                </h3>
              </div>

              {/* Story Narrative */}
              <div className="space-y-3">
                <span className="text-amber-400 text-[9px] tracking-widest uppercase font-bold block">
                  {aboutForm.storyTagline}
                </span>
                <h4 className="text-xs font-serif font-bold text-white leading-snug">
                  {aboutForm.storyHeadline}
                </h4>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10 shadow-md">
                  <img
                    src={aboutForm.storyImage}
                    alt="Story preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-[10px] text-white/70 leading-relaxed">
                  {aboutForm.storyParagraph1}
                </p>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  {aboutForm.storyParagraph2}
                </p>
              </div>

              {/* Pillars */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="text-center">
                  <span className="text-amber-400 text-[8px] tracking-widest uppercase font-bold block">
                    {aboutForm.valuesSubtitle}
                  </span>
                  <h4 className="text-sm font-serif text-white font-bold">
                    {aboutForm.valuesTitle}{" "}
                    <span className="italic text-amber-300 font-normal">{aboutForm.valuesTitleItalic}</span>
                  </h4>
                </div>

                <div className="space-y-2">
                  {aboutForm.pillars.map((pillar, pIdx) => {
                    const iconObj = AVAILABLE_PILLAR_ICONS.find((i) => i.name === pillar.icon);
                    const IconComp = iconObj ? iconObj.icon : Sparkles;
                    return (
                      <div
                        key={pIdx}
                        className="p-3 rounded-lg border border-white/10 bg-white/5 flex items-start gap-3"
                      >
                        <div className="w-7 h-7 rounded-full border border-amber-400/30 flex items-center justify-center text-amber-400 bg-amber-400/10 shrink-0 mt-0.5">
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h5 className="text-[11px] font-bold text-white uppercase tracking-wider">
                            {pillar.title}
                          </h5>
                          <p className="text-[9px] text-white/60 leading-relaxed">
                            {pillar.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA Banner */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-amber-950/40 via-black to-amber-950/40 border border-amber-500/30 text-center space-y-2">
                <span className="text-amber-400 text-[8px] tracking-widest uppercase font-bold block">
                  {aboutForm.ctaSubtitle}
                </span>
                <h4 className="text-sm font-serif text-white font-bold">
                  {aboutForm.ctaTitle}{" "}
                  <span className="italic text-amber-300 font-normal">{aboutForm.ctaTitleItalic}</span>{" "}
                  {aboutForm.ctaTitleEnd}
                </h4>
                <span className="bg-amber-400 text-black px-4 py-1.5 rounded-xs font-bold uppercase text-[9px] tracking-widest inline-block shadow-md">
                  {aboutForm.ctaBtnText}
                </span>
              </div>
            </div>
          )}

          {/* 3. CONTACT PAGE PREVIEW */}
          {previewPage === "contact" && (
            <div className="space-y-5 bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
              <div className="text-center pb-3 border-b border-white/10">
                <span className="text-amber-400 text-[9px] tracking-[0.3em] font-bold uppercase block mb-1">
                  {contactForm.headerSubtitle}
                </span>
                <h3 className="text-xl font-serif text-white font-bold">
                  {contactForm.headerTitle}{" "}
                  <span className="italic text-amber-400 font-normal">{contactForm.headerTitleItalic}</span>
                </h3>
              </div>

              {/* 4 Info Cards */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { title: "Call Us", detail: contactForm.phone, icon: Phone },
                  { title: "Email Us", detail: contactForm.email, icon: Mail },
                  { title: "Our Location", detail: contactForm.address, icon: MapPin },
                  { title: "Office Hours", detail: contactForm.officeHours, icon: Clock },
                ].map((card, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-white/10 bg-white/5 flex flex-col items-center text-center space-y-1"
                  >
                    <div className="w-6 h-6 rounded-full border border-amber-400/30 flex items-center justify-center text-amber-400 bg-amber-400/10">
                      <card.icon className="w-3 h-3" />
                    </div>
                    <span className="text-[8px] uppercase tracking-widest font-bold text-white/50">
                      {card.title}
                    </span>
                    <p className="text-[10px] font-serif text-white line-clamp-2 leading-tight">
                      {card.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* Map Note */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-[10px] text-white/70 leading-tight">
                  {contactForm.locationNote}
                </p>
              </div>

              {/* Why Choose Us */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <span className="text-amber-400 text-[8px] tracking-widest uppercase font-bold block">
                  {contactForm.whyUsSubtitle}
                </span>
                <h4 className="text-sm font-serif text-white font-bold">
                  {contactForm.whyUsTitle}{" "}
                  <span className="italic text-amber-300 font-normal">{contactForm.whyUsTitleItalic}</span>
                </h4>
                <div className="space-y-2">
                  {contactForm.whyUsHighlights.map((hl, hlIdx) => (
                    <div key={hlIdx} className="flex gap-2.5 items-start">
                      <span className="text-amber-400/40 text-base font-serif italic shrink-0">
                        {hl.number}
                      </span>
                      <div>
                        <h5 className="text-[10px] font-bold text-white uppercase tracking-wider">
                          {hl.title}
                        </h5>
                        <p className="text-[9px] text-white/60 leading-tight">
                          {hl.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <img
                    src={contactForm.whyUsImage1}
                    alt="Why us 1"
                    className="w-full aspect-[4/3] object-cover rounded border border-white/10"
                  />
                  <img
                    src={contactForm.whyUsImage2}
                    alt="Why us 2"
                    className="w-full aspect-[4/3] object-cover rounded border border-white/10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. REVIEWS PREVIEW */}
          {previewPage === "testimonials" && (
            <div className="space-y-4 bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
              <div className="text-center pb-2 border-b border-white/10">
                <span className="text-amber-400 text-[9px] tracking-[0.3em] font-bold uppercase block mb-1">
                  {testimonialsForm.subtitle}
                </span>
                <h3 className="text-lg font-serif text-white font-bold">
                  Customer <span className="italic text-amber-400 font-normal">Spotlight</span>
                </h3>
              </div>

              {/* Spotlight Review */}
              {(() => {
                const featured =
                  testimonialsForm.items.find((t) => t.featured && t.active) ||
                  testimonialsForm.items[0];
                if (!featured) return null;
                return (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/30 to-black border border-amber-500/30 text-center space-y-2.5 shadow-md">
                    <Quote className="w-6 h-6 text-amber-400/40 mx-auto" />
                    <div className="flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className="w-3.5 h-3.5 text-amber-400"
                          fill={s <= featured.rating ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-serif italic text-white/90 leading-relaxed">
                      "{featured.quote}"
                    </p>
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                        {featured.author}
                      </h4>
                      <span className="text-[9px] text-white/50">
                        {featured.role}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Other Reviews */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                {testimonialsForm.items
                  .filter((t) => !t.featured && t.active)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="text-[11px] font-bold text-white">
                          {item.author}
                        </h5>
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className="w-2.5 h-2.5"
                              fill={s <= item.rating ? "currentColor" : "none"}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-white/70 italic line-clamp-2">
                        "{item.quote}"
                      </p>
                      <span className="text-[8px] text-white/40 uppercase tracking-wider block">
                        {item.role}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 5. PROCESS PREVIEW */}
          {previewPage === "process" && (
            <div className="space-y-4 bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
              <div className="text-center pb-2 border-b border-white/10">
                <span className="text-amber-400 text-[9px] tracking-[0.3em] font-bold uppercase block mb-1">
                  {processForm.subtitle}
                </span>
                <h3 className="text-lg font-serif text-white font-bold">
                  How It <span className="italic text-amber-400 font-normal">Works</span>
                </h3>
              </div>

              <div className="space-y-3">
                {processForm.steps.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3.5 rounded-xl border border-white/10 bg-white/5 space-y-1.5"
                  >
                    <span className="text-amber-400/40 text-2xl font-serif italic block leading-none">
                      {step.number}
                    </span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {step.title}
                    </h4>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. FAQS PREVIEW */}
          {previewPage === "faqs" && (
            <div className="space-y-4 bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
              <div className="text-center pb-2 border-b border-white/10">
                <span className="text-amber-400 text-[9px] tracking-[0.3em] font-bold uppercase block mb-1">
                  {faqsForm.subtitle}
                </span>
                <h3 className="text-lg font-serif text-white font-bold">
                  Common <span className="italic text-amber-400 font-normal">Inquiries</span>
                </h3>
              </div>

              <div className="space-y-2">
                {faqsForm.items.map((faq, fIdx) => (
                  <div
                    key={fIdx}
                    className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-bold text-white leading-tight">
                        {faq.question}
                      </h4>
                      <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 border border-amber-400/30 shrink-0">
                        {faq.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed pt-1 border-t border-white/5">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>

    {/* ========================================================================= */}
    {/* FULLSCREEN PREVIEW MODAL */}
    {/* ========================================================================= */}
    {showFullPreviewModal && (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col z-[80] p-4 sm:p-8 animate-in fade-in duration-200">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col bg-[#050505] border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
          {/* Modal Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4 bg-black/50">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold uppercase tracking-widest text-amber-400">
                Full-Scale Customer Preview Simulation
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Modal Page Switcher */}
              <div className="hidden sm:flex items-center gap-1.5">
                {[
                  { id: "hero", label: "Hero & Banner" },
                  { id: "packages", label: "Packages" },
                  { id: "menu", label: "Menu Catalog" },
                  { id: "about", label: "About Page" },
                  { id: "contact", label: "Contact Page" },
                  { id: "testimonials", label: "Reviews" },
                  { id: "process", label: "Process" },
                  { id: "faqs", label: "FAQs" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreviewPage(p.id as any)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer",
                      previewPage === p.id
                        ? "bg-amber-400 text-black font-extrabold"
                        : "bg-white/10 text-white/70 hover:text-white"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowFullPreviewModal(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Close Fullscreen Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Preview Body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12 text-white custom-scrollbar">
            {previewPage === "hero" && (
              <div className="space-y-6 max-w-4xl mx-auto">
                {announcementForm.enabled && (
                  <div className="p-3 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 text-black text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3 rounded-lg shadow-lg">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>{announcementForm.message}</span>
                    {announcementForm.linkText && (
                      <span className="underline ml-2 font-black">{announcementForm.linkText} →</span>
                    )}
                  </div>
                )}

                <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden flex items-center justify-center text-center p-8 border border-white/10 bg-[#070707]">
                  <img
                    src={heroForm.backgroundImage}
                    alt="Live Hero"
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                  <div className="relative z-10 space-y-4 max-w-xl">
                    <span className="text-xs uppercase tracking-[0.4em] font-bold text-amber-400 block">
                      {heroForm.tagline}
                    </span>
                    <h2 className="text-3xl md:text-5xl font-serif text-white leading-tight">
                      {heroForm.title}{" "}
                      <span className="italic block text-amber-300">{heroForm.titleItalic}</span>
                    </h2>
                    <p className="text-sm text-white/80 max-w-md mx-auto leading-relaxed">
                      {heroForm.subtitle}
                    </p>
                    <div className="flex gap-4 justify-center pt-3">
                      <span className="bg-amber-400 text-black px-6 py-2.5 font-bold uppercase text-xs tracking-widest rounded shadow-xl">
                        {heroForm.primaryBtnText}
                      </span>
                      <span className="border border-white/40 text-white px-6 py-2.5 font-bold uppercase text-xs tracking-widest rounded">
                        {heroForm.secondaryBtnText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {previewPage === "packages" && (
              <div className="space-y-8 max-w-5xl mx-auto">
                <div className="text-center py-6 border-b border-white/10">
                  <span className="text-amber-400 text-xs tracking-[0.4em] font-bold uppercase block mb-3">
                    {packagesForm.headerSubtitle || "Exclusive Collections"}
                  </span>
                  <h3 className="text-4xl md:text-5xl font-serif text-white font-bold leading-tight mb-4">
                    {packagesForm.headerTitle || "Catering"}{" "}
                    <span className="italic text-amber-300 font-normal">
                      {packagesForm.headerTitleItalic || "Packages"}
                    </span>
                  </h3>
                  <p className="text-xs text-white/50 uppercase tracking-[0.3em] font-bold max-w-xl mx-auto">
                    {packagesForm.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {displayPackages.map((pkg, idx) => {
                    const img =
                      packagesForm.packageImages?.[pkg.id] ||
                      packagesForm.packageImages?.[pkg.name] ||
                      pkg.image ||
                      pkg.image_url ||
                      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800";
                    return (
                      <div
                        key={pkg.id || idx}
                        className="rounded-xl overflow-hidden border border-white/15 bg-white/[0.03] backdrop-blur-md flex flex-col group hover:border-amber-400/40 transition-all duration-300 shadow-xl"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-black/60">
                          {pkg.tag && pkg.tag.toLowerCase() !== "none" && (
                            <span className="absolute top-3 left-3 z-10 bg-amber-400 text-black px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded shadow">
                              {pkg.tag}
                            </span>
                          )}
                          <img
                            src={img}
                            alt={pkg.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800";
                            }}
                          />
                        </div>
                        <div className="p-6 flex-grow flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <h4 className="text-lg font-serif font-bold text-white uppercase tracking-wider">
                                {pkg.name}
                              </h4>
                              <span className="text-amber-400 font-serif text-base font-bold shrink-0">
                                {pkg.price ? `₱ ${pkg.price}` : "Custom"}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/60 tracking-wider">
                              {pkg.pax ? `${pkg.pax} Guests` : "Flexible Pax"}
                            </p>
                          </div>
                          <div className="pt-6 mt-4 border-t border-white/10">
                            <div className="w-full py-2.5 text-center text-amber-400 border border-amber-400/30 rounded text-[10px] uppercase tracking-widest font-bold">
                              Select Package →
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {previewPage === "menu" && (
              <div className="space-y-8 max-w-5xl mx-auto">
                <div className="text-center py-6 border-b border-white/10">
                  <span className="text-amber-400 text-xs tracking-[0.4em] font-bold uppercase block mb-3">
                    {menuForm.headerSubtitle || "Roxan Policarpio Catering"}
                  </span>
                  <h3 className="text-4xl md:text-5xl font-serif text-white font-bold leading-tight mb-4">
                    {menuForm.headerTitle || "Curated"}{" "}
                    <span className="italic text-amber-300 font-normal">
                      {menuForm.headerTitleItalic || "Selection"}
                    </span>
                  </h3>
                  <p className="text-xs text-white/50 uppercase tracking-[0.3em] font-bold max-w-xl mx-auto">
                    {menuForm.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayMenuItems.map((dish, idx) => {
                    const img =
                      menuForm.menuImages?.[dish.id] ||
                      menuForm.menuImages?.[dish.name] ||
                      dish.image ||
                      dish.image_url ||
                      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800";
                    return (
                      <div
                        key={dish.id || idx}
                        className="rounded-xl overflow-hidden border border-white/15 bg-white/[0.03] backdrop-blur-md flex flex-col group hover:border-amber-400/40 transition-all duration-300 shadow-xl"
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/60">
                          <span className="absolute top-3 left-3 z-10 bg-amber-400 text-black px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded shadow">
                            {dish.category}
                          </span>
                          <img
                            src={img}
                            alt={dish.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800";
                            }}
                          />
                        </div>
                        <div className="p-5 flex-grow flex flex-col justify-between">
                          <div>
                            <h4 className="text-base font-serif font-bold text-white uppercase tracking-wider mb-1">
                              {dish.name}
                            </h4>
                            {dish.description && (
                              <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2">
                                {dish.description}
                              </p>
                            )}
                          </div>
                          {dish.sub_category && (
                            <span className="text-[9px] uppercase tracking-widest text-amber-400/80 font-bold mt-3 block">
                              {dish.sub_category}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {previewPage === "about" && (
              <div className="space-y-12 max-w-4xl mx-auto">
                <div className="text-center pb-8 border-b border-white/10">
                  <span className="text-amber-400 text-xs tracking-[0.4em] font-bold uppercase block mb-3">
                    {aboutForm.headerSubtitle}
                  </span>
                  <h2 className="text-4xl md:text-6xl font-serif text-white">
                    {aboutForm.headerTitle}{" "}
                    <span className="italic text-amber-400">{aboutForm.headerTitleItalic}</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                  <div className="space-y-4">
                    <span className="text-amber-400 text-xs tracking-widest uppercase font-bold block">
                      {aboutForm.storyTagline}
                    </span>
                    <h3 className="text-2xl font-serif font-bold text-white leading-snug">
                      {aboutForm.storyHeadline}
                    </h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {aboutForm.storyParagraph1}
                    </p>
                    <p className="text-sm text-white/50 leading-relaxed">
                      {aboutForm.storyParagraph2}
                    </p>
                  </div>
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                    <img
                      src={aboutForm.storyImage}
                      alt="Story preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-white/10 space-y-8">
                  <div className="text-center">
                    <span className="text-amber-400 text-xs tracking-widest uppercase font-bold block mb-2">
                      {aboutForm.valuesSubtitle}
                    </span>
                    <h3 className="text-3xl font-serif text-white">
                      {aboutForm.valuesTitle}{" "}
                      <span className="italic text-amber-300">{aboutForm.valuesTitleItalic}</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {aboutForm.pillars.map((pillar, pIdx) => {
                      const iconObj = AVAILABLE_PILLAR_ICONS.find((i) => i.name === pillar.icon);
                      const IconComp = iconObj ? iconObj.icon : Sparkles;
                      return (
                        <div
                          key={pIdx}
                          className="p-6 rounded-xl border border-white/10 bg-white/5 space-y-3 text-center"
                        >
                          <div className="w-12 h-12 mx-auto rounded-full border border-amber-400/30 flex items-center justify-center text-amber-400 bg-amber-400/10">
                            <IconComp className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                            {pillar.title}
                          </h4>
                          <p className="text-xs text-white/60 leading-relaxed">
                            {pillar.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {previewPage === "contact" && (
              <div className="space-y-10 max-w-4xl mx-auto">
                <div className="text-center pb-8 border-b border-white/10">
                  <span className="text-amber-400 text-xs tracking-[0.4em] font-bold uppercase block mb-3">
                    {contactForm.headerSubtitle}
                  </span>
                  <h2 className="text-4xl md:text-6xl font-serif text-white">
                    {contactForm.headerTitle}{" "}
                    <span className="italic text-amber-400">{contactForm.headerTitleItalic}</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: "Call Us", detail: contactForm.phone, icon: Phone },
                    { title: "Email Us", detail: contactForm.email, icon: Mail },
                    { title: "Our Location", detail: contactForm.address, icon: MapPin },
                    { title: "Office Hours", detail: contactForm.officeHours, icon: Clock },
                  ].map((card, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center text-center space-y-2"
                    >
                      <div className="w-10 h-10 rounded-full border border-amber-400/30 flex items-center justify-center text-amber-400 bg-amber-400/10">
                        <card.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">
                        {card.title}
                      </span>
                      <p className="text-sm font-serif text-white">
                        {card.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewPage === "testimonials" && (
              <div className="space-y-8 max-w-3xl mx-auto">
                <div className="text-center pb-6 border-b border-white/10">
                  <span className="text-amber-400 text-xs tracking-[0.4em] font-bold uppercase block mb-2">
                    {testimonialsForm.subtitle}
                  </span>
                  <h2 className="text-3xl font-serif text-white">
                    Words of <span className="italic text-amber-400">Delight</span>
                  </h2>
                </div>

                {testimonialsForm.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-xl border border-white/10 bg-white/5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white">{item.author}</h4>
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className="w-4 h-4"
                            fill={s <= item.rating ? "currentColor" : "none"}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm italic font-serif text-white/80 leading-relaxed">
                      "{item.quote}"
                    </p>
                    <span className="text-xs text-white/40 uppercase tracking-wider block">
                      {item.role}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {previewPage === "process" && (
              <div className="space-y-8 max-w-4xl mx-auto">
                <div className="text-center pb-6 border-b border-white/10">
                  <span className="text-amber-400 text-xs tracking-[0.4em] font-bold uppercase block mb-2">
                    {processForm.subtitle}
                  </span>
                  <h2 className="text-3xl font-serif text-white">
                    How It <span className="italic text-amber-400">Works</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {processForm.steps.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-6 rounded-xl border border-white/10 bg-white/5 space-y-3"
                    >
                      <span className="text-amber-400/30 text-4xl font-serif italic block">
                        {step.number}
                      </span>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        {step.title}
                      </h4>
                      <p className="text-xs text-white/60 leading-relaxed">
                        {step.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewPage === "faqs" && (
              <div className="space-y-6 max-w-3xl mx-auto">
                <div className="text-center pb-6 border-b border-white/10">
                  <span className="text-amber-400 text-xs tracking-[0.4em] font-bold uppercase block mb-2">
                    {faqsForm.subtitle}
                  </span>
                  <h2 className="text-3xl font-serif text-white">
                    Frequently Asked <span className="italic text-amber-400">Questions</span>
                  </h2>
                </div>

                <div className="space-y-4">
                  {faqsForm.items.map((faq, fIdx) => (
                    <div
                      key={fIdx}
                      className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-bold text-white">{faq.question}</h4>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-400 border border-amber-400/30 shrink-0">
                          {faq.category}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed pt-2 border-t border-white/5">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-natural-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-natural-border">
            <div className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-natural-accent text-white flex items-center justify-center mx-auto shadow-lg">
                {confirmActionType === "save" ? (
                  <Save className="w-7 h-7" />
                ) : (
                  <RotateCcw className="w-7 h-7" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-serif font-bold text-natural-text-main">
                  {confirmActionType === "save"
                    ? "Publish Website Changes?"
                    : "Reset Section to Defaults?"}
                </h3>
                <p className="text-xs text-natural-text-light mt-1">
                  {confirmActionType === "save"
                    ? `Updates to the '${activeTab.toUpperCase()}' section will immediately be saved to Supabase and reflect live on the customer portal.`
                    : `This will revert all fields in the '${activeTab.toUpperCase()}' section to initial presets.`}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={
                    confirmActionType === "save"
                      ? handleSaveCurrentSection
                      : handleResetCurrentSection
                  }
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-natural-accent hover:bg-natural-accent/90 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSaving
                    ? "Publishing..."
                    : confirmActionType === "save"
                    ? "Confirm & Publish"
                    : "Confirm Reset"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSaving}
                  className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-natural-text-light border border-natural-border hover:bg-natural-bg transition-all cursor-pointer"
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

