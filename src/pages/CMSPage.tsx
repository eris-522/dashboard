import React, { useState, useEffect, useMemo } from "react";
import {
  Home,
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
  Camera,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpRight,
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
  mergeSectionWithDefaults,
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

export type CMSTab = "home" | "menu" | "packages" | "about" | "faqs" | "contact";

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
  const [activeTab, setActiveTab] = useState<CMSTab>("home");
  const [previewPage, setPreviewPage] = useState<CMSTab>("home");
  const [cmsData, setCmsData] = useState<FullCMSData>(DEFAULT_CMS_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | "";
    text: string;
  }>({ type: "", text: "" });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState<"save" | "reset">("save");
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);

  // Form local states
  const [heroForm, setHeroForm] = useState(DEFAULT_CMS_DATA.hero);
  const [announcementForm, setAnnouncementForm] = useState(DEFAULT_CMS_DATA.announcement);
  const [packagesForm, setPackagesForm] = useState(DEFAULT_CMS_DATA.packages);
  const [dbPackages, setDbPackages] = useState<any[]>([]);
  const [menuForm, setMenuForm] = useState(DEFAULT_CMS_DATA.menu);
  const [dbMenuItems, setDbMenuItems] = useState<any[]>([]);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("All");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [aboutForm, setAboutForm] = useState(DEFAULT_CMS_DATA.about);
  const [contactForm, setContactForm] = useState(DEFAULT_CMS_DATA.contact);
  const [testimonialsForm, setTestimonialsForm] = useState(DEFAULT_CMS_DATA.testimonials);
  const [processForm, setProcessForm] = useState(DEFAULT_CMS_DATA.process);
  const [faqsForm, setFaqsForm] = useState(DEFAULT_CMS_DATA.faqs);

  // Modals for editing/adding dynamic items
  const [editingPillarIndex, setEditingPillarIndex] = useState<number | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<TestimonialItem | null>(null);
  const [editingFAQ, setEditingFAQ] = useState<FAQItem | null>(null);

  // Modals for imagery management
  const [editingMenuDish, setEditingMenuDish] = useState<any | null>(null);
  const [showMenuHeaderControls, setShowMenuHeaderControls] = useState(false);
  const [editingPackagePhoto, setEditingPackagePhoto] = useState<any | null>(null);
  const [showPackageHeaderControls, setShowPackageHeaderControls] = useState(false);

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

    // Load live packages from Supabase packages table
    try {
      const { data: pkgs } = await supabase
        .from("packages")
        .select("id, name, tag, price, pax, image_url, inclusions")
        .neq("status", "Archived");
      if (pkgs && pkgs.length > 0) {
        setDbPackages(pkgs);
      }
    } catch (e) {
      console.warn("Error fetching db packages for CMS:", e);
    }

    // Load live menu items from Supabase menu_items table
    try {
      const { data: dishes, error: dishesErr } = await supabase
        .from("menu_items")
        .select("id, name, category, sub_category, image_url")
        .neq("status", "Archived");
      if (dishesErr) {
        console.warn("Supabase menu_items fetch error:", dishesErr.message);
      }
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
        defaultImage: string;
        inclusions?: string[];
      }
    >();

    // 1. Default presets
    (DEFAULT_CMS_DATA.packages.items || []).forEach((item, idx) => {
      const defImg =
        DEFAULT_CMS_DATA.packages.packageImages[item.name] ||
        item.image ||
        PRESET_PACKAGE_IMAGES[idx % PRESET_PACKAGE_IMAGES.length].url;
      map.set(item.name.toLowerCase(), {
        ...item,
        image: defImg,
        defaultImage: defImg,
      });
    });

    // 2. CMS configured items
    (packagesForm.items || []).forEach((item, idx) => {
      const key = item.name.toLowerCase();
      const existing = map.get(key);
      const defImg =
        existing?.defaultImage ||
        DEFAULT_CMS_DATA.packages.packageImages[item.name] ||
        PRESET_PACKAGE_IMAGES[idx % PRESET_PACKAGE_IMAGES.length].url;
      const resolvedImg =
        item.image && item.image.trim() !== ""
          ? item.image
          : existing?.image || defImg;
      map.set(key, {
        ...existing,
        ...item,
        image: resolvedImg,
        defaultImage: defImg,
      });
    });

    // 3. Merge live packages from DB
    dbPackages.forEach((pkg, idx) => {
      const key = pkg.name.toLowerCase();
      const existing = map.get(key);
      const defImg =
        existing?.defaultImage ||
        DEFAULT_CMS_DATA.packages.packageImages[pkg.name] ||
        PRESET_PACKAGE_IMAGES[idx % PRESET_PACKAGE_IMAGES.length].url;
      const customImg =
        packagesForm.packageImages?.[pkg.id] ||
        packagesForm.packageImages?.[pkg.name] ||
        existing?.image ||
        pkg.image_url ||
        defImg;
      map.set(key, {
        id: pkg.id,
        name: pkg.name,
        price: pkg.price || existing?.price,
        pax: pkg.pax || existing?.pax,
        tag: pkg.tag || existing?.tag,
        image: customImg,
        image_url: pkg.image_url,
        defaultImage: defImg,
        inclusions: pkg.inclusions || existing?.inclusions,
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
        defaultImage: string;
      }
    >();

    // 1. Default presets
    (DEFAULT_CMS_DATA.menu.items || []).forEach((item, idx) => {
      const defImg =
        DEFAULT_CMS_DATA.menu.menuImages[item.name] ||
        item.image ||
        PRESET_MENU_IMAGES[idx % PRESET_MENU_IMAGES.length].url;
      map.set(item.name.toLowerCase(), {
        ...item,
        image: defImg,
        defaultImage: defImg,
      });
    });

    // 2. CMS configured items
    (menuForm.items || []).forEach((item, idx) => {
      const key = item.name.toLowerCase();
      const existing = map.get(key);
      const defImg =
        existing?.defaultImage ||
        DEFAULT_CMS_DATA.menu.menuImages[item.name] ||
        PRESET_MENU_IMAGES[idx % PRESET_MENU_IMAGES.length].url;
      const resolvedImg =
        item.image && item.image.trim() !== ""
          ? item.image
          : existing?.image || defImg;
      map.set(key, {
        ...existing,
        ...item,
        image: resolvedImg,
        defaultImage: defImg,
      });
    });

    // 3. Merge live dishes from DB
    dbMenuItems.forEach((item, idx) => {
      const key = item.name.toLowerCase();
      const existing = map.get(key);
      const defImg =
        existing?.defaultImage ||
        DEFAULT_CMS_DATA.menu.menuImages[item.name] ||
        PRESET_MENU_IMAGES[idx % PRESET_MENU_IMAGES.length].url;
      const customImg =
        menuForm.menuImages?.[item.id] ||
        menuForm.menuImages?.[item.name] ||
        existing?.image ||
        item.image_url ||
        defImg;
      map.set(key, {
        id: item.id,
        name: item.name,
        category: item.category || existing?.category || "Main Course",
        sub_category: item.sub_category,
        description:
          item.description || existing?.description || item.sub_category || "",
        image: customImg,
        image_url: item.image_url,
        defaultImage: defImg,
      });
    });

    return Array.from(map.values());
  }, [dbMenuItems, menuForm]);

  const menuCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: displayMenuItems.length };
    displayMenuItems.forEach((item) => {
      const cat = item.category || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [displayMenuItems]);

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

  const menuGroupedByCategory = useMemo(() => {
    const grouped: Record<string, typeof displayMenuItems> = {};
    const priority = ["Main Course", "Appetizers", "Pasta", "Desserts", "Beverages"];

    displayMenuItems.forEach((dish) => {
      const cat = dish.category || "Main Course";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(dish);
    });

    const orderedKeys = Object.keys(grouped).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return orderedKeys.map((cat) => ({
      category: cat,
      items: grouped[cat],
    }));
  }, [displayMenuItems]);

  const handleUpdatePackageImage = (
    pkgId: string,
    pkgName: string,
    newUrl: string,
    defaultImg = ""
  ) => {
    const resolvedUrl =
      newUrl.trim() ||
      defaultImg ||
      DEFAULT_CMS_DATA.packages.packageImages[pkgName] ||
      "";

    setPackagesForm((prev) => {
      const updatedImages = { ...(prev.packageImages || {}) };
      if (resolvedUrl) {
        if (pkgId) updatedImages[pkgId] = resolvedUrl;
        updatedImages[pkgName] = resolvedUrl;
      } else {
        delete updatedImages[pkgId];
        delete updatedImages[pkgName];
      }

      const existingIndex = (prev.items || []).findIndex(
        (item) =>
          item.id === pkgId ||
          item.name.toLowerCase() === pkgName.toLowerCase()
      );

      const updatedItems = [...(prev.items || [])];
      if (existingIndex >= 0) {
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          image: resolvedUrl,
        };
      } else if (resolvedUrl) {
        updatedItems.push({
          id: pkgId || `pkg-${Date.now()}`,
          name: pkgName,
          image: resolvedUrl,
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
    newUrl: string,
    defaultImg = ""
  ) => {
    const presetDefault = DEFAULT_CMS_DATA.menu.menuImages[itemName] || defaultImg || "";
    const isClearing = !newUrl.trim() || newUrl === presetDefault;
    const resolvedUrl = newUrl.trim() || presetDefault;

    setMenuForm((prev) => {
      const updatedImages = { ...(prev.menuImages || {}) };
      if (isClearing && !DEFAULT_CMS_DATA.menu.menuImages[itemName]) {
        delete updatedImages[itemId];
        delete updatedImages[itemName];
      } else if (resolvedUrl) {
        if (itemId) updatedImages[itemId] = resolvedUrl;
        updatedImages[itemName] = resolvedUrl;
      }

      const existingIndex = (prev.items || []).findIndex(
        (item) =>
          item.id === itemId || item.name.toLowerCase() === itemName.toLowerCase()
      );

      const updatedItems = [...(prev.items || [])];
      if (existingIndex >= 0) {
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          image: resolvedUrl,
        };
      } else if (resolvedUrl) {
        updatedItems.push({
          id: itemId || `menu-${Date.now()}`,
          name: itemName,
          category: "Main Course",
          image: resolvedUrl,
        });
      }

      return {
        ...prev,
        menuImages: updatedImages,
        items: updatedItems,
      };
    });
  };

  const handleEditorBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
      target.type !== "checkbox" &&
      target.type !== "file" &&
      target.value.trim() === ""
    ) {
      if (activeTab === "home") {
        setHeroForm((prev) => mergeSectionWithDefaults("hero", prev));
        setAnnouncementForm((prev) => mergeSectionWithDefaults("announcement", prev));
        setProcessForm((prev) => mergeSectionWithDefaults("process", prev));
        setTestimonialsForm((prev) => mergeSectionWithDefaults("testimonials", prev));
      } else if (activeTab === "packages") {
        setPackagesForm((prev) => mergeSectionWithDefaults("packages", prev));
      } else if (activeTab === "menu") {
        setMenuForm((prev) => mergeSectionWithDefaults("menu", prev));
      } else if (activeTab === "about") {
        setAboutForm((prev) => mergeSectionWithDefaults("about", prev));
      } else if (activeTab === "faqs") {
        setFaqsForm((prev) => mergeSectionWithDefaults("faqs", prev));
      } else if (activeTab === "contact") {
        setContactForm((prev) => mergeSectionWithDefaults("contact", prev));
      }
    }
  };

  const handleSaveCurrentSection = async () => {
    setIsSaving(true);
    setSaveStatus({ type: "", text: "" });
    const userName = currentUser?.name || "Admin User";

    try {
      if (activeTab === "home") {
        const heroRes = await saveCMSSection("hero", heroForm, userName);
        const annRes = await saveCMSSection("announcement", announcementForm, userName);
        const procRes = await saveCMSSection("process", processForm, userName);
        const testRes = await saveCMSSection("testimonials", testimonialsForm, userName);
        const pkgRes = await saveCMSSection("packages", packagesForm, userName);
        const menuRes = await saveCMSSection("menu", menuForm, userName);
        const faqRes = await saveCMSSection("faqs", faqsForm, userName);
        const contactRes = await saveCMSSection("contact", contactForm, userName);

        setHeroForm(heroRes.data);
        setAnnouncementForm(annRes.data);
        setProcessForm(procRes.data);
        setTestimonialsForm(testRes.data);
        setPackagesForm(pkgRes.data);
        setMenuForm(menuRes.data);
        setFaqsForm(faqRes.data);
        setContactForm(contactRes.data);

        setCmsData((prev) => ({
          ...prev,
          hero: heroRes.data,
          announcement: annRes.data,
          process: procRes.data,
          testimonials: testRes.data,
          packages: pkgRes.data,
          menu: menuRes.data,
          faqs: faqRes.data,
          contact: contactRes.data,
        }));
      } else if (activeTab === "packages") {
        const pkgRes = await saveCMSSection("packages", packagesForm, userName);
        setPackagesForm(pkgRes.data);
        try {
          const updatedDbPkgs = [...dbPackages];
          for (let i = 0; i < updatedDbPkgs.length; i++) {
            const pkg = updatedDbPkgs[i];
            const targetImg =
              pkgRes.data.packageImages?.[pkg.id] ||
              pkgRes.data.packageImages?.[pkg.name] ||
              DEFAULT_CMS_DATA.packages.packageImages[pkg.name] ||
              pkg.image_url ||
              null;
            if (pkg.id && targetImg !== pkg.image_url) {
              await supabase
                .from("packages")
                .update({ image_url: targetImg })
                .eq("id", pkg.id);
              updatedDbPkgs[i] = { ...pkg, image_url: targetImg };
            }
          }
          setDbPackages(updatedDbPkgs);
        } catch (e) {
          console.warn("Could not sync image_url to packages:", e);
        }
        setCmsData((prev) => ({ ...prev, packages: pkgRes.data }));
      } else if (activeTab === "menu") {
        const menuRes = await saveCMSSection("menu", menuForm, userName);
        setMenuForm(menuRes.data);
        try {
          const updatedDbDishes = [...dbMenuItems];
          for (let i = 0; i < updatedDbDishes.length; i++) {
            const dish = updatedDbDishes[i];
            const customImg =
              menuRes.data.menuImages?.[dish.id] ||
              menuRes.data.menuImages?.[dish.name] ||
              DEFAULT_CMS_DATA.menu.menuImages[dish.name] ||
              null;
            if (dish.id && customImg !== dish.image_url) {
              await supabase
                .from("menu_items")
                .update({ image_url: customImg })
                .eq("id", dish.id);
              updatedDbDishes[i] = { ...dish, image_url: customImg };
            }
          }
          setDbMenuItems(updatedDbDishes);
        } catch (e) {
          console.warn("Could not sync image_url to menu_items:", e);
        }
        setCmsData((prev) => ({ ...prev, menu: menuRes.data }));
      } else if (activeTab === "about") {
        const aboutRes = await saveCMSSection("about", aboutForm, userName);
        setAboutForm(aboutRes.data);
        setCmsData((prev) => ({ ...prev, about: aboutRes.data }));
      } else if (activeTab === "faqs") {
        const faqRes = await saveCMSSection("faqs", faqsForm, userName);
        setFaqsForm(faqRes.data);
        setCmsData((prev) => ({ ...prev, faqs: faqRes.data }));
      } else if (activeTab === "contact") {
        const contactRes = await saveCMSSection("contact", contactForm, userName);
        setContactForm(contactRes.data);
        setCmsData((prev) => ({ ...prev, contact: contactRes.data }));
      }

      setSaveStatus({
        type: "success",
        text: `${activeTab.toUpperCase()} section published and live on customer portal!`,
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
    setIsSaving(true);
    const userName = currentUser?.name || "Admin User";
    try {
      if (activeTab === "home") {
        const defHero = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.hero));
        const defAnn = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.announcement));
        const defProc = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.process));
        const defTest = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.testimonials));

        await saveCMSSection("hero", defHero, userName);
        await saveCMSSection("announcement", defAnn, userName);
        await saveCMSSection("process", defProc, userName);
        await saveCMSSection("testimonials", defTest, userName);

        setHeroForm(defHero);
        setAnnouncementForm(defAnn);
        setProcessForm(defProc);
        setTestimonialsForm(defTest);

        setCmsData((prev) => ({
          ...prev,
          hero: defHero,
          announcement: defAnn,
          process: defProc,
          testimonials: defTest,
        }));
      } else if (activeTab === "packages") {
        const defPkgs = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.packages));
        await saveCMSSection("packages", defPkgs, userName);
        setPackagesForm(defPkgs);
        setCmsData((prev) => ({ ...prev, packages: defPkgs }));
      } else if (activeTab === "menu") {
        const defMenu = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.menu));
        await saveCMSSection("menu", defMenu, userName);
        setMenuForm(defMenu);
        setCmsData((prev) => ({ ...prev, menu: defMenu }));
      } else if (activeTab === "about") {
        const defAbout = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.about));
        await saveCMSSection("about", defAbout, userName);
        setAboutForm(defAbout);
        setCmsData((prev) => ({ ...prev, about: defAbout }));
      } else if (activeTab === "faqs") {
        const defFaqs = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.faqs));
        await saveCMSSection("faqs", defFaqs, userName);
        setFaqsForm(defFaqs);
        setCmsData((prev) => ({ ...prev, faqs: defFaqs }));
      } else if (activeTab === "contact") {
        const defContact = JSON.parse(JSON.stringify(DEFAULT_CMS_DATA.contact));
        await saveCMSSection("contact", defContact, userName);
        setContactForm(defContact);
        setCmsData((prev) => ({ ...prev, contact: defContact }));
      }

      setShowConfirmModal(false);
      setSaveStatus({
        type: "success",
        text: `${activeTab.toUpperCase()} reset to default presets and published!`,
      });
      setTimeout(() => setSaveStatus({ type: "", text: "" }), 3000);
    } catch (err: any) {
      setSaveStatus({
        type: "error",
        text: err.message || "Failed to reset section.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Nav tabs strictly matching the Customer Navigation & Exact Page Order
  const tabs: { id: CMSTab; label: string; icon: any; desc: string }[] = [
    {
      id: "home",
      label: "Home Page",
      icon: Home,
      desc: "Hero, featured packages, menu teaser, how it works, reviews, & FAQs",
    },
    {
      id: "menu",
      label: "Menu Page",
      icon: Utensils,
      desc: "Dish presentation photos, culinary categories, and selection header",
    },
    {
      id: "packages",
      label: "Packages Page",
      icon: Package,
      desc: "Package collections, cover photography, pricing & inclusions",
    },
    {
      id: "about",
      label: "About Page",
      icon: FileText,
      desc: "Brand heritage, legacy story, pillars of excellence & CTA",
    },
    {
      id: "faqs",
      label: "FAQs Page",
      icon: HelpCircle,
      desc: "Common inquiries, policies, and catering agreement links",
    },
    {
      id: "contact",
      label: "Contact Page",
      icon: Phone,
      desc: "Office hours, address, phone numbers, map embed, and Why Us",
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

  // Helper to switch both tab and preview
  const navigateToPage = (page: CMSTab) => {
    setActiveTab(page);
    setPreviewPage(page);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Top Header Actions Bar */}
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
          <p className="text-natural-text-light text-[0.75rem] md:text-[0.8rem] font-medium tracking-wide mt-1">
            Organized to match the customer portal pages exactly • Real-time live sync
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
            {showLivePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

      {/* Main CMS Layout - Sidebar + Editor + Live Preview */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Left Navigation: Exact Customer Website Order */}
        <aside className="w-full lg:w-56 xl:w-64 shrink-0">
          <div className="glass-card overflow-hidden sticky top-6">
            <div className="p-4 border-b border-natural-border/50 bg-natural-bg/30">
              <span className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest block">
                Website Pages
              </span>
              <p className="text-[11px] text-natural-text-light mt-0.5">
                Exact customer portal order
              </p>
            </div>
            <nav className="p-2 space-y-1">
              {tabs.map((tab, idx) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => navigateToPage(tab.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all cursor-pointer group",
                      isActive
                        ? "bg-natural-accent text-white shadow-xs font-semibold"
                        : "text-natural-text-main hover:bg-natural-bg/60 border border-transparent"
                    )}
                  >
                    <tab.icon
                      className={cn(
                        "w-4 h-4 shrink-0 mt-0.5",
                        isActive
                          ? "text-white"
                          : "text-natural-accent group-hover:scale-110 transition-transform"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold tracking-wide">
                          {tab.label}
                        </p>
                        <span
                          className={cn(
                            "text-[9px] font-mono px-1.5 py-0.2 rounded",
                            isActive ? "bg-white/20 text-white" : "text-natural-text-light bg-natural-bg"
                          )}
                        >
                          0{idx + 1}
                        </span>
                      </div>
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
                <span>Live Sync Active</span>
              </div>
              <p>
                Modifications reflect live on the customer site upon clicking Publish Changes.
              </p>
            </div>
          </div>
        </aside>

        {/* Content Editor Panel */}
        <div className="flex-1 min-w-0 space-y-6" onBlurCapture={handleEditorBlur}>
          {/* ========================================================================= */}
          {/* PAGE 1: HOME PAGE (ALL HOMEPAGE SECTIONS IN EXACT ORDER) */}
          {/* ========================================================================= */}
          {activeTab === "home" && (
            <div className="space-y-6">
              {/* SECTION 1: TOP ANNOUNCEMENT & HERO BANNER */}
              <div id="sec-hero" className="glass-card p-6 space-y-6 scroll-mt-20">
                <div className="border-b border-natural-border pb-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-serif font-bold text-natural-text-main">
                      Announcement Banner & Hero Banner
                    </h3>
                  </div>
                  <span className="text-[11px] text-natural-text-light">
                    Top of Customer Home Page
                  </span>
                </div>

                {/* Announcement Bar Toggle */}
                <div className="p-4 rounded-xl bg-natural-bg/40 border border-natural-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-amber-500" />
                      <div>
                        <h4 className="text-xs font-bold text-natural-text-main uppercase tracking-wider">
                          Top Announcement Bar
                        </h4>
                        <p className="text-[11px] text-natural-text-light">
                          Holiday promo or alert at the very top of the website
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
                      <div className="w-10 h-5 bg-natural-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {announcementForm.enabled && (
                    <div className="pt-3 border-t border-natural-border/50 grid grid-cols-1 md:grid-cols-3 gap-3">
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
                          className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                          Link Label
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
                          placeholder="e.g. Inquire Now"
                          className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Hero Headlines & Text */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Hero Small Tagline
                    </label>
                    <input
                      type="text"
                      value={heroForm.tagline}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, tagline: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Main Headline
                    </label>
                    <input
                      type="text"
                      value={heroForm.title}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, title: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Headline Italic Highlight
                    </label>
                    <input
                      type="text"
                      value={heroForm.titleItalic}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, titleItalic: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main font-serif italic"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Hero Subtitle Narrative
                  </label>
                  <textarea
                    rows={2}
                    value={heroForm.subtitle}
                    onChange={(e) =>
                      setHeroForm({ ...heroForm, subtitle: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Primary CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={heroForm.primaryBtnText}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, primaryBtnText: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Secondary CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={heroForm.secondaryBtnText}
                      onChange={(e) =>
                        setHeroForm({ ...heroForm, secondaryBtnText: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                </div>

                {/* Hero Backdrop Image */}
                <div className="space-y-2 pt-2 border-t border-natural-border/50">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest block">
                    Hero Backdrop Photo
                  </label>
                  <ImageUploadField
                    label="Hero Backdrop Image"
                    value={heroForm.backgroundImage}
                    defaultValue={DEFAULT_CMS_DATA.hero.backgroundImage}
                    onChange={(newUrl) =>
                      setHeroForm({ ...heroForm, backgroundImage: newUrl })
                    }
                    presets={PRESET_HERO_IMAGES}
                  />
                </div>
              </div>

              {/* SECTION 2: FEATURED PACKAGES SHOWCASE */}
              <div id="sec-packages" className="glass-card p-6 space-y-4 scroll-mt-20">
                <div className="border-b border-natural-border pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-natural-accent/10 text-natural-accent font-bold">
                      SECTION 2 OF 7
                    </span>
                    <h3 className="text-base font-serif font-bold text-natural-text-main">
                      Featured Packages (Homepage Showcase)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToPage("packages")}
                    className="text-xs text-natural-accent hover:underline font-bold inline-flex items-center gap-1"
                  >
                    <span>Manage Package Photos in Packages Tab</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Showcase Subtitle
                    </label>
                    <input
                      type="text"
                      value={packagesForm.headerSubtitle}
                      onChange={(e) =>
                        setPackagesForm({ ...packagesForm, headerSubtitle: e.target.value })
                      }
                      placeholder="Featured Packages"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Showcase Title
                    </label>
                    <input
                      type="text"
                      value={packagesForm.headerTitle}
                      onChange={(e) =>
                        setPackagesForm({ ...packagesForm, headerTitle: e.target.value })
                      }
                      placeholder="Roxan"
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
                        setPackagesForm({ ...packagesForm, headerTitleItalic: e.target.value })
                      }
                      placeholder="Catering Collections"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main font-serif italic"
                    />
                  </div>
                </div>

                <div className="p-3 bg-natural-bg/30 rounded-lg text-xs text-natural-text-light flex items-center justify-between">
                  <span>
                    The 3 featured packages on the Home Page are pulled from your live catalog (Basic, Classic, Premium).
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToPage("packages")}
                    className="text-xs font-bold text-natural-accent hover:underline shrink-0 ml-3"
                  >
                    Edit Package Photos →
                  </button>
                </div>
              </div>

              {/* SECTION 3: CURATED MENU TEASER */}
              <div id="sec-menu" className="glass-card p-6 space-y-4 scroll-mt-20">
                <div className="border-b border-natural-border pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-natural-accent/10 text-natural-accent font-bold">
                      SECTION 3 OF 7
                    </span>
                    <h3 className="text-base font-serif font-bold text-natural-text-main">
                      Curated Gastronomy (Menu Teaser Showcase)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToPage("menu")}
                    className="text-xs text-natural-accent hover:underline font-bold inline-flex items-center gap-1"
                  >
                    <span>Manage Dish Photos in Menu Tab</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Showcase Subtitle
                    </label>
                    <input
                      type="text"
                      value={menuForm.headerSubtitle}
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, headerSubtitle: e.target.value })
                      }
                      placeholder="Gastronomic Craft"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Showcase Title
                    </label>
                    <input
                      type="text"
                      value={menuForm.headerTitle}
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, headerTitle: e.target.value })
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
                        setMenuForm({ ...menuForm, headerTitleItalic: e.target.value })
                      }
                      placeholder="Selection"
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main font-serif italic"
                    />
                  </div>
                </div>

                <div className="p-3 bg-natural-bg/30 rounded-lg text-xs text-natural-text-light flex items-center justify-between">
                  <span>
                    Dishes previewed on the homepage showcase slow-roasted beef, grilled salmon, truffle pasta, and charcuterie.
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToPage("menu")}
                    className="text-xs font-bold text-natural-accent hover:underline shrink-0 ml-3"
                  >
                    Edit All Dish Photos →
                  </button>
                </div>
              </div>

              {/* SECTION 4: HOW IT WORKS (THE 3 PROCESS STEPS) */}
              <div id="sec-process" className="glass-card p-6 space-y-4 scroll-mt-20">
                <div className="border-b border-natural-border pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-natural-accent/10 text-natural-accent font-bold">
                      SECTION 4 OF 7
                    </span>
                    <h3 className="text-base font-serif font-bold text-natural-text-main">
                      How It Works (The 3 Booking Steps)
                    </h3>
                  </div>
                  <span className="text-[11px] text-natural-text-light">
                    Booking Journey Strip
                  </span>
                </div>

                <div className="space-y-1 max-w-sm">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Process Subtitle
                  </label>
                  <input
                    type="text"
                    value={processForm.subtitle}
                    onChange={(e) =>
                      setProcessForm({ ...processForm, subtitle: e.target.value })
                    }
                    placeholder="The Process"
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {(processForm.steps || []).map((step, idx) => (
                    <div
                      key={step.number || idx}
                      className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-2"
                    >
                      <span className="text-xs font-serif font-bold text-amber-500">
                        STEP {step.number}
                      </span>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => {
                          const updated = [...processForm.steps];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setProcessForm({ ...processForm, steps: updated });
                        }}
                        placeholder="Step Title"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs font-bold text-natural-text-main"
                      />
                      <textarea
                        rows={2}
                        value={step.text}
                        onChange={(e) => {
                          const updated = [...processForm.steps];
                          updated[idx] = { ...updated[idx], text: e.target.value };
                          setProcessForm({ ...processForm, steps: updated });
                        }}
                        placeholder="Step description..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs text-natural-text-light"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 5: CUSTOMER REVIEW (TESTIMONIAL) */}
              <div id="sec-testimonials" className="glass-card p-6 space-y-4 scroll-mt-20">
                <div className="border-b border-natural-border pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-natural-accent/10 text-natural-accent font-bold">
                      SECTION 5 OF 7
                    </span>
                    <h3 className="text-base font-serif font-bold text-natural-text-main">
                      Customer Review (Featured Homepage Testimonial)
                    </h3>
                  </div>
                  <span className="text-[11px] text-natural-text-light">
                    Highlighted Quote on Home Page
                  </span>
                </div>

                {(() => {
                  const featured: TestimonialItem =
                    testimonialsForm.items?.find((t) => t.featured) ||
                    testimonialsForm.items?.[0] || {
                      id: "test-featured",
                      author: "Maria Santos",
                      role: "Wedding Client",
                      quote: "",
                      rating: 5,
                      featured: true,
                      active: true,
                    };
                  const featuredIdx = testimonialsForm.items
                    ? testimonialsForm.items.findIndex((t) => t.id === featured.id)
                    : -1;

                  return (
                    <div className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                          Featured Client Quote
                        </label>
                        <textarea
                          rows={3}
                          value={featured.quote}
                          onChange={(e) => {
                            const updated = [...(testimonialsForm.items || [])];
                            if (featuredIdx >= 0) {
                              updated[featuredIdx] = { ...updated[featuredIdx], quote: e.target.value };
                            } else {
                              updated[0] = { ...featured, quote: e.target.value };
                            }
                            setTestimonialsForm({ ...testimonialsForm, items: updated });
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main font-serif italic"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                            Client Name
                          </label>
                          <input
                            type="text"
                            value={featured.author}
                            onChange={(e) => {
                              const updated = [...(testimonialsForm.items || [])];
                              if (featuredIdx >= 0) {
                                updated[featuredIdx] = { ...updated[featuredIdx], author: e.target.value };
                              }
                              setTestimonialsForm({ ...testimonialsForm, items: updated });
                            }}
                            className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-bold text-natural-text-main"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                            Client Role / Event
                          </label>
                          <input
                            type="text"
                            value={featured.role}
                            onChange={(e) => {
                              const updated = [...(testimonialsForm.items || [])];
                              if (featuredIdx >= 0) {
                                updated[featuredIdx] = { ...updated[featuredIdx], role: e.target.value };
                              }
                              setTestimonialsForm({ ...testimonialsForm, items: updated });
                            }}
                            className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SECTION 6: FAQS SHOWCASE */}
              <div id="sec-faqs" className="glass-card p-6 space-y-4 scroll-mt-20">
                <div className="border-b border-natural-border pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-natural-accent/10 text-natural-accent font-bold">
                      SECTION 6 OF 7
                    </span>
                    <h3 className="text-base font-serif font-bold text-natural-text-main">
                      Frequently Asked Questions (Showcase on Home)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToPage("faqs")}
                    className="text-xs text-natural-accent hover:underline font-bold inline-flex items-center gap-1"
                  >
                    <span>Manage All Questions in FAQs Tab</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="space-y-1 max-w-sm">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Section Subtitle
                  </label>
                  <input
                    type="text"
                    value={faqsForm.subtitle}
                    onChange={(e) =>
                      setFaqsForm({ ...faqsForm, subtitle: e.target.value })
                    }
                    placeholder="Service Policies & Common Inquiries"
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>

                <div className="p-3 bg-natural-bg/30 rounded-lg text-xs text-natural-text-light flex items-center justify-between">
                  <span>
                    The top 4 active FAQs from your FAQs tab are previewed automatically on your Home Page.
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToPage("faqs")}
                    className="text-xs font-bold text-natural-accent hover:underline shrink-0 ml-3"
                  >
                    Edit All FAQ Questions →
                  </button>
                </div>
              </div>

              {/* SECTION 7: CONTACT STRIP */}
              <div id="sec-contact" className="glass-card p-6 space-y-4 scroll-mt-20">
                <div className="border-b border-natural-border pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-natural-accent/10 text-natural-accent font-bold">
                      SECTION 7 OF 7
                    </span>
                    <h3 className="text-base font-serif font-bold text-natural-text-main">
                      Contact Banner (Home Page Bottom Strip)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToPage("contact")}
                    className="text-xs text-natural-accent hover:underline font-bold inline-flex items-center gap-1"
                  >
                    <span>Manage Contact Info in Contact Tab</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Location & Service Area Note
                  </label>
                  <textarea
                    rows={2}
                    value={contactForm.locationNote}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, locationNote: e.target.value })
                    }
                    placeholder="Available for weddings, corporate galas, and private celebrations across the region."
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs text-natural-text-main"
                  />
                </div>

                <div className="p-3 bg-natural-bg/30 rounded-lg text-xs text-natural-text-light flex items-center justify-between">
                  <span>
                    Phone: <strong className="text-natural-text-main">{contactForm.phone || "+63 921 469 7142"}</strong> • Email: <strong className="text-natural-text-main">{contactForm.email || "rpcatering@gmail.com"}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToPage("contact")}
                    className="text-xs font-bold text-natural-accent hover:underline shrink-0 ml-3"
                  >
                    Change Contact Info →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PAGE 2: MENU PAGE */}
          {/* ========================================================================= */}
          {activeTab === "menu" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-natural-border pb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-serif font-bold text-natural-text-main">
                    Menu Page & Dish Presentation Photos
                  </h3>
                  <p className="text-xs text-natural-text-light mt-0.5">
                    Assign distinct photography for each dish across your culinary categories
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMenuHeaderControls(!showMenuHeaderControls)}
                  className="text-xs text-natural-accent hover:underline font-bold inline-flex items-center gap-1"
                >
                  <span>{showMenuHeaderControls ? "Hide Text Narrative" : "Edit Page Text"}</span>
                  <ChevronDown size={14} className={showMenuHeaderControls ? "rotate-180" : ""} />
                </button>
              </div>

              {showMenuHeaderControls && (
                <div className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                        Header Subtitle
                      </label>
                      <input
                        type="text"
                        value={menuForm.headerSubtitle}
                        onChange={(e) =>
                          setMenuForm({ ...menuForm, headerSubtitle: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
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
                          setMenuForm({ ...menuForm, headerTitle: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                        Title Italic Accent
                      </label>
                      <input
                        type="text"
                        value={menuForm.headerTitleItalic}
                        onChange={(e) =>
                          setMenuForm({ ...menuForm, headerTitleItalic: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-serif italic"
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
                        setMenuForm({ ...menuForm, description: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Category Pills & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Object.keys(menuCategoryCounts).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedMenuCategory(cat)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer",
                        selectedMenuCategory === cat
                          ? "bg-natural-accent text-white shadow-xs"
                          : "bg-natural-bg/50 text-natural-text-light hover:text-natural-text-main"
                      )}
                    >
                      {cat} ({menuCategoryCounts[cat]})
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-natural-text-light" />
                  <input
                    type="text"
                    placeholder="Search dishes..."
                    value={menuSearchQuery}
                    onChange={(e) => setMenuSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Compact Dishes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredMenuItems.map((dish) => (
                  <div
                    key={dish.name}
                    className="p-3 rounded-xl border border-natural-border bg-natural-bg/20 flex flex-col justify-between hover:border-natural-accent/50 transition-colors"
                  >
                    <div>
                      <div className="aspect-[16/10] rounded-lg overflow-hidden relative bg-black/30 mb-2.5">
                        <img
                          src={dish.image || dish.defaultImage}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded">
                          {dish.category}{dish.sub_category ? ` • ${dish.sub_category}` : ""}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-natural-text-main leading-snug">
                        {dish.name}
                      </h4>
                      {dish.description && (
                        <p className="text-[11px] text-natural-text-light line-clamp-1 mt-0.5">
                          {dish.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingMenuDish(dish)}
                      className="mt-3 w-full py-1.5 bg-natural-accent/10 hover:bg-natural-accent hover:text-white text-natural-accent rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Change Photo</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Reserve Your Experience CTA Banner (Matches Customer Side) */}
              <div className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">
                    PAGE CTA BANNER
                  </span>
                  <h4 className="text-xs font-bold text-natural-text-main uppercase tracking-wider">
                    "Reserve Your Experience" Bottom Banner
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      CTA Subtitle
                    </label>
                    <input
                      type="text"
                      value={menuForm.ctaSubtitle || ""}
                      placeholder="Reserve Your Experience"
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, ctaSubtitle: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      CTA Title
                    </label>
                    <input
                      type="text"
                      value={menuForm.ctaTitle || ""}
                      placeholder="Ready to taste"
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, ctaTitle: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Title Italic Highlight
                    </label>
                    <input
                      type="text"
                      value={menuForm.ctaTitleItalic || ""}
                      placeholder="extraordinary"
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, ctaTitleItalic: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-serif italic"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Button Text
                    </label>
                    <input
                      type="text"
                      value={menuForm.ctaBtnText || ""}
                      placeholder="Inquire Now"
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, ctaBtnText: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PAGE 3: PACKAGES PAGE */}
          {/* ========================================================================= */}
          {activeTab === "packages" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-natural-border pb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-serif font-bold text-natural-text-main">
                    Catering Packages & Cover Photography
                  </h3>
                  <p className="text-xs text-natural-text-light mt-0.5">
                    Assign high-resolution cover photos for each package collection
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPackageHeaderControls(!showPackageHeaderControls)}
                  className="text-xs text-natural-accent hover:underline font-bold inline-flex items-center gap-1"
                >
                  <span>{showPackageHeaderControls ? "Hide Text Narrative" : "Edit Page Text"}</span>
                  <ChevronDown size={14} className={showPackageHeaderControls ? "rotate-180" : ""} />
                </button>
              </div>

              {showPackageHeaderControls && (
                <div className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                        Header Subtitle
                      </label>
                      <input
                        type="text"
                        value={packagesForm.headerSubtitle}
                        onChange={(e) =>
                          setPackagesForm({ ...packagesForm, headerSubtitle: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
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
                          setPackagesForm({ ...packagesForm, headerTitle: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                        Title Italic Accent
                      </label>
                      <input
                        type="text"
                        value={packagesForm.headerTitleItalic}
                        onChange={(e) =>
                          setPackagesForm({ ...packagesForm, headerTitleItalic: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-serif italic"
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
                        setPackagesForm({ ...packagesForm, description: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Packages Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {displayPackages.map((pkg) => (
                  <div
                    key={pkg.name}
                    className="p-4 rounded-xl border border-natural-border bg-natural-bg/20 flex flex-col justify-between hover:border-natural-accent/50 transition-colors"
                  >
                    <div>
                      <div className="aspect-[16/10] rounded-lg overflow-hidden relative bg-black/40 mb-3">
                        <img
                          src={pkg.image || pkg.defaultImage}
                          alt={pkg.name}
                          className="w-full h-full object-cover"
                        />
                        {pkg.tag && (
                          <span className="absolute top-2 left-2 bg-amber-400 text-black text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                            {pkg.tag}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-serif font-bold text-natural-text-main">
                        {pkg.name}
                      </h4>
                      <p className="text-[11px] text-natural-text-light font-medium mt-1">
                        ₱{pkg.price || "—"} • {pkg.pax || "—"} Guests
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingPackagePhoto(pkg)}
                      className="mt-4 w-full py-2 bg-natural-accent/10 hover:bg-natural-accent hover:text-white text-natural-accent rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Change Cover Photo</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PAGE 4: ABOUT PAGE */}
          {/* ========================================================================= */}
          {activeTab === "about" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-natural-border pb-4">
                <h3 className="text-base font-serif font-bold text-natural-text-main">
                  About Page Narrative & Pillars of Excellence
                </h3>
                <p className="text-xs text-natural-text-light mt-0.5">
                  Brand heritage story, high-resolution feature image, and foundation pillars
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Page Subtitle
                  </label>
                  <input
                    type="text"
                    value={aboutForm.headerSubtitle}
                    onChange={(e) =>
                      setAboutForm({ ...aboutForm, headerSubtitle: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Page Title
                  </label>
                  <input
                    type="text"
                    value={aboutForm.headerTitle}
                    onChange={(e) =>
                      setAboutForm({ ...aboutForm, headerTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Title Italic Accent
                  </label>
                  <input
                    type="text"
                    value={aboutForm.headerTitleItalic}
                    onChange={(e) =>
                      setAboutForm({ ...aboutForm, headerTitleItalic: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-serif italic"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-natural-border/50">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Story Headline
                  </label>
                  <input
                    type="text"
                    value={aboutForm.storyHeadline}
                    onChange={(e) =>
                      setAboutForm({ ...aboutForm, storyHeadline: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-serif italic"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Story Paragraph 1
                    </label>
                    <textarea
                      rows={4}
                      value={aboutForm.storyParagraph1}
                      onChange={(e) =>
                        setAboutForm({ ...aboutForm, storyParagraph1: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                      Story Paragraph 2
                    </label>
                    <textarea
                      rows={4}
                      value={aboutForm.storyParagraph2}
                      onChange={(e) =>
                        setAboutForm({ ...aboutForm, storyParagraph2: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest block">
                    Story Feature Photo
                  </label>
                  <ImageUploadField
                    label="About Story Image"
                    value={aboutForm.storyImage}
                    defaultValue={DEFAULT_CMS_DATA.about.storyImage}
                    onChange={(newUrl) =>
                      setAboutForm({ ...aboutForm, storyImage: newUrl })
                    }
                  />
                </div>
              </div>

              {/* Pillars of Excellence */}
              <div className="space-y-3 pt-2 border-t border-natural-border/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-natural-text-main">
                  Pillars of Excellence (The 3 Foundation Cards)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(aboutForm.pillars || []).map((pillar, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-2"
                    >
                      <input
                        type="text"
                        value={pillar.title}
                        onChange={(e) => {
                          const updated = [...aboutForm.pillars];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setAboutForm({ ...aboutForm, pillars: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs font-bold text-natural-text-main"
                      />
                      <textarea
                        rows={3}
                        value={pillar.description}
                        onChange={(e) => {
                          const updated = [...aboutForm.pillars];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setAboutForm({ ...aboutForm, pillars: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs text-natural-text-light"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PAGE 5: FAQS PAGE */}
          {/* ========================================================================= */}
          {activeTab === "faqs" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-natural-border pb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-serif font-bold text-natural-text-main">
                    FAQs Page & Policy Management
                  </h3>
                  <p className="text-xs text-natural-text-light mt-0.5">
                    Questions, answers, and direct clause links to Terms & Conditions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newFaq: FAQItem = {
                      id: `faq-${Date.now()}`,
                      question: "New FAQ Question",
                      answer: "New FAQ answer. Use **bold** for key terms.",
                      category: "Payment & Billing",
                      active: true,
                    };
                    setFaqsForm({
                      ...faqsForm,
                      items: [...(faqsForm.items || []), newFaq],
                    });
                    setEditingFAQ(newFaq);
                  }}
                  className="px-3.5 py-2 bg-natural-accent text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-natural-accent/90"
                >
                  <Plus size={14} />
                  <span>Add Question</span>
                </button>
              </div>

              {/* FAQ Items List */}
              <div className="space-y-3">
                {(faqsForm.items || []).map((faq, idx) => (
                  <div
                    key={faq.id}
                    className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-2 hover:border-natural-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {faq.category || "General"}
                        </span>
                        <h4 className="text-xs font-bold text-natural-text-main">
                          {faq.question}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingFAQ(faq)}
                          className="px-2.5 py-1 text-xs font-bold text-natural-accent hover:bg-natural-accent/10 rounded cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFaqsForm({
                              ...faqsForm,
                              items: faqsForm.items.filter((item) => item.id !== faq.id),
                            });
                          }}
                          className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-natural-text-light leading-relaxed">
                      {faq.answer}
                    </p>
                    {faq.termId && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block pt-1">
                        Linked Term: #{faq.termId} in Terms & Conditions
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PAGE 6: CONTACT PAGE */}
          {/* ========================================================================= */}
          {activeTab === "contact" && (
            <div className="glass-card p-6 space-y-6">
              <div className="border-b border-natural-border pb-4">
                <h3 className="text-base font-serif font-bold text-natural-text-main">
                  Contact Page & Business Details
                </h3>
                <p className="text-xs text-natural-text-light mt-0.5">
                  Office hours, address, phone numbers, map location, and Why Us highlights
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Direct Phone Number
                  </label>
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Inquiry Email Address
                  </label>
                  <input
                    type="text"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Office & Commissary Address
                  </label>
                  <input
                    type="text"
                    value={contactForm.address}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, address: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                    Office Hours
                  </label>
                  <input
                    type="text"
                    value={contactForm.officeHours}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, officeHours: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-natural-border/50">
                <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                  Google Maps Embed URL
                </label>
                <input
                  type="text"
                  value={contactForm.mapEmbedUrl}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, mapEmbedUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-mono"
                />
              </div>

              {/* Why Us Highlights */}
              <div className="space-y-3 pt-2 border-t border-natural-border/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-natural-text-main">
                  Why Us Highlights (3 Pillars on Contact Page)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(contactForm.whyUsHighlights || []).map((highlight, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-natural-border bg-natural-bg/30 space-y-2"
                    >
                      <span className="text-xs font-serif font-bold text-amber-500">
                        HIGHLIGHT {highlight.number}
                      </span>
                      <input
                        type="text"
                        value={highlight.title}
                        onChange={(e) => {
                          const updated = [...contactForm.whyUsHighlights];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setContactForm({ ...contactForm, whyUsHighlights: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs font-bold text-natural-text-main"
                      />
                      <textarea
                        rows={2}
                        value={highlight.description}
                        onChange={(e) => {
                          const updated = [...contactForm.whyUsHighlights];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setContactForm({ ...contactForm, whyUsHighlights: updated });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-black/20 border border-natural-border rounded text-xs text-natural-text-light"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT STICKY LIVE SIMULATION: MATCHES CUSTOMER SIDE EXACTLY */}
        {/* ========================================================================= */}
        {showLivePreview && (
          <aside className="w-full lg:w-[400px] xl:w-[480px] 2xl:w-[540px] shrink-0 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto custom-scrollbar p-4 rounded-2xl bg-[#080808] border border-white/20 shadow-2xl text-white space-y-4 animate-in slide-in-from-right-4 duration-300">
            {/* Simulation Header Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Live Customer Preview
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
                  <span>Fullscreen</span>
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

            {/* Customer Navbar Simulation */}
            <div className="p-2.5 rounded-xl bg-black border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-serif font-bold text-amber-300 uppercase tracking-widest block">
                    ROXAN POLICARPIO
                  </span>
                  <span className="text-[8px] tracking-[0.2em] text-white/40 block">
                    EVENTS & CATERING
                  </span>
                </div>
                <span className="bg-amber-400 text-black text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded">
                  Inquire
                </span>
              </div>
              {/* Customer Page Switcher: Exact Order */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar border-t border-white/10 pt-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => navigateToPage(tab.id)}
                    className={cn(
                      "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer",
                      previewPage === tab.id
                        ? "bg-amber-400 text-black font-extrabold"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {tab.label.replace(" Page", "")}
                  </button>
                ))}
              </div>
            </div>

            {/* PREVIEW: 1. HOME PAGE (FULL CUSTOMER LAYOUT IN EXACT ORDER) */}
            {previewPage === "home" && (
              <div className="space-y-4">
                {/* Announcement Banner */}
                {announcementForm.enabled && (
                  <div className="p-2 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 text-black text-center text-[9px] font-bold uppercase tracking-widest rounded flex items-center justify-center gap-1.5 shadow">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="line-clamp-1">{announcementForm.message}</span>
                    {announcementForm.linkText && (
                      <span className="underline ml-1 font-extrabold shrink-0">
                        {announcementForm.linkText} →
                      </span>
                    )}
                  </div>
                )}

                {/* Hero Section */}
                <div className="relative min-h-[220px] rounded-xl overflow-hidden flex flex-col justify-center items-center text-center p-4 border border-white/15 bg-black">
                  <img
                    src={heroForm.backgroundImage || DEFAULT_CMS_DATA.hero.backgroundImage}
                    alt="Hero"
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="relative z-10 space-y-2 max-w-xs">
                    <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-amber-400 block">
                      {heroForm.tagline}
                    </span>
                    <h3 className="text-xl font-serif text-white leading-tight font-bold">
                      {heroForm.title}{" "}
                      <span className="italic text-amber-300 font-normal block">
                        {heroForm.titleItalic}
                      </span>
                    </h3>
                    <p className="text-[10px] text-white/70 line-clamp-2">
                      {heroForm.subtitle}
                    </p>
                    <div className="flex gap-2 justify-center pt-1">
                      <span className="bg-amber-400 text-black px-3 py-1 font-bold uppercase text-[8px] tracking-widest rounded">
                        {heroForm.primaryBtnText || "Inquire Now"}
                      </span>
                      <span className="border border-white/40 text-white px-3 py-1 font-bold uppercase text-[8px] tracking-widest rounded bg-white/5">
                        {heroForm.secondaryBtnText || "View Menu"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Featured Packages Showcase */}
                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-3">
                  <div className="text-center">
                    <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-amber-400 block">
                      {packagesForm.headerSubtitle || "Featured Packages"}
                    </span>
                    <h4 className="text-sm font-serif font-bold text-white">
                      {packagesForm.headerTitle || "Roxan"}{" "}
                      <span className="italic text-amber-300">
                        {packagesForm.headerTitleItalic || "Catering Collections"}
                      </span>
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {displayPackages.slice(0, 3).map((pkg) => (
                      <div
                        key={pkg.name}
                        className="p-2 rounded bg-[#111] border border-white/10 flex flex-col justify-between"
                      >
                        <div className="aspect-[16/10] rounded overflow-hidden relative mb-1.5 bg-black">
                          <img
                            src={pkg.image || pkg.defaultImage}
                            alt={pkg.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h5 className="text-[10px] font-serif font-bold text-white leading-tight line-clamp-1">
                          {pkg.name}
                        </h5>
                        <p className="text-[8px] text-amber-400 font-bold mt-0.5">
                          ₱{pkg.price || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Curated Menu Teaser */}
                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-3">
                  <div className="text-center">
                    <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-amber-400 block">
                      {menuForm.headerSubtitle || "Gastronomic Craft"}
                    </span>
                    <h4 className="text-sm font-serif font-bold text-white">
                      {menuForm.headerTitle || "Curated"}{" "}
                      <span className="italic text-amber-300">
                        {menuForm.headerTitleItalic || "Selection"}
                      </span>
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {displayMenuItems.slice(0, 4).map((dish) => (
                      <div
                        key={dish.name}
                        className="relative aspect-[16/10] rounded overflow-hidden border border-white/10 bg-black group"
                      >
                        <img
                          src={dish.image || dish.defaultImage}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-2">
                          <span className="text-[7px] uppercase tracking-widest text-amber-400 font-bold">
                            {dish.category}
                          </span>
                          <span className="text-[9px] font-bold text-white line-clamp-1">
                            {dish.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How It Works & Review (Split Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2">
                    <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-amber-400 block">
                      {processForm.subtitle || "The Process"}
                    </span>
                    <div className="space-y-1.5">
                      {(processForm.steps || []).map((step) => (
                        <div key={step.number} className="flex items-start gap-2">
                          <span className="text-xs font-serif italic text-amber-400 font-bold">
                            {step.number}
                          </span>
                          <div>
                            <p className="text-[9px] font-bold text-white uppercase">
                              {step.title}
                            </p>
                            <p className="text-[8px] text-white/50 line-clamp-1">
                              {step.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer Review */}
                  {(() => {
                    const featured =
                      testimonialsForm.items?.find((t) => t.featured) ||
                      testimonialsForm.items?.[0];
                    return (
                      <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2 flex flex-col justify-between">
                        <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-amber-400 block">
                          {testimonialsForm.subtitle || "Customer Review"}
                        </span>
                        <p className="text-[10px] font-serif italic text-white/90 line-clamp-3 leading-relaxed">
                          "{featured?.quote || "Exceptional service and exquisite dining."}"
                        </p>
                        <p className="text-[9px] text-amber-400 font-bold">
                          — {featured?.author || "Maria Santos"}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* FAQ Showcase Preview */}
                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-serif font-bold text-white">
                      Frequently Asked Questions
                    </span>
                    <span className="text-[8px] text-amber-400 font-bold uppercase">
                      View All →
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(faqsForm.items || []).slice(0, 3).map((faq) => (
                      <div
                        key={faq.id}
                        className="p-2 rounded bg-[#111] border border-white/10 text-[9px] space-y-1"
                      >
                        <p className="font-bold text-white">{faq.question}</p>
                        <p className="text-white/60 line-clamp-1">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Contact Strip */}
                <div className="p-3.5 rounded-xl bg-black/80 border border-white/10 text-center space-y-1.5">
                  <span className="text-[8px] uppercase tracking-widest text-amber-400 font-bold">
                    Get In Touch
                  </span>
                  <p className="text-[10px] text-white/70">
                    {contactForm.locationNote}
                  </p>
                  <p className="text-[10px] text-amber-300 font-bold">
                    {contactForm.email || "rpcatering@gmail.com"} • {contactForm.phone || "+63 921 469 7142"}
                  </p>
                </div>
              </div>
            )}

            {/* PREVIEW: 2. MENU PAGE (MATCHES CUSTOMER SIDE EXACTLY) */}
            {previewPage === "menu" && (
              <div className="space-y-5">
                <div className="text-center p-3 border-b border-white/10 space-y-1">
                  <span className="text-amber-400 text-[8px] tracking-[0.3em] font-bold uppercase block italic">
                    {menuForm.headerSubtitle || "Roxan Policarpio Catering"}
                  </span>
                  <h4 className="text-base font-serif font-bold text-white">
                    {menuForm.headerTitle || "Curated"}{" "}
                    <span className="italic text-amber-300">
                      {menuForm.headerTitleItalic || "Selection"}
                    </span>
                  </h4>
                  <p className="text-[9px] text-white/50 tracking-wider uppercase font-medium line-clamp-2">
                    {menuForm.description || "Explore our dynamic culinary offerings"}
                  </p>
                </div>

                {/* Categories & Dish Sliders matching customer side */}
                <div className="space-y-5">
                  {menuGroupedByCategory.map(({ category, items }) => (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between items-end border-b border-white/10 pb-1 px-1">
                        <div>
                          <span className="text-amber-400 text-[7px] tracking-[0.3em] font-bold uppercase block italic">
                            Selection
                          </span>
                          <h5 className="text-xs font-serif font-bold text-white">{category}</h5>
                        </div>
                        <span className="text-[8px] text-white/40 uppercase tracking-widest font-mono">
                          {items.length} items
                        </span>
                      </div>

                      <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
                        {items.map((dish) => (
                          <div
                            key={dish.id || dish.name}
                            className="w-24 sm:w-28 shrink-0 p-1.5 rounded-lg bg-[#111] border border-white/10 flex flex-col justify-between group"
                          >
                            <div className="aspect-[4/5] rounded overflow-hidden relative mb-1.5 bg-black">
                              <img
                                src={dish.image || dish.defaultImage}
                                alt={dish.name}
                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                              />
                            </div>
                            <h6 className="text-[9px] font-bold text-white uppercase tracking-wider leading-tight line-clamp-2 group-hover:text-amber-400">
                              {dish.name}
                            </h6>
                            <p className="text-[7px] text-white/40 line-clamp-1 mt-0.5">
                              {dish.sub_category || dish.description || dish.category}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reserve Your Experience CTA Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-b from-black to-[#111] border border-white/10 text-center space-y-2">
                  <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-amber-400 block italic">
                    {menuForm.ctaSubtitle || "Reserve Your Experience"}
                  </span>
                  <h5 className="text-xs sm:text-sm font-serif font-bold text-white leading-tight">
                    {menuForm.ctaTitle || "Ready to taste"}{" "}
                    <span className="italic text-amber-300">
                      {menuForm.ctaTitleItalic || "extraordinary"}
                    </span>{" "}
                    service?
                  </h5>
                  <div className="pt-1">
                    <span className="inline-block bg-amber-400 text-black px-4 py-1 font-bold uppercase text-[8px] tracking-widest rounded shadow">
                      {menuForm.ctaBtnText || "Inquire Now"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW: 3. PACKAGES PAGE */}
            {previewPage === "packages" && (
              <div className="space-y-4">
                <div className="text-center p-3 border-b border-white/10">
                  <span className="text-amber-400 text-[8px] tracking-[0.3em] font-bold uppercase block mb-1">
                    {packagesForm.headerSubtitle}
                  </span>
                  <h4 className="text-sm font-serif font-bold text-white">
                    {packagesForm.headerTitle} <span className="italic text-amber-300">{packagesForm.headerTitleItalic}</span>
                  </h4>
                </div>
                <div className="space-y-2">
                  {displayPackages.map((pkg) => (
                    <div key={pkg.name} className="p-2.5 rounded-lg bg-[#111] border border-white/10 flex gap-3 items-center">
                      <div className="w-20 h-14 rounded overflow-hidden shrink-0">
                        <img src={pkg.image || pkg.defaultImage} alt={pkg.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-[10px] font-serif font-bold text-white line-clamp-1">{pkg.name}</h5>
                        <p className="text-[9px] text-amber-400 font-bold">₱{pkg.price || "—"} • {pkg.pax || "—"} Guests</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PREVIEW: 4. ABOUT PAGE */}
            {previewPage === "about" && (
              <div className="space-y-4">
                <div className="text-center p-3 border-b border-white/10">
                  <span className="text-amber-400 text-[8px] tracking-[0.3em] font-bold uppercase block mb-1">
                    {aboutForm.headerSubtitle}
                  </span>
                  <h4 className="text-sm font-serif font-bold text-white">
                    {aboutForm.headerTitle} <span className="italic text-amber-300">{aboutForm.headerTitleItalic}</span>
                  </h4>
                </div>
                <div className="aspect-[16/9] rounded-lg overflow-hidden border border-white/10">
                  <img src={aboutForm.storyImage} alt="Story" className="w-full h-full object-cover" />
                </div>
                <p className="text-[10px] font-serif italic text-amber-300">{aboutForm.storyHeadline}</p>
                <p className="text-[9px] text-white/70 line-clamp-3">{aboutForm.storyParagraph1}</p>
              </div>
            )}

            {/* PREVIEW: 5. FAQS PAGE */}
            {previewPage === "faqs" && (
              <div className="space-y-3">
                <div className="text-center p-3 border-b border-white/10">
                  <span className="text-amber-400 text-[8px] tracking-[0.3em] font-bold uppercase block mb-1">
                    {faqsForm.subtitle}
                  </span>
                  <h4 className="text-sm font-serif font-bold text-white">Frequently Asked Questions</h4>
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/10 text-[9px] text-white/60">
                  All policies derived from official Catering Service Agreement.
                </div>
                <div className="space-y-1.5">
                  {(faqsForm.items || []).map((faq) => (
                    <div key={faq.id} className="p-2 rounded-lg bg-[#111] border border-white/10 text-[9px] space-y-1">
                      <p className="font-bold text-white">{faq.question}</p>
                      <p className="text-white/60 line-clamp-2">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PREVIEW: 6. CONTACT PAGE */}
            {previewPage === "contact" && (
              <div className="space-y-3">
                <div className="text-center p-3 border-b border-white/10">
                  <span className="text-amber-400 text-[8px] tracking-[0.3em] font-bold uppercase block mb-1">
                    Connect With Us
                  </span>
                  <h4 className="text-sm font-serif font-bold text-white">Get In Touch</h4>
                </div>
                <div className="p-3 rounded-xl bg-[#111] border border-white/10 text-[9px] space-y-1.5">
                  <p><strong className="text-white">Phone:</strong> {contactForm.phone}</p>
                  <p><strong className="text-white">Email:</strong> {contactForm.email}</p>
                  <p><strong className="text-white">Address:</strong> {contactForm.address}</p>
                  <p><strong className="text-white">Hours:</strong> {contactForm.officeHours}</p>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CHANGE DISH PHOTO */}
      {/* ========================================================================= */}
      {editingMenuDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card max-w-xl w-full p-6 space-y-5 rounded-2xl border border-natural-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-natural-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-natural-text-main">
                  Change Photo for "{editingMenuDish.name}"
                </h4>
                <p className="text-xs text-natural-text-light">
                  Category: {editingMenuDish.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMenuDish(null)}
                className="p-1 text-natural-text-light hover:text-natural-text-main cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <ImageUploadField
              label={`Presentation Photo for "${editingMenuDish.name}"`}
              value={editingMenuDish.image}
              defaultValue={editingMenuDish.defaultImage}
              onChange={(newUrl) => {
                handleUpdateMenuImage(
                  editingMenuDish.id,
                  editingMenuDish.name,
                  newUrl,
                  editingMenuDish.defaultImage
                );
                setEditingMenuDish({ ...editingMenuDish, image: newUrl });
              }}
              presets={PRESET_MENU_IMAGES}
            />

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingMenuDish(null)}
                className="px-5 py-2 bg-natural-accent text-white font-bold rounded-lg text-xs cursor-pointer hover:bg-natural-accent/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHANGE PACKAGE PHOTO */}
      {/* ========================================================================= */}
      {editingPackagePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card max-w-xl w-full p-6 space-y-5 rounded-2xl border border-natural-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-natural-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-natural-text-main">
                  Change Cover Photo for "{editingPackagePhoto.name}"
                </h4>
                <p className="text-xs text-natural-text-light">
                  Price: ₱{editingPackagePhoto.price || "—"} • Guests: {editingPackagePhoto.pax || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPackagePhoto(null)}
                className="p-1 text-natural-text-light hover:text-natural-text-main cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <ImageUploadField
              label={`Cover Photo for "${editingPackagePhoto.name}"`}
              value={editingPackagePhoto.image}
              defaultValue={editingPackagePhoto.defaultImage}
              onChange={(newUrl) => {
                handleUpdatePackageImage(
                  editingPackagePhoto.id,
                  editingPackagePhoto.name,
                  newUrl,
                  editingPackagePhoto.defaultImage
                );
                setEditingPackagePhoto({ ...editingPackagePhoto, image: newUrl });
              }}
              presets={PRESET_PACKAGE_IMAGES}
            />

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingPackagePhoto(null)}
                className="px-5 py-2 bg-natural-accent text-white font-bold rounded-lg text-xs cursor-pointer hover:bg-natural-accent/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT FAQ ITEM */}
      {/* ========================================================================= */}
      {editingFAQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card max-w-lg w-full p-6 space-y-4 rounded-2xl border border-natural-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-natural-border pb-3">
              <h4 className="text-sm font-bold text-natural-text-main">
                Edit FAQ Question & Answer
              </h4>
              <button
                type="button"
                onClick={() => setEditingFAQ(null)}
                className="p-1 text-natural-text-light hover:text-natural-text-main cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                  Question
                </label>
                <input
                  type="text"
                  value={editingFAQ.question}
                  onChange={(e) =>
                    setEditingFAQ({ ...editingFAQ, question: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                  Category
                </label>
                <input
                  type="text"
                  value={editingFAQ.category || ""}
                  onChange={(e) =>
                    setEditingFAQ({ ...editingFAQ, category: e.target.value })
                  }
                  placeholder="e.g. Payment & Billing, Corkage & Services"
                  className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest flex items-center justify-between">
                  <span>Answer</span>
                  <span className="text-[9px] text-amber-500 font-normal">Use **bold** for key words</span>
                </label>
                <textarea
                  rows={4}
                  value={editingFAQ.answer}
                  onChange={(e) =>
                    setEditingFAQ({ ...editingFAQ, answer: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest">
                  Linked Term ID in Catering Agreement (Optional)
                </label>
                <input
                  type="text"
                  value={editingFAQ.termId || ""}
                  onChange={(e) =>
                    setEditingFAQ({ ...editingFAQ, termId: e.target.value })
                  }
                  placeholder="e.g. cancellation, down-payment, corkage-fees"
                  className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-natural-border rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingFAQ(null)}
                className="px-4 py-2 border border-natural-border text-natural-text-main rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setFaqsForm({
                    ...faqsForm,
                    items: (faqsForm.items || []).map((item) =>
                      item.id === editingFAQ.id ? editingFAQ : item
                    ),
                  });
                  setEditingFAQ(null);
                }}
                className="px-5 py-2 bg-natural-accent text-white font-bold rounded-lg text-xs"
              >
                Save FAQ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRM PUBLISH / RESET */}
      {/* ========================================================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card max-w-md w-full p-6 space-y-4 rounded-2xl border border-natural-border shadow-2xl text-center">
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-500">
              {confirmActionType === "save" ? <Save size={24} /> : <RotateCcw size={24} />}
            </div>
            <h4 className="text-base font-bold text-natural-text-main">
              {confirmActionType === "save"
                ? `Publish changes for ${activeTab.toUpperCase()} Page?`
                : `Reset ${activeTab.toUpperCase()} Page to Defaults?`}
            </h4>
            <p className="text-xs text-natural-text-light leading-relaxed">
              {confirmActionType === "save"
                ? `Modifications to the ${activeTab.toUpperCase()} page will immediately update the live customer website.`
                : `This will reset all fields in the ${activeTab.toUpperCase()} page back to original presets.`}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-natural-border text-natural-text-main rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={
                  confirmActionType === "save"
                    ? handleSaveCurrentSection
                    : handleResetCurrentSection
                }
                className="px-5 py-2 bg-natural-accent text-white font-bold rounded-lg text-xs hover:bg-natural-accent/90"
              >
                {isSaving ? "Processing..." : confirmActionType === "save" ? "Yes, Publish" : "Yes, Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: FULLSCREEN LIVE PREVIEW */}
      {/* ========================================================================= */}
      {showFullPreviewModal && (
        <div className="fixed inset-0 z-50 bg-[#060606] flex flex-col animate-in fade-in duration-200">
          {/* Top Browser Toolbar */}
          <div className="bg-[#111] border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between text-white shrink-0 gap-3">
            {/* Left: Window Dots & URL Simulator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-black/50 border border-white/10 px-3 py-1 rounded-md text-[11px] text-white/60 font-mono">
                <span className="text-green-400 font-bold">🔒</span>
                <span>https://roxanpolicarpio.com/{previewPage === "home" ? "" : previewPage}</span>
              </div>
            </div>

            {/* Center: Customer Page Switcher */}
            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewPage(tab.id)}
                  className={cn(
                    "px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer",
                    previewPage === tab.id
                      ? "bg-amber-400 text-black font-extrabold"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  {tab.label.replace(" Page", "")}
                </button>
              ))}
            </div>

            {/* Right: Close Fullscreen */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowFullPreviewModal(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <X size={16} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Full Desktop Web Viewport */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-rich-black text-white w-full">
            {/* Customer Mini Navbar */}
            <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10 px-6 sm:px-12 py-4 flex items-center justify-between">
              <div>
                <span className="text-xs sm:text-sm font-serif font-bold text-amber-300 uppercase tracking-widest block">
                  ROXAN POLICARPIO
                </span>
                <span className="text-[9px] tracking-[0.3em] text-white/50 block">
                  EVENTS & CATERING
                </span>
              </div>
              <div className="hidden md:flex items-center gap-6 text-xs uppercase tracking-widest font-bold">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewPage(tab.id)}
                    className={cn(
                      "transition-colors hover:text-amber-400 cursor-pointer",
                      previewPage === tab.id ? "text-amber-400 underline underline-offset-4" : "text-white/70"
                    )}
                  >
                    {tab.label.replace(" Page", "")}
                  </button>
                ))}
              </div>
              <span className="bg-amber-400 text-black text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-md">
                Inquire Now
              </span>
            </div>

            {/* ================================================================= */}
            {/* FULLSCREEN PREVIEW: 1. HOME PAGE (FULL CUSTOMER LAYOUT TOP TO BOTTOM) */}
            {/* ================================================================= */}
            {previewPage === "home" && (
              <div className="space-y-0">
                {/* Announcement Banner */}
                {announcementForm.enabled && (
                  <div className="p-3 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 text-black text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>{announcementForm.message}</span>
                    {announcementForm.linkText && (
                      <span className="underline ml-1 font-extrabold cursor-pointer">
                        {announcementForm.linkText} →
                      </span>
                    )}
                  </div>
                )}

                {/* Hero Section */}
                <section className="relative min-h-[70vh] flex items-center justify-center text-center px-6 py-24 overflow-hidden bg-black">
                  <img
                    src={heroForm.backgroundImage || DEFAULT_CMS_DATA.hero.backgroundImage}
                    alt="Hero"
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="relative z-10 space-y-6 max-w-3xl mx-auto">
                    <span className="text-xs sm:text-sm uppercase tracking-[0.5em] font-bold text-amber-400 block">
                      {heroForm.tagline}
                    </span>
                    <h1 className="text-4xl sm:text-6xl md:text-7xl font-serif text-white font-bold leading-tight">
                      {heroForm.title}{" "}
                      <span className="italic text-amber-300 font-normal block sm:inline">
                        {heroForm.titleItalic}
                      </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-xl mx-auto font-medium">
                      {heroForm.subtitle}
                    </p>
                    <div className="flex gap-4 justify-center pt-2 flex-wrap">
                      <span className="bg-amber-400 text-black px-8 py-3.5 font-bold uppercase text-xs tracking-widest rounded shadow-lg">
                        {heroForm.primaryBtnText || "Inquire Now"}
                      </span>
                      <span className="border border-white text-white px-8 py-3.5 font-bold uppercase text-xs tracking-widest rounded bg-white/5">
                        {heroForm.secondaryBtnText || "View Menu"}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Featured Packages Section */}
                <section className="py-24 px-8 sm:px-12 bg-black border-y border-white/10">
                  <div className="max-w-7xl mx-auto space-y-12">
                    <div className="text-left space-y-2">
                      <span className="text-[10px] tracking-[0.4em] font-bold uppercase text-amber-400 block italic">
                        {packagesForm.headerSubtitle || "Featured Packages"}
                      </span>
                      <h2 className="text-3xl sm:text-5xl font-serif text-white font-bold">
                        {packagesForm.headerTitle || "Roxan"}{" "}
                        <span className="italic text-amber-300 font-normal">
                          {packagesForm.headerTitleItalic || "Catering Collections"}
                        </span>
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {displayPackages.slice(0, 3).map((pkg) => (
                        <div
                          key={pkg.name}
                          className="p-6 rounded-2xl bg-[#0f0f0f] border border-white/10 space-y-4 hover:border-amber-400/40 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="aspect-[16/10] rounded-xl overflow-hidden relative mb-4 bg-black">
                              <img
                                src={pkg.image || pkg.defaultImage}
                                alt={pkg.name}
                                className="w-full h-full object-cover"
                              />
                              {pkg.tag && (
                                <span className="absolute top-3 left-3 bg-amber-400 text-black text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded">
                                  {pkg.tag}
                                </span>
                              )}
                            </div>
                            <h3 className="text-xl font-serif font-bold text-white mb-2">
                              {pkg.name}
                            </h3>
                            <p className="text-xs text-amber-400 font-bold mb-3">
                              ₱{pkg.price || "—"} • {pkg.pax || "—"} Guests
                            </p>
                            {pkg.inclusions && pkg.inclusions.length > 0 && (
                              <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                                {pkg.inclusions.join(" • ")}
                              </p>
                            )}
                          </div>
                          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-amber-400 font-bold uppercase tracking-widest">
                            <span>Explore Package</span>
                            <ArrowUpRight size={14} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Curated Gastronomy Menu Teaser */}
                <section className="py-24 px-8 sm:px-12 bg-[#070707] border-b border-white/10">
                  <div className="max-w-7xl mx-auto space-y-12">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-white/10 pb-6">
                      <div>
                        <span className="text-[10px] tracking-[0.4em] font-bold uppercase text-amber-400 block italic">
                          {menuForm.headerSubtitle || "Gastronomic Craft"}
                        </span>
                        <h2 className="text-3xl sm:text-5xl font-serif text-white font-bold">
                          {menuForm.headerTitle || "Curated"}{" "}
                          <span className="italic text-amber-300 font-normal">
                            {menuForm.headerTitleItalic || "Selection"}
                          </span>
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewPage("menu")}
                        className="text-xs uppercase tracking-widest text-amber-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Explore Complete Menu</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                      {displayMenuItems.slice(0, 4).map((dish) => (
                        <div
                          key={dish.name}
                          className="group relative aspect-[4/5] rounded-xl overflow-hidden border border-white/10 bg-black"
                        >
                          <img
                            src={dish.image || dish.defaultImage}
                            alt={dish.name}
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-5">
                            <span className="text-[9px] uppercase tracking-widest text-amber-400 font-bold block mb-1">
                              {dish.category}
                            </span>
                            <h4 className="text-base font-serif font-bold text-white leading-snug">
                              {dish.name}
                            </h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* How It Works & Customer Review Split Section */}
                <section className="bg-black border-b border-white/10">
                  <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3">
                    {/* The Process */}
                    <div className="p-10 md:p-16 border-r border-white/10 bg-[#0c0c0c] space-y-8">
                      <span className="text-[10px] tracking-[0.4em] font-bold uppercase text-amber-400 block italic">
                        {processForm.subtitle || "The Process"}
                      </span>
                      <div className="space-y-8">
                        {(processForm.steps || []).map((step) => (
                          <div key={step.number} className="flex gap-4 items-start">
                            <span className="text-3xl font-serif italic text-amber-400/80 font-bold shrink-0">
                              {step.number}
                            </span>
                            <div>
                              <p className="font-bold text-xs uppercase tracking-widest text-white mb-1">
                                {step.title}
                              </p>
                              <p className="text-xs text-white/50 leading-relaxed font-medium">
                                {step.text}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Customer Review Quote */}
                    <div className="p-10 md:p-16 flex flex-col justify-center bg-black col-span-1 md:col-span-2 space-y-6">
                      <span className="text-[10px] tracking-[0.4em] font-bold uppercase text-amber-400 block italic">
                        {testimonialsForm.subtitle || "Customer Review"}
                      </span>
                      {(() => {
                        const featured =
                          testimonialsForm.items?.find((t) => t.featured) ||
                          testimonialsForm.items?.[0] || {
                            author: "Maria Santos",
                            role: "Wedding Client",
                            quote: "Roxan Policarpio Events & Catering made our dream wedding a reality. The food was absolutely exquisite, the presentation was flawless, and it didn't break the bank. Truly exceptional service!",
                          };
                        return (
                          <div className="space-y-6 max-w-xl">
                            <Quote className="text-amber-400/20" size={54} />
                            <p className="text-xl sm:text-2xl font-serif italic text-white/90 leading-relaxed font-light">
                              "{featured.quote}"
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-[1px] bg-amber-400" />
                              <span className="text-xs uppercase tracking-[0.3em] font-bold text-amber-400">
                                {featured.author}
                              </span>
                              {featured.role && (
                                <span className="text-xs text-white/40 tracking-wider">
                                  • {featured.role}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </section>

                {/* Frequently Asked Questions Showcase */}
                <section className="py-24 px-8 sm:px-12 bg-[#070707] border-b border-white/10">
                  <div className="max-w-5xl mx-auto space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-white/10 pb-6">
                      <div>
                        <span className="text-[10px] tracking-[0.4em] font-bold uppercase text-amber-400 block italic">
                          {faqsForm.subtitle || "Service Policies & Common Inquiries"}
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-serif text-white font-bold">
                          Frequently Asked <span className="italic text-amber-300 font-normal">Questions</span>
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewPage("faqs")}
                        className="text-xs uppercase tracking-widest text-amber-400 hover:text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>View All FAQs</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(faqsForm.items || []).slice(0, 4).map((faq) => (
                        <div
                          key={faq.id}
                          className="p-5 rounded-xl border border-white/10 bg-[#0d0d0d] space-y-2 hover:border-amber-400/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                              {faq.category || "General"}
                            </span>
                            <h4 className="text-sm font-serif font-bold text-white">
                              {faq.question}
                            </h4>
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed font-sans">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Bottom Contact Section */}
                <section className="py-24 px-8 sm:px-12 bg-black border-b border-white/10">
                  <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="max-w-md space-y-3 text-center md:text-left">
                      <span className="text-[10px] tracking-[0.4em] font-bold uppercase text-amber-400 block italic">
                        Get In Touch
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-serif text-white font-bold">
                        Let's craft your <span className="italic text-amber-300">perfect</span> event together.
                      </h2>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {contactForm.locationNote}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 items-center md:items-end">
                      <a
                        href={`mailto:${contactForm.email || "rpcatering@gmail.com"}`}
                        className="text-2xl sm:text-3xl font-serif text-amber-400 hover:text-white italic transition-colors"
                      >
                        {contactForm.email || "rpcatering@gmail.com"}
                      </a>
                      <p className="text-xs text-white/40 uppercase tracking-[0.3em] font-bold">
                        {contactForm.phone || "+63 921 469 7142"}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Customer Footer */}
                <footer className="py-12 px-8 sm:px-12 bg-[#050505] text-xs text-white/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p>© {new Date().getFullYear()} Roxan Policarpio Events & Catering. All Rights Reserved.</p>
                  <div className="flex items-center gap-6 uppercase tracking-wider font-bold">
                    <span>Facebook</span>
                    <span>Instagram</span>
                    <span onClick={() => setPreviewPage("faqs")} className="cursor-pointer hover:text-amber-400">FAQs</span>
                  </div>
                </footer>
              </div>
            )}

            {/* ================================================================= */}
            {/* FULLSCREEN PREVIEW: 2. MENU PAGE */}
            {/* ================================================================= */}
            {previewPage === "menu" && (
              <div className="space-y-12 py-12 px-8 sm:px-12 max-w-7xl mx-auto">
                <div className="text-center space-y-3 border-b border-white/10 pb-8">
                  <span className="text-[11px] tracking-[0.5em] font-bold uppercase text-amber-400 block italic">
                    {menuForm.headerSubtitle || "Roxan Policarpio Catering"}
                  </span>
                  <h2 className="text-4xl md:text-7xl font-serif text-white font-bold">
                    {menuForm.headerTitle || "Curated"}{" "}
                    <span className="italic text-amber-300">
                      {menuForm.headerTitleItalic || "Selection"}
                    </span>
                  </h2>
                  <p className="text-xs text-white/50 tracking-widest uppercase font-bold max-w-2xl mx-auto">
                    {menuForm.description || "Explore our dynamic culinary offerings crafted with passion, artful presentation, and the finest ingredients."}
                  </p>
                </div>

                {/* Categories Sliders matching customer side */}
                <div className="space-y-16">
                  {menuGroupedByCategory.map(({ category, items }) => (
                    <div key={category} className="space-y-6">
                      <div className="flex justify-between items-end border-b border-white/10 pb-3">
                        <div>
                          <span className="text-amber-400 text-[10px] tracking-[0.4em] font-bold uppercase block italic">
                            Selection
                          </span>
                          <h3 className="text-3xl font-serif text-white font-bold">{category}</h3>
                        </div>
                        <span className="text-xs text-white/40 uppercase tracking-widest font-mono">
                          {items.length} dishes available
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {items.map((dish) => (
                          <div
                            key={dish.id || dish.name}
                            className="p-3 rounded-2xl bg-[#0e0e0e] border border-white/10 flex flex-col justify-between group hover:border-amber-400/40 transition-colors"
                          >
                            <div className="aspect-[4/5] rounded-xl overflow-hidden relative mb-3 bg-black">
                              <img
                                src={dish.image || dish.defaultImage}
                                alt={dish.name}
                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                              />
                            </div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-snug line-clamp-2 group-hover:text-amber-400 transition-colors">
                              {dish.name}
                            </h4>
                            <p className="text-[10px] text-white/40 line-clamp-1 mt-1 font-medium">
                              {dish.sub_category || dish.description || dish.category}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reserve Experience CTA Banner */}
                <div className="py-20 px-8 rounded-3xl bg-gradient-to-b from-black to-[#0e0e0e] border border-white/10 text-center space-y-4 max-w-3xl mx-auto">
                  <span className="text-xs uppercase tracking-[0.4em] font-bold text-amber-400 block italic">
                    {menuForm.ctaSubtitle || "Reserve Your Experience"}
                  </span>
                  <h3 className="text-3xl md:text-5xl font-serif text-white font-bold leading-tight">
                    {menuForm.ctaTitle || "Ready to taste"}{" "}
                    <span className="italic text-amber-300">
                      {menuForm.ctaTitleItalic || "extraordinary"}
                    </span>{" "}
                    service?
                  </h3>
                  <div className="pt-4">
                    <span className="inline-block bg-amber-400 text-black px-10 py-3.5 font-bold uppercase text-xs tracking-widest rounded-lg shadow-xl">
                      {menuForm.ctaBtnText || "Inquire Now"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* FULLSCREEN PREVIEW: 3. PACKAGES PAGE */}
            {/* ================================================================= */}
            {previewPage === "packages" && (
              <div className="space-y-12 py-12 px-8 sm:px-12 max-w-7xl mx-auto">
                <div className="text-center space-y-3 border-b border-white/10 pb-8">
                  <span className="text-[11px] tracking-[0.5em] font-bold uppercase text-amber-400 block italic">
                    {packagesForm.headerSubtitle || "Exclusive Collections"}
                  </span>
                  <h2 className="text-4xl md:text-7xl font-serif text-white font-bold">
                    {packagesForm.headerTitle || "Catering"}{" "}
                    <span className="italic text-amber-300">
                      {packagesForm.headerTitleItalic || "Packages"}
                    </span>
                  </h2>
                  <p className="text-xs text-white/50 tracking-widest uppercase font-bold max-w-2xl mx-auto">
                    {packagesForm.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {displayPackages.map((pkg) => (
                    <div
                      key={pkg.name}
                      className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-4 hover:border-amber-400/40 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="aspect-[16/10] rounded-xl overflow-hidden relative mb-4 bg-black">
                          <img
                            src={pkg.image || pkg.defaultImage}
                            alt={pkg.name}
                            className="w-full h-full object-cover"
                          />
                          {pkg.tag && (
                            <span className="absolute top-3 left-3 bg-amber-400 text-black text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded">
                              {pkg.tag}
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-2">
                          {pkg.name}
                        </h3>
                        <p className="text-sm text-amber-400 font-bold mb-3">
                          ₱{pkg.price || "—"} • {pkg.pax || "—"} Guests
                        </p>
                        {pkg.inclusions && pkg.inclusions.length > 0 && (
                          <p className="text-xs text-white/50 line-clamp-3 leading-relaxed">
                            {pkg.inclusions.join(" • ")}
                          </p>
                        )}
                      </div>
                      <div className="pt-4 border-t border-white/10">
                        <span className="block text-center bg-white/10 hover:bg-amber-400 hover:text-black text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-colors cursor-pointer">
                          Select Package
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* FULLSCREEN PREVIEW: 4. ABOUT PAGE */}
            {/* ================================================================= */}
            {previewPage === "about" && (
              <div className="space-y-12 py-12 px-8 sm:px-12 max-w-5xl mx-auto">
                <div className="text-center space-y-3 border-b border-white/10 pb-8">
                  <span className="text-[11px] tracking-[0.5em] font-bold uppercase text-amber-400 block italic">
                    {aboutForm.headerSubtitle || "Behind the Craft"}
                  </span>
                  <h2 className="text-4xl md:text-7xl font-serif text-white font-bold">
                    {aboutForm.headerTitle || "Our"}{" "}
                    <span className="italic text-amber-300">
                      {aboutForm.headerTitleItalic || "Story"}
                    </span>
                  </h2>
                </div>

                <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-black">
                  <img src={aboutForm.storyImage} alt="Story" className="w-full h-full object-cover" />
                </div>

                <div className="space-y-6 text-center max-w-3xl mx-auto">
                  <h3 className="text-2xl sm:text-3xl font-serif italic text-amber-300 leading-relaxed font-light">
                    "{aboutForm.storyHeadline}"
                  </h3>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {aboutForm.storyParagraph1}
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {aboutForm.storyParagraph2}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                  {(aboutForm.pillars || []).map((pillar, idx) => (
                    <div key={idx} className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-2">
                      <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                        PILLAR 0{idx + 1}
                      </span>
                      <h4 className="text-lg font-serif font-bold text-white">{pillar.title}</h4>
                      <p className="text-xs text-white/60 leading-relaxed">{pillar.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* FULLSCREEN PREVIEW: 5. FAQS PAGE */}
            {/* ================================================================= */}
            {previewPage === "faqs" && (
              <div className="space-y-8 py-12 px-8 sm:px-12 max-w-4xl mx-auto">
                <div className="text-center space-y-3 border-b border-white/10 pb-8">
                  <span className="text-[11px] tracking-[0.5em] font-bold uppercase text-amber-400 block italic">
                    {faqsForm.subtitle || "Policies & Common Inquiries"}
                  </span>
                  <h2 className="text-4xl md:text-6xl font-serif text-white font-bold">
                    Frequently Asked <span className="italic text-amber-300">Questions</span>
                  </h2>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 flex items-center justify-between">
                  <span>All policies are derived from our official Catering Service Agreement.</span>
                  <span className="text-amber-400 font-bold">Terms & Conditions ↗</span>
                </div>

                <div className="space-y-4">
                  {(faqsForm.items || []).map((faq) => (
                    <div
                      key={faq.id}
                      className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/20 uppercase">
                          {faq.category || "General"}
                        </span>
                        <h4 className="text-base font-serif font-bold text-white">
                          {faq.question}
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                        {faq.answer}
                      </p>
                      {faq.termId && (
                        <p className="text-xs text-amber-400 font-semibold pt-1">
                          View clause in Terms & Conditions (#{faq.termId}) ↗
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* FULLSCREEN PREVIEW: 6. CONTACT PAGE */}
            {/* ================================================================= */}
            {previewPage === "contact" && (
              <div className="space-y-12 py-12 px-8 sm:px-12 max-w-5xl mx-auto">
                <div className="text-center space-y-3 border-b border-white/10 pb-8">
                  <span className="text-[11px] tracking-[0.5em] font-bold uppercase text-amber-400 block italic">
                    Connect With Us
                  </span>
                  <h2 className="text-4xl md:text-6xl font-serif text-white font-bold">
                    Get In <span className="italic text-amber-300">Touch</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-2">
                    <span className="text-xs font-bold uppercase text-amber-400">Phone</span>
                    <p className="text-sm text-white font-bold">{contactForm.phone}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-2">
                    <span className="text-xs font-bold uppercase text-amber-400">Email</span>
                    <p className="text-sm text-white font-bold">{contactForm.email}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-2">
                    <span className="text-xs font-bold uppercase text-amber-400">Address</span>
                    <p className="text-xs text-white/80">{contactForm.address}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-2">
                    <span className="text-xs font-bold uppercase text-amber-400">Hours</span>
                    <p className="text-xs text-white/80">{contactForm.officeHours}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                  {(contactForm.whyUsHighlights || []).map((h, idx) => (
                    <div key={idx} className="p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 space-y-2">
                      <span className="text-xs font-serif italic text-amber-400 font-bold">
                        {h.number}
                      </span>
                      <h4 className="text-base font-bold text-white">{h.title}</h4>
                      <p className="text-xs text-white/60 leading-relaxed">{h.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

